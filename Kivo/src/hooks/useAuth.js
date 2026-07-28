import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { generateKeypair, encryptSecret, decryptSecret, generateRecoveryPackage } from '../lib/wallet'

/**
 * Unified auth hook — supports Web2 (email/password) and Web3 (Freighter).
 * Exposes: { user, walletAddress, secretKey, loginType, register, login, logout, loading, error }
 * loginType: 'web2' | 'web3' | null
 */
export function useAuth() {
  const [user, setUser]               = useState(null)
  const [walletAddress, setWalletAddress] = useState(null)
  const [secretKey, setSecretKey]     = useState(null)
  const [loginType, setLoginType]     = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)

  // Restore session on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUser(session.user)
        await restoreWallet(session.user.id, null)
        setLoginType('web2')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setWalletAddress(null)
          setSecretKey(null)
          setLoginType(null)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  async function restoreWallet(userId, password) {
    const { data, error } = await supabase
      .from('wallets')
      .select('public_key, secret_enc')
      .eq('user_id', userId)
      .single()

    if (error || !data) return
    setWalletAddress(data.public_key)

    if (password) {
      try {
        const secret = await decryptSecret(data.secret_enc, password)
        setSecretKey(secret)
      } catch {
        // Wrong password or corrupted data — wallet address still available
      }
    }
  }

  /**
   * Register a new Web2 user.
   * Returns { recoveryKey } so the caller can show SeedPhraseModal.
   */
  async function register(email, password) {
    setLoading(true)
    setError(null)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError

      const { publicKey, secretKey: sk } = generateKeypair()
      const secretEnc = await encryptSecret(sk, password)
      const { recoveryKey, encryptedWithRecovery } = await generateRecoveryPackage(sk)

      const { error: insertError } = await supabase.from('wallets').insert({
        user_id:              data.user.id,
        public_key:           publicKey,
        secret_enc:           secretEnc,
        recovery_enc:         encryptedWithRecovery,
      })
      if (insertError) throw insertError

      setUser(data.user)
      setWalletAddress(publicKey)
      setSecretKey(sk)
      setLoginType('web2')

      return { recoveryKey, secretKey: sk }
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  async function login(email, password) {
    setLoading(true)
    setError(null)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      setUser(data.user)
      await restoreWallet(data.user.id, password)
      setLoginType('web2')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setSecretKey(null)
  }

  return { user, walletAddress, secretKey, loginType, register, login, logout, loading, error }
}
