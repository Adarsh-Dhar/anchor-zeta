"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { FC } from "react";

export const WalletConnect: FC = () => {
  const { connected } = useWallet();

  return (
    <div className="flex items-center space-x-4">
      {connected ? (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Wallet Connected</span>
          <WalletMultiButton className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg" />
        </div>
      ) : (
        <WalletMultiButton className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg" />
      )}
    </div>
  );
};
