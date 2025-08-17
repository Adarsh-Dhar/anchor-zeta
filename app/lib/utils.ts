import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  getAssociatedTokenAddress,
  mintTo,
  getAccount
} from '@solana/spl-token';

export class SolanaUtils {
  /**
   * Create a new mint
   */
  static async createMint(
    connection: Connection,
    payer: Keypair,
    mintAuthority: PublicKey,
    freezeAuthority: PublicKey | null,
    decimals: number = 0
  ): Promise<PublicKey> {
    const mint = await createMint(
      connection,
      payer,
      mintAuthority,
      freezeAuthority,
      decimals,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );
    
    return mint;
  }

  /**
   * Create an associated token account
   */
  static async createAssociatedTokenAccount(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> {
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await createAssociatedTokenAccount(
      connection,
      payer,
      owner,
      mint
    );

    return associatedTokenAddress;
  }

  /**
   * Get or create associated token account
   */
  static async getOrCreateAssociatedTokenAccount(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> {
    try {
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mint,
        owner,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Check if account exists
      const accountInfo = await getAccount(connection, associatedTokenAddress);
      if (accountInfo) {
        return associatedTokenAddress;
      }
    } catch (error) {
      // Account doesn't exist, create it
    }

    // Create the account
    return await this.createAssociatedTokenAccount(connection, payer, mint, owner);
  }

  /**
   * Mint tokens to an account
   */
  static async mintTokens(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    destination: PublicKey,
    authority: Keypair,
    amount: number
  ): Promise<string> {
    const signature = await mintTo(
      connection,
      payer,
      mint,
      destination,
      authority,
      amount
    );

    return signature;
  }

  /**
   * Validate a public key string
   */
  static isValidPublicKey(publicKeyString: string): boolean {
    try {
      new PublicKey(publicKeyString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format public key for display
   */
  static formatPublicKey(publicKey: PublicKey | string, length: number = 8): string {
    const key = typeof publicKey === 'string' ? publicKey : publicKey.toString();
    if (key.length <= length * 2) return key;
    return `${key.slice(0, length)}...${key.slice(-length)}`;
  }

  /**
   * Convert string to Uint8Array
   */
  static stringToUint8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  /**
   * Convert Uint8Array to string
   */
  static uint8ArrayToString(array: Uint8Array): string {
    return new TextDecoder().decode(array);
  }
}
