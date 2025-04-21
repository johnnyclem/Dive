import { atom } from 'jotai'

// Network selection: 'mainnet' | 'testnet'
const savedNetwork = localStorage.getItem('wallet_network')
const initialNetwork: 'mainnet' | 'testnet' =
  savedNetwork === 'mainnet' || savedNetwork === 'testnet' ? savedNetwork : 'testnet'
export const walletNetworkAtom = atom<'mainnet' | 'testnet'>(initialNetwork)

// Persist network selection to localStorage
export const setWalletNetworkAtom = atom(
  null,
  (get, set, network: 'mainnet' | 'testnet') => {
    localStorage.setItem('wallet_network', network)
    set(walletNetworkAtom, network)
  }
)

// Temporarily using any for wallet client until types are resolved
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const walletClientAtom = atom<any | null>(null)

// Connection status: 'disconnected' | 'connecting' | 'connected' | 'error'
export const walletStatusAtom = atom<string>('disconnected')

// Connected accounts
export const walletAccountsAtom = atom<string[]>([])

// Active account
export const walletActiveAccountAtom = atom<string | null>(null)

// Error messages
export const walletErrorAtom = atom<string | null>(null)

// Loading state
export const walletLoadingAtom = atom<boolean>(false) 