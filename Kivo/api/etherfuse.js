import { handleEtherfuse } from '../server/bff.js'

export default async function handler(req, res) {
  return handleEtherfuse(req, res)
}
