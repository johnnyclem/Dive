import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { walletConnect, injected } from 'wagmi/connectors'

// Get projectId from Vite env variables
export const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

console.log('projectId', projectId)

if (!projectId) {
  console.warn('WalletConnect Project ID not found in .env file (VITE_WALLETCONNECT_PROJECT_ID). Using placeholder or default.');
  // Provide a default placeholder or throw an error if essential
  // throw new Error('VITE_WALLETCONNECT_PROJECT_ID is not defined in .env file');
}

const metadata = {
  name: 'Souls Electron App',
  description: 'Souls Electron App with RainbowKit',
  url: 'app://souls', // Or your custom protocol
  icons: [] // Add app icon URLs
};

// Define chains
const chains = [mainnet, sepolia] as const // Add/remove chains as needed

// Create wagmi config using createConfig and defining connectors
export const wagmiConfig = createConfig({
  chains,
  connectors: [
    injected(),
    walletConnect({
      projectId: projectId || 'MISSING_PROJECT_ID', // Ensure projectId is provided
      metadata,
      showQrModal: false, // Set to false if using RainbowKit modal
    }),
    // You can add other connectors here like coinbaseWallet, etc.
  ],
  transports: {
    // Define transports for each chain
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: false, // Important for client-side frameworks like Vite/React
});