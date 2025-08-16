import React, { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export const WalletConnect: React.FC = () => {
  const { publicKey, connected, connecting, disconnecting, select, wallet, wallets } = useWallet();

  useEffect(() => {
    console.log('Wallet state:', { connected, connecting, disconnecting, publicKey: publicKey?.toBase58() });
    console.log('Available wallets:', wallets.map(w => w.adapter.name));
    console.log('Selected wallet:', wallet?.adapter.name);
  }, [connected, connecting, disconnecting, publicKey, wallets, wallet]);

  const handleWalletSelect = (walletName: string) => {
    console.log('Selecting wallet:', walletName);
    select(walletName);
  };

  return (
    <div className="flex items-center space-x-4">
      {connected ? (
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-2 bg-green-100 rounded-lg">
            <div className="w-4 h-4 bg-green-600 rounded-full"></div>
            <span className="text-sm text-green-800 font-medium">Connected</span>
          </div>
          <span className="text-sm text-gray-600 font-mono">
            {publicKey?.toBase58().slice(0, 6)}...{publicKey?.toBase58().slice(-4)}
          </span>
          <WalletMultiButton className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg" />
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <WalletMultiButton className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg" />
          {connecting && (
            <span className="text-sm text-blue-600">Connecting...</span>
          )}
        </div>
      )}
      
      {/* Debug info - remove in production */}
      <div className="text-xs text-gray-500">
        <div>Status: {connected ? 'Connected' : connecting ? 'Connecting' : 'Disconnected'}</div>
        <div>Wallets: {wallets.length}</div>
      </div>
    </div>
  );
};
