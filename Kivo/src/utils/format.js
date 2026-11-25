export function shortenAddress(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}
