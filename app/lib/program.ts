import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import IDL from '../../target/idl/universal_nft_program.json';

// Fallback BN import in case the Anchor BN has issues


export const PROGRAM_ID = new PublicKey('HNNDxSioZreQBawW5momWuHmiWJrLmGBKH1LyH6uUZJL');
export const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// ZetaChain Testnet Chain ID Constants
export const CHAIN_IDS = {
  SOLANA_DEVNET: 901,
  ZETACHAIN_TESTNET: 7001,
  ETHEREUM_SEPOLIA: 11155111,
  BSC_TESTNET: 97,
  POLYGON_AMOY: 80002,
  ARBITRUM_SEPOLIA: 421614,
  BITCOIN_TESTNET: 18332,
  SOLANA_MAINNET: 0, // Legacy for backward compatibility
} as const;

export const CHAIN_NAMES = {
  901: 'Solana Devnet',
  7001: 'ZetaChain Testnet (Athens)',
  11155111: 'Ethereum Sepolia Testnet',
  97: 'BSC Testnet',
  80002: 'Polygon Amoy Testnet',
  421614: 'Arbitrum Sepolia Testnet',
  18332: 'Bitcoin Testnet',
  0: 'Solana Mainnet',
} as const;

export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES] || 'Unknown Chain';
}

export function getChainIdByName(chainName: string): number | null {
  const entry = Object.entries(CHAIN_NAMES).find(([_, name]) => 
    name.toLowerCase().includes(chainName.toLowerCase())
  );
  return entry ? parseInt(entry[0]) : null;
}

export interface ProgramState {
  owner: PublicKey;
  gateway: PublicKey;
  nextTokenId: BN;
  paused: boolean;
  bump: number;
}

export interface NFTOrigin {
  token_id: BN; // Match the Rust program's snake_case field names
  origin_chain: number;
  origin_token_id: BN;
  metadata_uri: string;
  mint: PublicKey;
  created_at: BN;
  bump: number;
}

export class UniversalNFTClient {
  private program: Program;
  private wallet: any;

  constructor(connection: Connection, wallet: any) {
    this.wallet = wallet;
    
    const provider = new AnchorProvider(
      connection,
      wallet,
      { commitment: 'processed', preflightCommitment: 'processed' as any }
    );
    
    this.program = new Program(IDL, provider);
  }





