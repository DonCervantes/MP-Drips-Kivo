import { handleTrustless } from '../server/bff.js'

export default async function handler(req, res) {
  return handleTrustless(req, res)
}
