import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { UniversalNft } from "../target/types/universal_nft";
import { 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";

describe("Universal NFT Program", () => {
  // Configure the client to use the devnet cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.universal_nft as Program<UniversalNft>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  // Test accounts - using existing wallet for admin since it has SOL
  let programStatePda: PublicKey;
  let programStateBump: number;
  let admin: Keypair; // Will be funded from existing wallet
  let user: Keypair; // Will be funded from existing wallet
  let gateway: Keypair; // Will be funded from existing wallet

  before(async () => {
    // Create test keypairs
    admin = Keypair.generate();
    user = Keypair.generate();
    gateway = Keypair.generate();

    // Transfer SOL from existing wallet to test accounts instead of airdropping
    console.log("Funding test accounts from existing wallet...");
    
    const transferAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL each
    
    // Transfer to admin
    const transfer1 = await connection.sendTransaction(
      new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: admin.publicKey,
          lamports: transferAmount,
        })
      ),
      [wallet.payer]
    );
    await connection.confirmTransaction(transfer1);
    
    // Transfer to user
    const transfer2 = await connection.sendTransaction(
      new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: user.publicKey,
          lamports: transferAmount,
        })
      ),
      [wallet.payer]
    );
    await connection.confirmTransaction(transfer2);
    
    // Transfer to gateway
    const transfer3 = await connection.sendTransaction(
      new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: gateway.publicKey,
          lamports: transferAmount,
        })
      ),
      [wallet.payer]
    );
    await connection.confirmTransaction(transfer3);
    
    console.log("Test accounts funded successfully");

    // Find PDA for program state
    [programStatePda, programStateBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("program_state")],
      program.programId
    );
  });

  describe("Program Initialization", () => {
    it("Should initialize the program", async () => {
      const nextTokenId = 1;
      
      const tx = await program.methods
        .initialize(admin.publicKey, gateway.publicKey, new BN(nextTokenId))
        .accounts({
          programState: programStatePda,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Program initialized with signature:", tx);

      // Verify program state
      const programState = await program.account.programState.fetch(programStatePda);
      assert.equal(programState.owner.toString(), admin.publicKey.toString());
      assert.equal(programState.gateway.toString(), gateway.publicKey.toString());
      assert.equal(programState.nextTokenId.toNumber(), nextTokenId);
      assert.equal(programState.paused, false);
      assert.equal(programState.bump, programStateBump);
    });
  });

  describe("Admin Actions", () => {
    it("Should pause the program", async () => {
      const tx = await program.methods
        .pause()
        .accounts({
          programState: programStatePda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      console.log("Program paused with signature:", tx);

      // Verify program is paused
      const programState = await program.account.programState.fetch(programStatePda);
      assert.equal(programState.paused, true);
    });

    it("Should unpause the program", async () => {
      const tx = await program.methods
        .unpause()
        .accounts({
          programState: programStatePda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      console.log("Program unpaused with signature:", tx);

      // Verify program is unpaused
      const programState = await program.account.programState.fetch(programStatePda);
      assert.equal(programState.paused, false);
    });
  });

  describe("NFT Origin Creation", () => {
    it("Should create NFT origin record", async () => {
      const tokenId = 1;
      const originChain = 1;
      const originTokenId = 123;
      const metadataUri = "https://arweave.net/test-metadata.json";

      // Find NFT origin PDA
      const [nftOriginPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft_origin"), new BN(tokenId).toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      const tx = await program.methods
        .createNftOrigin(
          new BN(tokenId),
          originChain,
          new BN(originTokenId),
          metadataUri
        )
        .accounts({
          programState: programStatePda,
          nftOrigin: nftOriginPda,
          mint: user.publicKey, // Using user as placeholder mint
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("NFT origin created with signature:", tx);

      // Verify NFT origin
      const nftOrigin = await program.account.nftOrigin.fetch(nftOriginPda);
      assert.equal(nftOrigin.tokenId.toNumber(), tokenId);
      assert.equal(nftOrigin.originChain, originChain);
      assert.equal(nftOrigin.originTokenId.toNumber(), originTokenId);
      assert.equal(nftOrigin.metadataUri, metadataUri);
      assert.equal(nftOrigin.mint.toString(), user.publicKey.toString());
    });
  });

  describe("Cross-Chain Transfer", () => {
    it("Should initiate cross-chain transfer", async () => {
      const tokenId = 1;
      const destinationChain = 2;
      const destinationOwner = Array.from(new Uint8Array(32).fill(1)); // Convert to number array

      // Find NFT origin PDA
      const [nftOriginPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft_origin"), new BN(tokenId).toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      const tx = await program.methods
        .initiateCrossChainTransfer(
          new BN(tokenId),
          destinationChain,
          destinationOwner
        )
        .accounts({
          programState: programStatePda,
          nftOrigin: nftOriginPda,
          mint: user.publicKey, // Using user as placeholder mint
          userTokenAccount: user.publicKey, // Using user as placeholder token account
          user: user.publicKey,
          tokenProgram: user.publicKey, // Placeholder
        })
        .signers([user])
        .rpc();

      console.log("Cross-chain transfer initiated with signature:", tx);
    });
  });
});