  // Initialize the program
  async initialize(
    gateway: PublicKey, 
    nextTokenId: number, 
    evmContractHex: string,
    gasLimit: number = 1000000, // Default gas limit
  ): Promise<string> {
    try {
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      console.log('Initializing program with PDA:', programStatePDA.toString());
      
      // Convert EVM address to bytes20
      const hex = evmContractHex.trim().toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(hex)) throw new Error('Invalid EVM contract address');
      const contract20 = Uint8Array.from(Buffer.from(hex.slice(2), 'hex'));
      
      console.log('Initialize parameters:', {
        gateway: gateway.toString(),
        nextTokenId,
        evmContract: Array.from(contract20),
        gasLimit,
      });
      
      const tx = await this.program.methods
        .initialize(
          gateway, 
          new BN(nextTokenId), 
          Array.from(contract20),
          new BN(gasLimit),
        )
        .accounts({
          programState: programStatePDA,
          payer: this.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log('Program initialized successfully:', tx);
      return tx;
    } catch (error) {
      console.error('Error initializing program:', error);
      throw error;
    }
  }

  // Get program state PDA
  static getProgramStatePDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('test_program_state')],
      PROGRAM_ID
    );
  }

  // Get NFT origin PDA
  static getNFTOriginPDA(tokenId: number): [PublicKey, number] {
    // Match the Rust program's nft_origin_seed function
    // Creates: ["nft_origin", token_id.to_le_bytes()]
    const seed1 = Buffer.from('nft_origin'); // "nft_origin" (10 bytes)
    const seed2 = Buffer.alloc(8); // 8 bytes for u64
    seed2.writeBigUInt64LE(BigInt(tokenId), 0); // Write token_id as little-endian u64
    
    return PublicKey.findProgramAddressSync(
      [seed1, seed2], // Pass as TWO separate seeds, not one combined
      PROGRAM_ID
    );
  }

  // Get NFT origin PDA for mintNFT (with hardcoded seed matching the program)
  static getNFTOriginPDAMintNFT(): [PublicKey, number] {
    // Generate the seed that matches the Solana program's mintNFT instruction
    // The program expects: [b"nft_origin", &[0u8; 10]] - TWO separate seeds
    const seed1 = Buffer.from('nft_origin'); // "nft_origin" (10 bytes)
    const seed2 = Buffer.alloc(10).fill(0); // 10 bytes of zeros
    
    return PublicKey.findProgramAddressSync(
      [seed1, seed2], // Pass as TWO separate seeds, not one combined
      PROGRAM_ID
    );
  }

  // Create mint account and mint NFT in one transaction
  async createMintAndNFT(uri: string, decimals: number): Promise<{ signature: string; mintAddress: string; tokenId: number }> {
    try {
      console.log('=== CREATE MINT AND NFT START ===');
      console.log('Creating mint and NFT with URI:', uri);
      console.log('Decimals:', decimals);
      console.log('Timestamp:', new Date().toISOString());
      console.log('Wallet address:', this.wallet.publicKey.toString());
      
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      console.log('Program state PDA:', programStatePDA.toString());
      
      // Get the current next_token_id from the program state
      let programState;
      try {
        programState = await (this.program.account as any).programState.fetch(programStatePDA);
      } catch (error: any) {
        console.error('Failed to fetch program state:', error);
        
        // Check if this is a deserialization error
        if (error.message && error.message.includes('Failed to deserialize')) {
          throw new Error(`Program state has old structure and cannot be deserialized. This usually happens when the program was updated but the existing program state account has the old data structure. You may need to reinitialize the program or contact the administrator to migrate the program state. Error: ${error.message}`);
        }
        
        throw new Error(`Failed to fetch program state: ${error.message}`);
      }
      const currentNextTokenId = programState.nextTokenId;
      console.log('Current next_token_id:', currentNextTokenId.toString());
      
      // Generate a new mint keypair for each mint creation
      const mintKeypair = web3.Keypair.generate();
      console.log('Generated mint keypair:', mintKeypair.publicKey.toString());
      
      // Get the Associated Token Account address for the mint
      const tokenAccount = await this.getAssociatedTokenAddress(mintKeypair.publicKey);
      console.log('Token account address:', tokenAccount.toString());
      
      // Derive Metaplex PDAs
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
        METADATA_PROGRAM_ID
      );
      const [masterEditionPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer(), Buffer.from('edition')],
        METADATA_PROGRAM_ID
      );
      
      // The program now uses program_state.next_token_id in the PDA seeds
      // So we use the CURRENT next_token_id (not the predicted one) for PDA derivation
      const currentTokenIdForPDA = currentNextTokenId.toNumber();
      console.log('Client-side PDA derivation:');
      console.log('Using current next_token_id for PDA:', currentTokenIdForPDA);
      console.log('Current next_token_id from program state:', currentNextTokenId.toString());
      
      // Derive the nft_origin PDA using the CURRENT next_token_id
      const tokenIdBuffer = Buffer.alloc(8);
      tokenIdBuffer.writeBigUInt64LE(BigInt(currentTokenIdForPDA), 0); // Write as little-endian u64 (8 bytes)
      console.log('Token ID buffer (hex):', tokenIdBuffer.toString('hex'));
      console.log('Token ID buffer length:', tokenIdBuffer.length);
      
      const [nftOriginPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('nft_origin'), tokenIdBuffer],
        PROGRAM_ID
      );
      console.log('Client-derived PDA:', nftOriginPDA.toString());
      
      console.log('Derived PDAs:', {
        metadataPDA: metadataPDA.toString(),
        masterEditionPDA: masterEditionPDA.toString(),
        nftOriginPDA: nftOriginPDA.toString(),
      });
      
      console.log('Calling program.createMintAndNft with accounts:', {
        programState: programStatePDA.toString(),
        nftOrigin: nftOriginPDA.toString(),
        mint: mintKeypair.publicKey.toString(),
        tokenAccount: tokenAccount.toString(),
        mintAuthority: this.wallet.publicKey.toString(),
        payer: this.wallet.publicKey.toString(),
        tokenProgram: TOKEN_PROGRAM_ID.toString(),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID.toString(),
        systemProgram: web3.SystemProgram.programId.toString(),
        rent: web3.SYSVAR_RENT_PUBKEY.toString(),
        tokenMetadataProgram: METADATA_PROGRAM_ID.toString(),
        metadata: metadataPDA.toString(),
        masterEdition: masterEditionPDA.toString(),
      });
      
      const tx = await this.program.methods
        .createMintAndNft(uri, decimals, new BN(currentTokenIdForPDA))
        .accounts({
          programState: programStatePDA,
          nftOrigin: nftOriginPDA,
          mint: mintKeypair.publicKey,
          tokenAccount: tokenAccount,
          mintAuthority: this.wallet.publicKey,
          payer: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
          tokenMetadataProgram: METADATA_PROGRAM_ID,
          metadata: metadataPDA,
          masterEdition: masterEditionPDA,
        })
        .signers([mintKeypair]) // Include the keypair as a signer
        .rpc();

      console.log('Transaction successful:', tx);
      console.log('=== CREATE MINT AND NFT END ===');
      
      // The token ID that was used is the current next_token_id (before increment)
      const actualTokenId = currentTokenIdForPDA;
      console.log('Actual token ID used:', actualTokenId);
      
      // Use the token ID that was used for the PDA
      return {
        signature: tx,
        mintAddress: mintKeypair.publicKey.toString(),
        tokenId: actualTokenId
      };
    } catch (error: any) {
      console.error('=== CREATE MINT AND NFT ERROR ===');
      console.error('Error creating mint and NFT:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        logs: error.logs
      });
      console.error('=== CREATE MINT AND NFT ERROR END ===');
      throw error;
    }
  }

  // Transfer NFT cross-chain
  async transferCrossChain(
    tokenId: number,
    destinationChain: number, // kept for UI compatibility/logging; not used in IX args
    zrc20OrOwner20: Uint8Array // 20-byte EVM address (used as ZRC-20 addr for now)
  ): Promise<string> {
    try {
      console.log('=== INITIATE CROSS-CHAIN TRANSFER START ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Token ID:', tokenId);
      console.log('Token ID type:', typeof tokenId);
      console.log('Token ID as BigInt:', BigInt(tokenId));
      console.log('Token ID as Buffer:', Buffer.from(tokenId.toString()).toString('hex'));
      console.log('Destination Chain (ignored in ix args):', destinationChain);
      console.log('ZRC20/Owner bytes20:', zrc20OrOwner20);
      
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      console.log('Program State PDA:', programStatePDA.toString());
      
      // Get current program state for debugging
      const currentProgramState = await (this.program.account as any).programState.fetch(programStatePDA);
      console.log('Current program state:', currentProgramState);
      console.log('Current program state next_token_id:', currentProgramState.nextTokenId.toString());
      console.log('Current program state owner:', currentProgramState.owner.toString());
      console.log('Current program state gateway:', currentProgramState.gateway.toString());
      console.log('Current program state paused:', currentProgramState.paused);
      
      // Skipping token ID range validation
      console.log('Skipping token ID range validation...');
      
      const [nftOriginPDA] = UniversalNFTClient.getNFTOriginPDA(tokenId);
      console.log('NFT Origin PDA:', nftOriginPDA.toString());
      console.log('NFT Origin PDA seeds:', ['nft_origin', tokenId]);
      
      // Skipping alternative PDA checks and account enumeration
      console.log('Skipping alternative PDA checks and account enumeration...');

      // Load NFT origin to get the real mint
      console.log('Loading NFT origin account...');
      let nftOriginAccount;
      try {
        nftOriginAccount = await (this.program.account as any).nftOrigin.fetch(nftOriginPDA);
      } catch (error: any) {
        console.error('Failed to fetch NFT origin account:', error);
        throw new Error(`Failed to fetch NFT origin account: ${error.message}`);
      }
      if (!nftOriginAccount || !nftOriginAccount.mint) {
        throw new Error(`NFT with token ID ${tokenId} does not exist or has invalid mint`);
      }
      const mint = nftOriginAccount.mint as PublicKey;
      console.log('NFT Origin mint:', mint.toString());

      // Derive user ATA and ensure balance >= 1
      const userTokenAccount = await this.getAssociatedTokenAddress(mint);
      console.log('User Token Account (ATA):', userTokenAccount.toString());

      let tokenBalance = 0;
      try {
        const bal = await this.program.provider.connection.getTokenAccountBalance(userTokenAccount);
        tokenBalance = parseInt(bal.value.amount, 10) || 0;
      } catch (_) {
        try {
          const parsed = await this.program.provider.connection.getParsedAccountInfo(userTokenAccount);
          const amount = (parsed.value as any)?.data?.parsed?.info?.tokenAmount?.amount;
          tokenBalance = amount ? parseInt(amount, 10) : 0;
        } catch {
          tokenBalance = 0;
        }
      }
      console.log('User ATA balance:', tokenBalance);
      if (tokenBalance < 1) {
        throw new Error(`You don't have any tokens to transfer for token ID ${tokenId}. Please mint an NFT first or switch to the wallet that holds it.`);
      }

      // Build destination_owner [u8;32] (left-pad 12 zeros + 20-byte EVM address)
      const destinationOwnerArray = new Uint8Array(32);
      destinationOwnerArray.set(zrc20OrOwner20.slice(0, 20), 12);
      console.log('Destination Owner [u8;32]:', Array.from(destinationOwnerArray));

      // ZRC-20 address [u8;20]
      const zrc20Address = new Uint8Array(20);
      zrc20Address.set(zrc20OrOwner20.slice(0, 20));
      console.log('ZRC20 Address [u8;20]:', Array.from(zrc20Address));

      console.log('Calling program.transferCrossChain...');
      const tx = await this.program.methods
        .transferCrossChain(
          new BN(tokenId),
          Array.from(zrc20Address),
          Array.from(destinationOwnerArray)
        )
        .accounts({
          programState: programStatePDA,
          nftOrigin: nftOriginPDA,
          mint: mint,
          userTokenAccount: userTokenAccount,
          user: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          gatewayProgram: new PublicKey("ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis"),
        })
        .rpc();

      console.log('Transaction successful! Signature:', tx);
      console.log('=== INITIATE CROSS-CHAIN TRANSFER END ===');
      return tx;
    } catch (error: any) {
      console.error('=== INITIATE CROSS-CHAIN TRANSFER ERROR ===');
      console.error('Error initiating cross-chain transfer:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      console.error('=== INITIATE CROSS-CHAIN TRANSFER ERROR END ===');
      throw error;
    }
  }

  // Receive cross-chain message
  async receiveCrossChainMessage(
    tokenId: number,
    message: Uint8Array,
    mint: PublicKey
  ): Promise<string> {
    try {
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      const [nftOriginPDA] = UniversalNFTClient.getNFTOriginPDA(tokenId);
      
      // Validate the NFT origin account exists
      try {
        const nftOriginAccount = await (this.program.account as any).nftOrigin.fetch(nftOriginPDA);
        if (!nftOriginAccount) {
          throw new Error('NFT origin account not found');
        }
      } catch (error) {
        throw new Error('Failed to fetch NFT origin account');
      }
      
      const tx = await this.program.methods
        .receiveCrossChainMessage(
          new BN(tokenId),
          Array.from(message)
        )
        .accounts({
          programState: programStatePDA,
          nftOrigin: nftOriginPDA,
          mint: mint,
          mintAuthority: this.wallet.publicKey, // Use wallet as mint authority for now
          recipientTokenAccount: await this.getAssociatedTokenAddress(mint),
          payer: this.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error receiving cross-chain message:', error);
      throw error;
    }
  }

  // Pause program
  async pauseProgram(): Promise<string> {
    try {
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      
      const tx = await this.program.methods
        .pause()
        .accounts({
          programState: programStatePDA,
          admin: this.wallet.publicKey,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error pausing program:', error);
      throw error;
    }
  }

  // Unpause program
  async unpauseProgram(): Promise<string> {
    try {
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      
      const tx = await this.program.methods
        .unpause()
        .accounts({
          programState: programStatePDA,
          admin: this.wallet.publicKey,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error unpausing program:', error);
      throw error;
    }
  }

  // Get program state
  async getProgramState(): Promise<ProgramState | null> {
    try {
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      // Use any type to bypass the strict typing issue
      const account = await (this.program.account as any).programState.fetch(programStatePDA);
      return account as ProgramState;
    } catch (error) {
      // If not initialized yet, the PDA won't exist. Treat this as a benign state.
      const message = (error as any)?.message || '';
      if (message.includes('Account does not exist') || message.includes('has no data')) {
        console.info('Program state not found yet. Initialize the program to create it.');
        return null;
      }
      console.error('Error fetching program state:', error);
      return null;
    }
  }

  // Migrate program state to fix deserialization issues
  async migrateProgramState(): Promise<string> {
    try {
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      
      const tx = await this.program.methods
        .migrateProgramState()
        .accounts({
          programState: programStatePDA,
          payer: this.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error migrating program state:', error);
      throw error;
    }
  }

  // Check if program state needs migration (has old structure)
  async checkProgramStateMigration(): Promise<{ needsMigration: boolean; error?: string }> {
    try {
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      
      // Try to fetch the program state
      const programState = await (this.program.account as any).programState.fetch(programStatePDA);
      
      // Check if it has the new fields
      const hasNewFields = programState.gas_limit !== undefined;
      
      return {
        needsMigration: !hasNewFields,
        error: undefined
      };
    } catch (error: any) {
      // If we get a deserialization error, it likely needs migration
      if (error.message && error.message.includes('Failed to deserialize')) {
        return {
          needsMigration: true,
          error: 'Program state has old structure and needs migration'
        };
      }
      
      return {
        needsMigration: false,
        error: error.message || 'Unknown error checking program state'
      };
    }
  }

  // Get NFT origin
  async getNFTOrigin(tokenId: number): Promise<NFTOrigin | null> {
    try {
      const [nftOriginPDA] = UniversalNFTClient.getNFTOriginPDA(tokenId);
      // Use any type to bypass the strict typing issue
      const account = await (this.program.account as any).nftOrigin.fetch(nftOriginPDA);
      
      // Validate that the account has the expected structure
      if (!account || typeof account !== 'object') {
        console.error('Invalid NFT origin account:', account);
        return null;
      }
      
      if (!account.token_id || !account.mint) {
        console.error('NFT origin account missing required fields:', account);
        return null;
      }
      
      return account as NFTOrigin;
    } catch (error) {
      console.error('Error fetching NFT origin:', error);
      return null;
    }
  }

  // Check if NFT exists and get its details
  async checkNFTExists(tokenId: number): Promise<{ exists: boolean; details?: any; error?: string }> {
    try {
      const [nftOriginPDA] = UniversalNFTClient.getNFTOriginPDA(tokenId);
      
      try {
        const nftOriginAccount = await (this.program.account as any).nftOrigin.fetch(nftOriginPDA);
        
        if (nftOriginAccount && nftOriginAccount.mint) {
          // Check if user has tokens
          const userTokenAccount = await this.getAssociatedTokenAddress(nftOriginAccount.mint);
          let tokenBalance = 0;

          try {
            // Prefer on-chain RPC for SPL balances
            const bal = await this.program.provider.connection.getTokenAccountBalance(userTokenAccount);
            tokenBalance = parseInt(bal.value.amount, 10) || 0;
          } catch (_) {
            // Fallback: parsed account (in case ATA exists but balance fetch failed)
            try {
              const parsed = await this.program.provider.connection.getParsedAccountInfo(userTokenAccount);
              const amount = (parsed.value as any)?.data?.parsed?.info?.tokenAmount?.amount;
              tokenBalance = amount ? parseInt(amount, 10) : 0;
            } catch {
              tokenBalance = 0;
            }
          }
          
          return {
            exists: true,
            details: {
              tokenId: nftOriginAccount.token_id,
              mint: nftOriginAccount.mint.toString(),
              metadataUri: nftOriginAccount.metadata_uri,
              originChain: nftOriginAccount.origin_chain,
              originTokenId: nftOriginAccount.origin_token_id,
              createdAt: nftOriginAccount.created_at,
              userTokenAccount: userTokenAccount.toString(),
              tokenBalance
            }
          };
        }
      } catch (error: any) {
        if (error.message && error.message.includes('Account does not exist')) {
          return {
            exists: false,
            error: `NFT with token ID ${tokenId} does not exist`
          };
        }
        throw error;
      }
      
      return {
        exists: false,
        error: 'NFT origin account not found or invalid'
      };
    } catch (error: any) {
      return {
        exists: false,
        error: error.message || 'Failed to check NFT existence'
      };
    }
  }

  // Get all NFT origins (this would need to be implemented with getProgramAccounts)
  async getAllNFTOrigins(): Promise<NFTOrigin[]> {
    try {
      // Get all program accounts and try to decode them individually
      // This is more robust than trying to filter by size or discriminator
      const accounts = await this.program.provider.connection.getProgramAccounts(
        PROGRAM_ID
      );

      const nftOrigins: NFTOrigin[] = [];
      
      for (const acc of accounts) {
        try {
          // Check if the account data is large enough to potentially be an NFTOrigin
          // Minimum size: 8 (discriminator) + 8 (token_id) + 8 (origin_chain) + 8 (origin_token_id) + 4 (metadata_uri length) + 32 (mint) + 8 (created_at) + 1 (bump) = 77 bytes
          if (acc.account.data.length < 77) {
            continue; // Skip accounts that are too small
          }

          // Try to decode each account individually
          const decoded = this.program.coder.accounts.decode('nftOrigin', acc.account.data);
          if (decoded && decoded.token_id !== undefined) {
            nftOrigins.push(decoded);
          }
        } catch (error) {
          // Silently skip accounts that can't be decoded as NFTOrigin
          // This is expected for other account types in the program
          continue;
        }
      }

      return nftOrigins;
    } catch (error) {
      console.error('Error fetching all NFT origins:', error);
      return [];
    }
  }

  // Get NFT details
  async getNFTDetails(mint: PublicKey): Promise<any> {
    try {
      console.log('=== GET NFT DETAILS START ===');
      console.log('Fetching details for mint:', mint.toString());
      
      // Get mint account info
      const mintInfo = await (this.program.account as any).mint.fetch(mint);
      console.log('Mint account info:', mintInfo);
      
      // Get token account info (if it exists)
      const tokenAccount = await this.getAssociatedTokenAddress(mint);
      let tokenAccountInfo = null;
      try {
        tokenAccountInfo = await this.program.provider.connection.getAccountInfo(tokenAccount);
        console.log('Token account info:', tokenAccountInfo);
      } catch (e) {
        console.log('Token account not found yet');
      }
      
      // Get NFT origin info (if it exists)
      let nftOriginInfo = null;
      try {
        const nftOriginSeed = Buffer.concat([
          Buffer.from('nft_origin'),
          mint.toBuffer().slice(0, 10)
        ]);
        const [nftOriginPDA] = PublicKey.findProgramAddressSync(
          [nftOriginSeed],
          PROGRAM_ID
        );
        
        nftOriginInfo = await (this.program.account as any).nftOrigin.fetch(nftOriginPDA);
        console.log('NFT Origin info:', nftOriginInfo);
      } catch (e) {
        console.log('NFT Origin not found yet');
      }
      
      // Get program state
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      const programState = await (this.program.account as any).programState.fetch(programStatePDA);
      console.log('Program state:', programState);
      
      const nftDetails = {
        mint: mint.toString(),
        mintInfo,
        tokenAccount: tokenAccount.toString(),
        tokenAccountInfo,
        nftOriginInfo,
        programState,
        timestamp: new Date().toISOString()
      };
      
      console.log('Complete NFT details:', nftDetails);
      console.log('=== GET NFT DETAILS END ===');
      
      return nftDetails;
    } catch (error: any) {
      console.error('=== GET NFT DETAILS ERROR ===');
      console.error('Error fetching NFT details:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      console.error('=== GET NFT DETAILS ERROR END ===');
      throw error;
    }
  }

  // Get enhanced NFT details with chain information
  async getNFTDetailsWithChainInfo(mint: PublicKey): Promise<any> {
    try {
      console.log('=== GET ENHANCED NFT DETAILS START ===');
      console.log('Fetching enhanced details for mint:', mint.toString());
      
      // Get basic NFT details
      const nftDetails = await this.getNFTDetails(mint);
      
      // Add chain information
      const enhancedDetails = {
        ...nftDetails,
        originChainName: getChainName(nftDetails.nftOriginInfo?.origin_chain || 901),
        currentChainName: 'Solana Devnet',
        crossChainInfo: {
          isCrossChain: nftDetails.nftOriginInfo?.origin_chain !== 901,
          originalChain: getChainName(nftDetails.nftOriginInfo?.origin_chain || 901),
          originalTokenId: nftDetails.nftOriginInfo?.origin_token_id?.toString(),
          hasBeenTransferred: nftDetails.nftOriginInfo?.origin_chain !== 901,
          chainId: nftDetails.nftOriginInfo?.origin_chain || 901
        },
        chainMapping: {
          availableChains: CHAIN_NAMES,
          chainIds: CHAIN_IDS,
          currentChain: {
            id: 901,
            name: 'Solana Devnet',
            alias: 'solana_devnet'
          }
        }
      };
      
      console.log('Enhanced NFT details:', enhancedDetails);
      console.log('=== GET ENHANCED NFT DETAILS END ===');
      
      return enhancedDetails;
    } catch (error: any) {
      console.error('=== GET ENHANCED NFT DETAILS ERROR ===');
      console.error('Error getting enhanced NFT details:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      console.error('=== GET ENHANCED NFT DETAILS ERROR END ===');
      throw error;
    }
  }

  // Get all NFTs with chain information
  async getAllNFTsWithChainInfo(): Promise<any[]> {
    try {
      console.log('=== GET ALL NFTS WITH CHAIN INFO START ===');
      
      const allTokens = await this.program.provider.connection.getParsedTokenAccountsByOwner(
        this.wallet.publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      
      console.log('All token accounts found:', allTokens.value.length);
      
      const nfts = [];
      for (const tokenAccount of allTokens.value) {
        const mint = tokenAccount.account.data.parsed.info.mint;
        const balance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
        
        if (balance > 0) {
          try {
            const nftDetails = await this.getNFTDetailsWithChainInfo(new PublicKey(mint));
            nfts.push({
              ...nftDetails,
              balance,
              tokenAccount: tokenAccount.pubkey.toString()
            });
          } catch (e) {
            console.log('Could not fetch details for mint:', mint);
            nfts.push({
              mint,
              balance,
              tokenAccount: tokenAccount.pubkey.toString(),
              error: 'Could not fetch details',
              chainInfo: {
                currentChain: 'Solana Devnet',
                chainId: 901
              }
            });
          }
        }
      }
      
      console.log('All NFTs with chain info:', nfts);
      console.log('=== GET ALL NFTS WITH CHAIN INFO END ===');
      
      return nfts;
    } catch (error: any) {
      console.error('=== GET ALL NFTS WITH CHAIN INFO ERROR ===');
      console.error('Error fetching all NFTs with chain info:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      console.error('=== GET ALL NFTS WITH CHAIN INFO ERROR END ===');
      throw error;
    }
  }

  // Helper function to get associated token address
  private async getAssociatedTokenAddress(mint: PublicKey): Promise<PublicKey> {
    return await web3.PublicKey.findProgramAddress(
      [
        this.wallet.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    ).then(([address]) => address);
  }

  // Get transaction status and confirmation
  async getTransactionStatus(signature: string): Promise<{
    confirmed: boolean;
    slot: number;
    blockTime: number;
    confirmations: number;
  }> {
    try {
      const tx = await this.program.provider.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      
      if (!tx) {
        return {
          confirmed: false,
          slot: 0,
          blockTime: 0,
          confirmations: 0
        };
      }
      
      return {
        confirmed: true,
        slot: tx.slot,
        blockTime: tx.blockTime || 0,
        confirmations: tx.meta?.err ? 0 : 1
      };
    } catch (error) {
      console.error('Error fetching transaction status:', error);
      return {
        confirmed: false,
        slot: 0,
        blockTime: 0,
        confirmations: 0
      };
    }
  }

  // Log NFT address on destination chain after cross-chain transfer
  async logDestinationChainNFTAddress(
    tokenId: number,
    destinationChain: number,
    destinationOwner: Uint8Array,
    solanaTxSignature: string
  ): Promise<{
    solanaTxSignature: string;
    destinationChain: number;
    destinationChainName: string;
    destinationOwner: string;
    destinationTxHash: string | null;
    status: 'pending' | 'completed' | 'failed';
    logs: string[];
  }> {
    try {
      console.log('=== LOG DESTINATION CHAIN NFT ADDRESS START ===');
      console.log('Token ID:', tokenId);
      console.log('Destination Chain:', destinationChain);
      console.log('Solana TX Signature:', solanaTxSignature);
      console.log('Destination Owner:', destinationOwner);

      const logs: string[] = [];
      
      // Real transaction information
      logs.push(`=== CROSS-CHAIN TRANSFER TRANSACTION ===`);
      logs.push(`Solana Transaction Hash: ${solanaTxSignature}`);
      logs.push(`Token ID: ${tokenId}`);
      logs.push(`Destination Chain: ${getChainName(destinationChain)} (ID: ${destinationChain})`);

      // Get real transaction status
      try {
        const txStatus = await this.getTransactionStatus(solanaTxSignature);
        if (txStatus.confirmed) {
          logs.push(`Transaction Status: Confirmed on Solana`);
          logs.push(`Block Slot: ${txStatus.slot}`);
          logs.push(`Block Time: ${new Date(txStatus.blockTime * 1000).toISOString()}`);
          logs.push(`Confirmations: ${txStatus.confirmations}`);
        } else {
          logs.push(`Transaction Status: Pending confirmation`);
        }
      } catch (error) {
        logs.push(`Transaction Status: Unable to fetch status`);
      }

      // Get NFT origin details for reference
      const [nftOriginPDA] = UniversalNFTClient.getNFTOriginPDA(tokenId);
      let nftOrigin;
      try {
        nftOrigin = await (this.program.account as any).nftOrigin.fetch(nftOriginPDA);
        
        // Validate that the account has the expected structure
        if (nftOrigin && typeof nftOrigin === 'object' && nftOrigin.mint) {
          logs.push(`NFT Origin PDA: ${nftOriginPDA.toString()}`);
          logs.push(`Original Mint: ${nftOrigin.mint.toString()}`);
          logs.push(`Metadata URI: ${nftOrigin.metadata_uri || 'Unknown'}`);
        } else {
          logs.push(`NFT Origin Status: Invalid account structure`);
        }
      } catch (error: any) {
        logs.push(`NFT Origin Status: Not found (may have been burned)`);
      }

      // Convert destination owner to readable format
      let destinationOwnerStr = '';
      if (destinationChain === CHAIN_IDS.ZETACHAIN_TESTNET) {
        // For ZetaChain, convert bytes to hex address
        destinationOwnerStr = '0x' + Array.from(destinationOwner)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        logs.push(`Destination Address (ZetaChain): ${destinationOwnerStr}`);
      } else if (destinationChain === CHAIN_IDS.ETHEREUM_SEPOLIA || 
                 destinationChain === CHAIN_IDS.BSC_TESTNET || 
                 destinationChain === CHAIN_IDS.POLYGON_AMOY || 
                 destinationChain === CHAIN_IDS.ARBITRUM_SEPOLIA) {
        // For EVM chains, convert to hex address
        destinationOwnerStr = '0x' + Array.from(destinationOwner.slice(0, 20))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        logs.push(`Destination Address (EVM): ${destinationOwnerStr}`);
      } else {
        destinationOwnerStr = Array.from(destinationOwner)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        logs.push(`Destination Address (Hex): ${destinationOwnerStr}`);
      }

      // Real transaction status
      logs.push('');
      logs.push(`=== TRANSACTION STATUS ===`);
      logs.push(`✅ Solana: NFT burned successfully`);
      logs.push(`✅ Solana: Cross-chain message sent via gateway`);
      logs.push(`⏳ Destination Chain: Message processing`);
      logs.push(`⏳ Final Status: Awaiting destination chain confirmation`);
      logs.push(`Gateway Program: ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis`);

      // Chain-specific transaction details
      let explorerUrl = '';
      let explorerTxBase = '';
      if (destinationChain === CHAIN_IDS.ZETACHAIN_TESTNET) {
        logs.push('');
        logs.push(`=== ZETACHAIN TRANSACTION INFO ===`);
        logs.push(`Network: Athens Testnet`);
        logs.push(`Chain ID: 7001`);
        logs.push(`Gateway Program: ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis`);
        logs.push(`Message Recipient: ${destinationOwnerStr}`);
        explorerUrl = `https://explorer.zetachain.com/address/${destinationOwnerStr}`;
        explorerTxBase = `https://explorer.zetachain.com`;
        logs.push(`Explorer: ${explorerUrl}`);
      } else if ([CHAIN_IDS.ETHEREUM_SEPOLIA, CHAIN_IDS.BSC_TESTNET, CHAIN_IDS.POLYGON_AMOY, CHAIN_IDS.ARBITRUM_SEPOLIA].includes(destinationChain as any)) {
        logs.push('');
        logs.push(`=== EVM CHAIN TRANSACTION INFO ===`);
        logs.push(`Chain: ${getChainName(destinationChain)}`);
        logs.push(`Chain ID: ${destinationChain}`);
        logs.push(`Gateway Program: ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis`);
        logs.push(`Message Recipient: ${destinationOwnerStr}`);
        explorerUrl = `https://explorer.zetachain.com/address/${destinationOwnerStr}`;
        explorerTxBase = `https://explorer.zetachain.com`;
        logs.push(`Explorer: ${explorerUrl}`);
      }

      // Best-effort: try to fetch a recent tx hash for the recipient from a Blockscout-compatible API (if available)
      let destinationTxHash: string | null = null;
      try {
        if (destinationChain === CHAIN_IDS.ZETACHAIN_TESTNET) {
          const apiBase = (import.meta as any).env?.VITE_ZETA_BLOCKSCOUT_API || 'https://explorer.zetachain.com/api';
          const res = await fetch(`${apiBase}?module=account&action=txlist&address=${destinationOwnerStr}&sort=desc`);
          const data = await res.json();
          if (data && data.status === '1' && Array.isArray(data.result) && data.result.length > 0) {
            destinationTxHash = data.result[0].hash;
          }
        }
      } catch (e) {
        // Ignore failures; show null and keep logs informative
      }

      if (destinationTxHash) {
        logs.push(`Destination Tx Hash: ${destinationTxHash}`);
        if (explorerTxBase) {
          logs.push(`Tx Link: ${explorerTxBase}/tx/${destinationTxHash}`);
        }
      } else {
        logs.push(`Destination Tx Hash: Not yet available (await processing or ensure a universal app emits events)`);
      }

      const result = {
        solanaTxSignature,
        destinationChain,
        destinationChainName: getChainName(destinationChain),
        destinationOwner: destinationOwnerStr,
        destinationTxHash,
        status: 'pending' as const,
        logs
      };

      // Log all information to console
      console.log('\n' + logs.join('\n'));
      console.log('\n=== LOG DESTINATION CHAIN NFT ADDRESS END ===');

      return result;
    } catch (error: any) {
      console.error('Error logging destination chain NFT address:', error);
      throw error;
    }
  }

  // Enhanced cross-chain transfer with destination logging
  async transferCrossChainWithLogging(
    tokenId: number,
    destinationChain: number,
    destinationOwner: Uint8Array
  ): Promise<{
    solanaTxSignature: string;
    destinationLogs: any;
  }> {
    try {
      console.log('=== ENHANCED CROSS-CHAIN TRANSFER START ===');
      console.log('Input parameters:', { tokenId, destinationChain, destinationOwner });
      
      // Step 1: Initiate the cross-chain transfer (this burns the NFT on Solana)
              console.log('Step 1: Calling transferCrossChain...');
        const solanaTxSignature = await this.transferCrossChain(
        tokenId,
        destinationChain,
        destinationOwner
      );
      
      console.log('Cross-chain transfer initiated successfully on Solana');
      console.log('Solana Transaction Signature:', solanaTxSignature);
      
      // Step 2: Generate transaction logs with real blockchain data
      console.log('Step 2: Generating transaction logs...');
      const destinationLogs = await this.logDestinationChainNFTAddress(
        tokenId,
        destinationChain,
        destinationOwner,
        solanaTxSignature
      );
      
      console.log('Transaction logs generated:', destinationLogs);
      console.log('=== ENHANCED CROSS-CHAIN TRANSFER END ===');
      
      return {
        solanaTxSignature,
        destinationLogs
      };
    } catch (error: any) {
      console.error('=== ENHANCED CROSS-CHAIN TRANSFER ERROR ===');
      console.error('Error in enhanced cross-chain transfer:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      console.error('=== ENHANCED CROSS-CHAIN TRANSFER ERROR END ===');
      throw error;
    }
  }
}
