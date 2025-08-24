import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { UniversalNFTClient, ProgramState, NFTOrigin } from '../lib/program';
import { SolanaUtils } from '../lib/utils';


export const useProgram = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [programState, setProgramState] = useState<ProgramState | null>(null);
  const [nftOrigins, setNftOrigins] = useState<NFTOrigin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [crossChainLogs, setCrossChainLogs] = useState<any>(null);

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
  const initialize = useCallback(async (
    gateway: string, 
    nextTokenId: number, 
    evmContract: string,
    gasLimit: number = 1000000,
  ) => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!SolanaUtils.isValidPublicKey(gateway)) {
      throw new Error('Invalid public key format');
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(evmContract.trim())) {
      throw new Error('Invalid EVM contract address');
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const client = new UniversalNFTClient(connection, wallet);
      // Pass the provided parameters
      const signature = await client.initialize(
        new PublicKey(gateway), 
        nextTokenId, 
        evmContract,
        gasLimit,
      );
      
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

  // Create mint account and mint NFT in one transaction
  const createMintAndNFT = useCallback(async (uri: string, decimals: number) => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const client = new UniversalNFTClient(connection, wallet);
      const result = await client.createMintAndNFT(uri, decimals);
      
      setSuccess(`Mint and NFT created successfully! Mint Address: ${result.mintAddress} | Signature: ${result.signature}`);
      
      // Reload data after successful transaction
      setTimeout(loadProgramData, 2000);
      
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create mint and NFT';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, connection, wallet.publicKey, loadProgramData]);

  // Check if NFT exists before transfer
  const checkNFTExists = useCallback(async (tokenId: number) => {
    if (!wallet.connected || !connection) {
      throw new Error('Wallet not connected');
    }

    try {
      const client = new UniversalNFTClient(connection, wallet);
      return await client.checkNFTExists(tokenId);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to check NFT existence';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [wallet.connected, connection]);

  // Initiate cross-chain transfer with validation
  const initiateTransferWithValidation = useCallback(async (tokenId: number, destinationChain: number, destinationOwner: string) => {
    if (!wallet.connected || !connection) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      // First check if the NFT exists
      const nftCheck = await checkNFTExists(tokenId);
      if (!nftCheck.exists) {
        throw new Error(nftCheck.error || 'NFT not found');
      }
      
      // Check if user has tokens to transfer
      if (nftCheck.details && nftCheck.details.tokenBalance < 1) {
        throw new Error(`You don't have enough tokens for NFT ${tokenId}. Current balance: ${nftCheck.details.tokenBalance}`);
      }
      
      // Convert destination owner address to bytes
      const destinationOwnerBytes = new Uint8Array(32);
      if (destinationOwner.startsWith('0x')) {
        const addressBytes = new Uint8Array(Buffer.from(destinationOwner.slice(2), 'hex'));
        destinationOwnerBytes.set(addressBytes.slice(0, 20), 0);
      } else {
        // Handle Solana addresses - convert from base58 to bytes
        try {
          const publicKey = new PublicKey(destinationOwner);
          const addressBytes = publicKey.toBytes();
          destinationOwnerBytes.set(addressBytes.slice(0, 32), 0);
        } catch (e) {
          throw new Error('Invalid destination owner address format');
        }
      }
      
      const client = new UniversalNFTClient(connection, wallet);
      const signature = await client.transferCrossChain(tokenId, destinationChain, destinationOwnerBytes);
      
      setSuccess(`Cross-chain transfer initiated successfully! Signature: ${signature}`);
      
      // Reload data after successful transaction
      setTimeout(loadProgramData, 2000);
      
      return signature;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to initiate cross-chain transfer';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, connection, checkNFTExists, loadProgramData]);

  // Initiate cross-chain transfer with logging
  const initiateTransferWithLogging = useCallback(async (
    tokenId: number,
    destinationChain: number,
    destinationOwner: string
  ) => {
    console.log('=== HOOK: initiateTransferWithLogging START ===');
    console.log('Input parameters:', { tokenId, destinationChain, destinationOwner });
    console.log('Wallet connected:', wallet.connected);
    console.log('Connection available:', !!connection);
    console.log('Wallet public key:', wallet.publicKey?.toString());
    
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('Setting loading state...');
      setLoading(true);
      setError(null);
      setSuccess(null);
      setCrossChainLogs(null);
      
      console.log('Creating UniversalNFTClient...');
      const client = new UniversalNFTClient(connection, wallet);
      
      // Convert destination owner string to Uint8Array
      console.log('Converting destination owner to bytes...');
      const destOwnerBytes20 = evmHexToBytes20(destinationOwner);
      console.log('Destination owner bytes:', destOwnerBytes20);
      console.log('Destination Owner (hex):', Buffer.from(destOwnerBytes20).toString('hex')); // sanity log
      
              console.log('Calling client.transferCrossChainWithLogging...');
        const result = await client.transferCrossChainWithLogging(
        tokenId,
        destinationChain,
        destOwnerBytes20
      );
      
      console.log('Transfer successful! Result:', result);
      setCrossChainLogs(result.destinationLogs);
      setSuccess(`Transfer initiated! Solana TX: ${result.solanaTxSignature.slice(0, 8)}...`);
      
      // Reload data after successful transaction
      setTimeout(loadProgramData, 2000);
      
      console.log('=== HOOK: initiateTransferWithLogging END ===');
      return result;
    } catch (err: any) {
      console.error('=== HOOK: initiateTransferWithLogging ERROR ===');
      console.error('Error in hook:', err);
      const errorMessage = err.message || 'Failed to initiate transfer';
      setError(errorMessage);
      console.error('=== HOOK: initiateTransferWithLogging ERROR END ===');
      throw new Error(errorMessage);
    } finally {
      console.log('Setting loading to false...');
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

  // Migrate program state to fix deserialization issues
  const migrateProgramState = useCallback(async () => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const client = new UniversalNFTClient(connection, wallet);
      const signature = await client.migrateProgramState();
      
      setSuccess(`Program state migrated successfully! Signature: ${signature}`);
      
      // Reload data after successful transaction
      setTimeout(loadProgramData, 2000);
      
      return signature;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to migrate program state';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, connection, wallet.publicKey, loadProgramData]);

  // Check if program state needs migration
  const checkProgramStateMigration = useCallback(async () => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      const client = new UniversalNFTClient(connection, wallet);
      return await client.checkProgramStateMigration();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to check program state migration';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [wallet.connected, connection, wallet.publicKey]);

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
    crossChainLogs,
    
    // Actions
    initialize,
    createMintAndNFT,
    initiateTransferWithLogging,
    initiateTransferWithValidation,
    receiveMessage,
    pauseProgram,
    unpauseProgram,
    migrateProgramState,
    checkProgramStateMigration,
    clearMessages,
    loadProgramData,
    
    // Computed values
    isConnected: wallet.connected,
    wallet: wallet.publicKey?.toString(),
    checkNFTExists
  };
};

function evmHexToBytes20(addr: string): Uint8Array {
  const hex = addr.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(hex)) throw new Error('Invalid EVM address');
  return Uint8Array.from(Buffer.from(hex.slice(2), 'hex')); // 20 bytes
}
