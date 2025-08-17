import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import IDL from '../../target/idl/universal_nft.json';

// Fallback BN import in case the Anchor BN has issues
import BN_JS from 'bn.js';

export const PROGRAM_ID = new PublicKey('C2jwo1xMeUzb2Pb4xHU72yi4HrSzDdTZKXxtaJH6M5NX');

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
  tokenId: BN;
  originChain: number;
  originTokenId: BN;
  metadataUri: string;
  mint: PublicKey;
  createdAt: BN;
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
      { commitment: 'confirmed' }
    );
    
    this.program = new Program(IDL, provider);
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

  // Initialize the program
  async initialize(gateway: PublicKey, nextTokenId: number): Promise<string> {
    try {
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      
      const tx = await this.program.methods
        .initialize(gateway, new BN(nextTokenId))
        .accounts({
          programState: programStatePDA,
          payer: this.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error initializing program:', error);
      throw error;
    }
  }

  // Create mint account
  async createMint(decimals: number): Promise<{ signature: string; mintAddress: string }> {
    try {
      console.log('=== CREATE MINT START ===');
      console.log('Creating mint with decimals:', decimals);
      console.log('Timestamp:', new Date().toISOString());
      console.log('Wallet address:', this.wallet.publicKey.toString());
      
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      console.log('Program state PDA:', programStatePDA.toString());
      
      // Get current program state to know the next token ID
      const programState = await this.getProgramState();
      if (!programState) {
        throw new Error('Failed to get program state');
      }
      
      // Safe conversion function for BN to number
      const safeBNToNumber = (bn: any): number => {
        try {
          return bn.toNumber();
        } catch (error) {
          const stringValue = bn.toString();
          const numValue = Number(stringValue);
          if (isNaN(numValue)) {
            console.warn('Failed to convert BN to number, using 0 as fallback:', stringValue);
            return 0;
          }
          return numValue;
        }
      };
      
      const nextTokenId = safeBNToNumber(programState.nextTokenId);
      console.log('Current program state - next token ID:', nextTokenId);
      
      // Generate a new mint keypair for each mint creation
      const mintKeypair = web3.Keypair.generate();
      console.log('Generated mint keypair:', mintKeypair.publicKey.toString());
      
      console.log('Calling program.createMint with accounts:', {
        programState: programStatePDA.toString(),
        mint: mintKeypair.publicKey.toString(),
        mintAuthority: this.wallet.publicKey.toString(),
        tokenProgram: TOKEN_PROGRAM_ID.toString(),
        systemProgram: web3.SystemProgram.programId.toString(),
        rent: web3.SYSVAR_RENT_PUBKEY.toString(),
      });
      
      const tx = await this.program.methods
        .createMint(decimals)
        .accounts({
          programState: programStatePDA,
          mint: mintKeypair.publicKey,
          mintAuthority: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mintKeypair]) // Include the keypair as a signer
        .rpc();

      console.log('Transaction successful:', tx);
      console.log('=== CREATE MINT END ===');
      
      return {
        signature: tx,
        mintAddress: mintKeypair.publicKey.toString()
      };
    } catch (error: any) {
      console.error('=== CREATE MINT ERROR ===');
      console.error('Error creating mint:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        logs: error.logs
      });
      console.error('=== CREATE MINT ERROR END ===');
      throw error;
    }
  }

  // Mint NFT
  async mintNFT(uri: string, mint: PublicKey, tokenAccount: PublicKey): Promise<string> {
    try {
      console.log('=== MINT NFT START ===');
      console.log('Minting NFT with URI:', uri);
      console.log('Mint address:', mint.toString());
      console.log('Token account:', tokenAccount.toString());
      
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      
      // Generate a unique NFT origin seed to avoid conflicts
      const nftOriginSeed = Buffer.concat([
        Buffer.from('nft_origin'),
        mint.toBuffer().slice(0, 10) // Take only first 10 bytes to match program
      ]);
      
      const [nftOriginPDA] = PublicKey.findProgramAddressSync(
        [nftOriginSeed],
        PROGRAM_ID
      );
      
      console.log('Generated unique NFT origin PDA:', nftOriginPDA.toString());
      console.log('Seed components:', {
        prefix: 'nft_origin',
        mint: mint.toString(),
        seedLength: nftOriginSeed.length,
        mintBytesUsed: mint.toBuffer().slice(0, 10).toString('hex')
      });
      
      const tx = await this.program.methods
        .mintNft(uri)
        .accounts({
          programState: programStatePDA,
          nftOrigin: nftOriginPDA,
          mint: mint,
          tokenAccount: tokenAccount,
          mintAuthority: this.wallet.publicKey,
          payer: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log('NFT minting successful:', tx);
      console.log('=== MINT NFT END ===');
      
      return tx;
    } catch (error: any) {
      console.error('=== MINT NFT ERROR ===');
      console.error('Error minting NFT:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        logs: error.logs
      });
      console.error('=== MINT NFT ERROR END ===');
      throw error;
    }
  }

  // Create NFT origin
  async createNFTOrigin(
    tokenId: number,
    originChain: number,
    originTokenId: number,
    metadataUri: string,
    mint: PublicKey
  ): Promise<string> {
    try {
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      const [nftOriginPDA] = UniversalNFTClient.getNFTOriginPDA(tokenId);
      
      console.log('Creating NFT origin with params:', {
        tokenId,
        originChain,
        originTokenId,
        metadataUri,
        mint: mint.toString()
      });
      
      console.log('Using PDAs:', {
        programState: programStatePDA.toString(),
        nftOrigin: nftOriginPDA.toString()
      });
      
      // Check if program state exists
      try {
        const programState = await (this.program.account as any).programState.fetch(programStatePDA);
        console.log('Program state found:', programState);
        
        // Check if program is paused
        if (programState.paused) {
          throw new Error('Program is currently paused. Please contact the administrator.');
        }
      } catch (error) {
        console.error('Program state not found:', error);
        throw new Error('Program not initialized. Please initialize the program first.');
      }
      
      console.log('About to call program.createNftOrigin with params:', {
        tokenId: new BN(tokenId),
        originChain: new BN(originChain),
        originTokenId: new BN(originTokenId),
        metadataUri
      });
      
      // Validate that BN objects are properly created
      let tokenIdBN: any;
      let originChainBN: any;
      let originTokenIdBN: any;
      
      try {
        tokenIdBN = new BN(tokenId);
        originChainBN = new BN(originChain);
        originTokenIdBN = new BN(originTokenId);
      } catch (error) {
        console.warn('Anchor BN failed, trying fallback BN implementation:', error);
        tokenIdBN = new BN_JS(tokenId);
        originChainBN = new BN_JS(originChain);
        originTokenIdBN = new BN_JS(originTokenId);
      }
      
      console.log('Validated BN objects:', {
        tokenIdBN: tokenIdBN.toString(),
        originChainBN: originChainBN.toString(),
        originTokenIdBN: originTokenIdBN.toString(),
        tokenIdBNType: typeof tokenIdBN,
        originChainBNType: typeof originChainBN,
        originTokenIdBNType: typeof originTokenIdBN
      });
      
      // Validate that BN objects have the expected methods
      if (!tokenIdBN.toArrayLike || !originChainBN.toArrayLike || !originTokenIdBN.toArrayLike) {
        throw new Error('BN objects are missing required methods. This indicates a BN library issue.');
      }
      
      console.log('BN objects validated successfully - all required methods present');
      
      const tx = await this.program.methods
        .createNftOrigin(
          tokenIdBN,
          originChainBN,
          originTokenIdBN,
          metadataUri
        )
        .accounts({
          programState: programStatePDA,
          nftOrigin: nftOriginPDA,
          mint: mint,
          payer: this.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log('NFT origin created successfully:', tx);
      return tx;
    } catch (error: any) {
      console.error('Error creating NFT origin:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        constructor: error.constructor?.name
      });
      
      // Check if it's a specific type of error
      if (error.message && error.message.includes('toArrayLike')) {
        console.error('This appears to be a BN encoding error. Check that all parameters are properly wrapped in BN objects.');
      }
      
      throw error;
    }
  }

  // Initiate cross-chain transfer
  async initiateCrossChainTransfer(
    tokenId: number,
    destinationChain: number,
    destinationOwner: Uint8Array
  ): Promise<string> {
    try {
      const [programStatePDA] = UniversalNFTClient.getProgramStatePDA();
      const [nftOriginPDA] = UniversalNFTClient.getNFTOriginPDA(tokenId);
      
      // Get user's token account for the mint
      const mint = new PublicKey('11111111111111111111111111111111'); // Placeholder
      const userTokenAccount = await this.getAssociatedTokenAddress(mint);
      
      // Convert Uint8Array to [u8; 32] format expected by the program
      const destinationOwnerArray = new Uint8Array(32);
      destinationOwnerArray.set(destinationOwner.slice(0, 32));
      
      const tx = await this.program.methods
        .initiateCrossChainTransfer(
          new BN(tokenId),
          new BN(destinationChain), // Wrap destinationChain in BN since Rust expects u64
          Array.from(destinationOwnerArray)
        )
        .accounts({
          programState: programStatePDA,
          nftOrigin: nftOriginPDA,
          mint: mint,
          userTokenAccount: userTokenAccount,
          user: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error initiating cross-chain transfer:', error);
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
      
      const tx = await this.program.methods
        .receiveCrossChainMessage(
          new BN(tokenId),
          Array.from(message)
        )
        .accounts({
          programState: programStatePDA,
          nftOrigin: nftOriginPDA,
          mint: mint,
          payer: this.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
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
      console.error('Error fetching program state:', error);
      return null;
    }
  }

  // Get NFT origin
  async getNFTOrigin(tokenId: number): Promise<NFTOrigin | null> {
    try {
      const [nftOriginPDA] = UniversalNFTClient.getNFTOriginPDA(tokenId);
      // Use any type to bypass the strict typing issue
      const account = await (this.program.account as any).nftOrigin.fetch(nftOriginPDA);
      return account as NFTOrigin;
    } catch (error) {
      console.error('Error fetching NFT origin:', error);
      return null;
    }
  }

  // Get all NFT origins (this would need to be implemented with getProgramAccounts)
  async getAllNFTOrigins(): Promise<NFTOrigin[]> {
    try {
      // Use getProgramAccounts with proper filters
      const accounts = await this.program.provider.connection.getProgramAccounts(
        PROGRAM_ID,
        {
          filters: [
            {
              dataSize: 8 + 8 + 2 + 8 + 4 + 32 + 8 + 1 + 500, // Size of NFTOrigin account
            },
          ],
        }
      );

      return accounts.map((acc) => {
        try {
          return this.program.coder.accounts.decode('nftOrigin', acc.account.data);
        } catch (error) {
          console.warn('Failed to decode account:', error);
          return null;
        }
      }).filter(Boolean) as NFTOrigin[];
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
        originChainName: getChainName(nftDetails.nftOriginInfo?.originChain || 901),
        currentChainName: 'Solana Devnet',
        crossChainInfo: {
          isCrossChain: nftDetails.nftOriginInfo?.originChain !== 901,
          originalChain: getChainName(nftDetails.nftOriginInfo?.originChain || 901),
          originalTokenId: nftDetails.nftOriginInfo?.originTokenId?.toString(),
          hasBeenTransferred: nftDetails.nftOriginInfo?.originChain !== 901,
          chainId: nftDetails.nftOriginInfo?.originChain || 901
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
}
