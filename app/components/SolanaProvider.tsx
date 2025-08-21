"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

interface SolanaProviderProps {
  children: ReactNode;
}

export const SolanaProvider: FC<SolanaProviderProps> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
  const network = WalletAdapterNetwork.Devnet;

  // Use a more reliable RPC endpoint
  const endpoint = useMemo(() => {
    const defaultEndpoint = clusterApiUrl(network);
    console.log('Solana endpoint:', defaultEndpoint);
    return defaultEndpoint;
  }, [network]);

  // Initialize wallet adapters - start with just the most reliable ones
  const wallets = useMemo(() => {
    try {
      const walletAdapters = [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
      ];

      // Deduplicate by adapter name to avoid duplicate React keys (e.g., duplicate "MetaMask")
      const uniqueByName = Array.from(
        new Map(walletAdapters.map((w) => [w.name, w])).values()
      );
      
      console.log('Initialized wallet adapters:', uniqueByName.map(w => w.name));
      return uniqueByName;
    } catch (error) {
      console.error('Error initializing wallet adapters:', error);
      return [];
    }
  }, []);

  console.log('SolanaProvider rendering with:', { network, endpoint, walletCount: wallets.length });

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
