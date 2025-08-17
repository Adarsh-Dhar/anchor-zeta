import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { UniversalNFTClient, ProgramState, NFTOrigin } from '../lib/program';
import { SolanaUtils } from '../lib/utils';
import * as web3 from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';

export const useProgram = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [programState, setProgramState] = useState<ProgramState | null>(null);
  const [nftOrigins, setNftOrigins] = useState<NFTOrigin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load program data
  const loadProgramData = useCallback(async () => {
    if (!wallet.connected || !connection) return;
    
    try {
      setLoading(true);
      setError(null);
      const client = new UniversalNFTClient(connection, wallet);
      
      // Load program state
      const state = await client.getProgramState();
      setProgramState(state);
      
      // Load NFT origins
      const origins = await client.getAllNFTOrigins();
      setNftOrigins(origins);
    } catch (err: any) {
      console.error('Error loading program data:', err);
      setError(err.message || 'Failed to load program data');
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, connection]);

  // Initialize program
  const initialize = useCallback(async (owner: string, gateway: string, nextTokenId: number) => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!SolanaUtils.isValidPublicKey(owner) || !SolanaUtils.isValidPublicKey(gateway)) {
      throw new Error('Invalid public key format');
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const client = new UniversalNFTClient(connection, wallet);
      const signature = await client.initialize(new PublicKey(gateway), nextTokenId);
      
      setSuccess(`Program initialized! Signature: ${signature}`);
      
      // Reload data after successful transaction
      setTimeout(loadProgramData, 2000);
      
      return signature;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to initialize program';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, connection, wallet.publicKey, loadProgramData]);

  // Create mint account
  const createMint = useCallback(async (decimals: number) => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const client = new UniversalNFTClient(connection, wallet);
      const { signature, mintAddress } = await client.createMint(decimals);
      
      setSuccess(`Mint account created! Address: ${mintAddress} | Signature: ${signature}`);
      
      // Reload data after successful transaction
      setTimeout(loadProgramData, 2000);
      
      return { signature, mintAddress };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create mint account';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, connection, wallet.publicKey, loadProgramData]);

  // Mint NFT
  const mintNFT = useCallback(async (uri: string, mintAddress: string) => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!SolanaUtils.isValidPublicKey(mintAddress)) {
      throw new Error('Invalid mint address format');
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const client = new UniversalNFTClient(connection, wallet);
      const mint = new PublicKey(mintAddress);
      
      // Get the Associated Token Account address for the mint
      const tokenAccount = await getAssociatedTokenAddress(mint, wallet.publicKey);
      
      // Check if the token account already exists
      const tokenAccountInfo = await connection.getAccountInfo(tokenAccount);
      
      if (!tokenAccountInfo) {
        // Create the Associated Token Account if it doesn't exist
        console.log('Creating Associated Token Account...');
        const createATAInstruction = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          tokenAccount,
          wallet.publicKey,
          mint
        );
        
        const createATATx = new web3.Transaction().add(createATAInstruction);
        const signature = await wallet.sendTransaction(createATATx, connection);
        await connection.confirmTransaction(signature);
        console.log('Associated Token Account created:', signature);
      }
      
      const signature = await client.mintNFT(uri, mint, tokenAccount);
      
      setSuccess(`NFT minted! Signature: ${signature}`);
      
      // Reload data after successful transaction
      setTimeout(loadProgramData, 2000);
      
      return signature;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to mint NFT';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, connection, wallet.publicKey, loadProgramData]);

  // Create NFT origin
  const createNFTOrigin = useCallback(async (
    tokenId: number,
    originChain: number,
    originTokenId: number,
    metadataUri: string,
    mintAddress: string
  ) => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!SolanaUtils.isValidPublicKey(mintAddress)) {
      throw new Error('Invalid mint address format');
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const client = new UniversalNFTClient(connection, wallet);
      const mint = new PublicKey(mintAddress);
      
      const signature = await client.createNFTOrigin(
        tokenId,
        originChain,
        originTokenId,
        metadataUri,
        mint
      );
      
      setSuccess(`NFT origin created! Signature: ${signature}`);
      
      // Reload data after successful transaction
      setTimeout(loadProgramData, 2000);
      
      return signature;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create NFT origin';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, connection, wallet.publicKey, loadProgramData]);

  // Initiate cross-chain transfer
  const initiateTransfer = useCallback(async (
    tokenId: number,
    destinationChain: number,
    destinationOwner: string
  ) => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const client = new UniversalNFTClient(connection, wallet);
      
      // Convert destination owner to Uint8Array (placeholder implementation)
      const destinationOwnerBytes = new Uint8Array(32);
      
      const signature = await client.initiateCrossChainTransfer(
        tokenId,
        destinationChain,
        destinationOwnerBytes
      );
      
      setSuccess(`Transfer initiated! Signature: ${signature}`);
      
      // Reload data after successful transaction
      setTimeout(loadProgramData, 2000);
      
      return signature;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to initiate transfer';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, connection, wallet.publicKey, loadProgramData]);

  // Receive cross-chain message
  const receiveMessage = useCallback(async (
    tokenId: number,
    message: string,
    mintAddress: string
  ) => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!SolanaUtils.isValidPublicKey(mintAddress)) {
      throw new Error('Invalid mint address format');
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const client = new UniversalNFTClient(connection, wallet);
      const mint = new PublicKey(mintAddress);
      
      // Convert message to Uint8Array (placeholder implementation)
      const messageBytes = new TextEncoder().encode(message);
      
      const signature = await client.receiveCrossChainMessage(
        tokenId,
        messageBytes,
        mint
      );
      
      setSuccess(`Message received! Signature: ${signature}`);
      
      // Reload data after successful transaction
      setTimeout(loadProgramData, 2000);
      
      return signature;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to receive message';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, connection, wallet.publicKey, loadProgramData]);

  // Pause program
  const pauseProgram = useCallback(async () => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const client = new UniversalNFTClient(connection, wallet);
      const signature = await client.pauseProgram();
      
      setSuccess(`Program paused! Signature: ${signature}`);
      
      // Reload data after successful transaction
      setTimeout(loadProgramData, 2000);
      
      return signature;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to pause program';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, connection, wallet.publicKey, loadProgramData]);

  // Unpause program
  const unpauseProgram = useCallback(async () => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const client = new UniversalNFTClient(connection, wallet);
      const signature = await client.unpauseProgram();
      
      setSuccess(`Program unpaused! Signature: ${signature}`);
      
      // Reload data after successful transaction
      setTimeout(loadProgramData, 2000);
      
      return signature;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to unpause program';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, connection, wallet.publicKey, loadProgramData]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  // Load data when wallet connects
  useEffect(() => {
    if (wallet.connected && connection) {
      loadProgramData();
    }
  }, [wallet.connected, connection, loadProgramData]);

  return {
    // State
    programState,
    nftOrigins,
    loading,
    error,
    success,
    
    // Actions
    initialize,
    createMint,
    mintNFT,
    createNFTOrigin,
    initiateTransfer,
    receiveMessage,
    pauseProgram,
    unpauseProgram,
    clearMessages,
    loadProgramData,
    
    // Computed values
    isConnected: wallet.connected,
    wallet: wallet.publicKey?.toString(),
  };
};
