import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import IDL from '../../target/idl/universal_nft.json';

export const PROGRAM_ID = new PublicKey('C2jwo1xMeUzb2Pb4xHU72yi4HrSzDdTZKXxtaJH6M5NX');

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
    const seed = this.generateNFTOriginSeed(tokenId);
    return PublicKey.findProgramAddressSync(
      [seed],
      PROGRAM_ID
    );
  }

  // Generate NFT origin seed
  private static generateNFTOriginSeed(tokenId: number): Buffer {
    const seed = Buffer.alloc(18);
    seed.write('nft_origin', 0);
    seed.writeBigUInt64LE(BigInt(tokenId), 10);
    return seed;
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

  // Create NFT origin record
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
      
      const tx = await this.program.methods
        .createNftOrigin(
          new BN(tokenId),
          originChain,
          new BN(originTokenId),
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

      return tx;
    } catch (error) {
      console.error('Error creating NFT origin:', error);
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
      
      const tx = await this.program.methods
        .initiateCrossChainTransfer(
          new BN(tokenId),
          destinationChain,
          Array.from(destinationOwner)
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
      // Use any type to bypass the strict typing issue
      const accounts = await (this.program.account as any).nftOrigin.all();
      return accounts.map((acc: any) => acc.account as NFTOrigin);
    } catch (error) {
      console.error('Error fetching all NFT origins:', error);
      return [];
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
