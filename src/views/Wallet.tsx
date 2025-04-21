import React, { useEffect } from 'react'
import { useAtom } from 'jotai'
import {
  walletNetworkAtom,
  walletStatusAtom,
  walletAccountsAtom,
  walletErrorAtom,
  walletLoadingAtom,
} from '../atoms/walletState'
import { initClient, connectWallet, getAccounts } from '../helper/mcpService'

const Wallet: React.FC = () => {
  const [network, setNetwork] = useAtom(walletNetworkAtom)
  const [status, setStatus] = useAtom(walletStatusAtom)
  const [accounts, setAccounts] = useAtom(walletAccountsAtom)
  const [error, setError] = useAtom(walletErrorAtom)
  const [loading, setLoading] = useAtom(walletLoadingAtom)

  useEffect(() => {
    // Initialize client on mount
    initClient(network).catch(console.error)
  }, [network])

  const handleConnect = async () => {
    setLoading(true)
    setStatus('connecting')
    setError(null)
    try {
      // Ensure client is initialized
      await initClient(network)
      await connectWallet('local')
      // Fetch connected accounts
      const accts = getAccounts()
      setAccounts(accts)
      setStatus('connected')
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <h1>Wallet</h1>
      <p>Network: {network}</p>
      <p>Status: {status}</p>
      <button onClick={() => setNetwork(network === 'mainnet' ? 'testnet' : 'mainnet')}>
        Switch to {network === 'mainnet' ? 'TestNet' : 'MainNet'}
      </button>
      <button onClick={handleConnect} disabled={loading} className="ml-2 px-4 py-2 bg-blue-600 text-white rounded">
        {loading ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {error && <p className="text-red-500">Error: {error}</p>}
      <h2 className="mt-4">Accounts</h2>
      {accounts.length > 0 ? (
        <ul>
          {accounts.map(addr => (
            <li key={addr}>{addr}</li>
          ))}
        </ul>
      ) : (
        <p>No accounts connected</p>
      )}
    </div>
  )
}

export default Wallet 