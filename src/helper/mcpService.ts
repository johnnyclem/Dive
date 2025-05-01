// Create a stub service for Algorand MCP client integration
// ... existing code ...

// We will dynamically import the Algorand MCP client when available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null

/** Initialize the MCP client with the given network ('mainnet' | 'testnet'). */
export async function initClient(network: 'mainnet' | 'testnet') {
  try {
    // Dynamically import the client source so TS loader can handle it
    const module = await import('algorand-mcp/packages/client/src/index')
    const { AlgorandMcpClient } = module
    client = new AlgorandMcpClient({ network })
    return client
  } catch (err) {
    console.error('Failed to load AlgorandMcpClient:', err)
    throw err
  }
}

/** Connect to a wallet provider ('local' | 'pera' | 'defly' | 'daffi'). */
export async function connectWallet(walletType: string) {
  if (!client) throw new Error('MCP client not initialized')
  return client.connect(walletType)
}

/** Disconnect the current wallet. */
export async function disconnectWallet() {
  if (!client) return
  return client.disconnect()
}

/** Get connected accounts. */
export function getAccounts(): string[] {
  if (!client) return []
  return client.getAccounts()
} 