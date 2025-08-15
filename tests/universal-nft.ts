import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { UniversalNft } from "../target/types/universal_nft";
import { 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import { 
  createMint, 
  createAccount, 
  getAccount, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccount,
  mintTo,
  burn,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { 
  createCreateMetadataAccountV3Instruction,
  createCreateMasterEditionV3Instruction,
  PROGRAM_ID as METADATA_PROGRAM_ID,
  DataV2
} from "@metaplex-foundation/mpl-token-metadata";
import { assert } from "chai";

describe("Universal NFT Program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.universal_nft as Program<UniversalNft>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  // Test accounts
  let programStatePda: PublicKey;
  let programStateBump: number;
  let admin: Keypair;
  let user: Keypair;
  let mint: Keypair;
  let metadataAccount: PublicKey;
  let masterEditionAccount: PublicKey;
  let userTokenAccount: PublicKey;
  let gateway: PublicKey;

  before(async () => {
    // Create test keypairs
    admin = Keypair.generate();
    user = Keypair.generate();
    mint = Keypair.generate();
    gateway = Keypair.generate();

    // Airdrop SOL to test accounts
    const airdropSignature1 = await connection.requestAirdrop(admin.publicKey, 2 * LAMPORTS_PER_SOL);
    const airdropSignature2 = await connection.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL);
    const airdropSignature3 = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
    
    await connection.confirmTransaction(airdropSignature1);
    await connection.confirmTransaction(airdropSignature2);
    await connection.confirmTransaction(airdropSignature3);

    // Find PDA for program state
    [programStatePda, programStateBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("program_state")],
      program.programId
    );

    // Find metadata account PDA
    metadataAccount = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    )[0];

    // Find master edition account PDA
    masterEditionAccount = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      METADATA_PROGRAM_ID
    )[0];
  });

  describe("Program Initialization", () => {
    it("Should initialize the program", async () => {
      const nextTokenId = 1;
      
      const tx = await program.methods
        .initialize(admin.publicKey, gateway.publicKey, nextTokenId)
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

  describe("NFT Minting and Origin Creation", () => {
    it("Should create mint account and mint tokens", async () => {
      // Create mint account
      await createMint(
        connection,
        wallet.payer,
        wallet.publicKey,
        wallet.publicKey,
        0,
        mint
      );

      // Create associated token account for user
      userTokenAccount = await createAssociatedTokenAccount(
        connection,
        wallet.payer,
        mint.publicKey,
        user.publicKey
      );

      // Mint 1 token to user
      await mintTo(
        connection,
        wallet.payer,
        mint.publicKey,
        userTokenAccount,
        wallet.payer,
        1
      );

      // Verify mint
      const mintInfo = await getAccount(connection, mint.publicKey);
      assert.equal(mintInfo.supply.toString(), "1");
    });

    it("Should create metadata account", async () => {
      const metadataData: DataV2 = {
        name: "Test Universal NFT",
        symbol: "TUNFT",
        uri: "https://arweave.net/test-metadata.json",
        sellerFeeBasisPoints: 500,
        creators: [
          {
            address: wallet.publicKey,
            verified: true,
            share: 100,
          },
        ],
        collection: null,
        uses: null,
      };

      const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAccount,
          mint: mint.publicKey,
          mintAuthority: wallet.publicKey,
          payer: wallet.publicKey,
          updateAuthority: wallet.publicKey,
        },
        {
          createMetadataAccountArgsV3: {
            data: metadataData,
            isMutable: true,
            collectionDetails: null,
          },
        }
      );

      const transaction = new Transaction().add(createMetadataInstruction);
      const signature = await sendAndConfirmTransaction(connection, transaction, [wallet.payer]);
      
      console.log("Metadata created with signature:", signature);
    });

    it("Should create master edition account", async () => {
      const createMasterEditionInstruction = createCreateMasterEditionV3Instruction(
        {
          edition: masterEditionAccount,
          mint: mint.publicKey,
          updateAuthority: wallet.publicKey,
          mintAuthority: wallet.publicKey,
          payer: wallet.publicKey,
          metadata: metadataAccount,
        },
        {
          createMasterEditionArgs: {
            maxSupply: 0, // Unlimited supply
          },
        }
      );

      const transaction = new Transaction().add(createMasterEditionInstruction);
      const signature = await sendAndConfirmTransaction(connection, transaction, [wallet.payer]);
      
      console.log("Master edition created with signature:", signature);
    });

    it("Should create NFT origin record", async () => {
      const tokenId = 1;
      const originChain = 1; // Solana
      const originTokenId = 12345;
      const metadataUri = "https://arweave.net/test-metadata.json";

      // Find PDA for NFT origin
      const [nftOriginPda, nftOriginBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft_origin"), Buffer.alloc(8, 0), Buffer.alloc(6, 0)],
        program.programId
      );

      const tx = await program.methods
        .createNftOrigin(tokenId, originChain, originTokenId, metadataUri)
        .accounts({
          programState: programStatePda,
          nftOrigin: nftOriginPda,
          mint: mint.publicKey,
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
      assert.equal(nftOrigin.mint.toString(), mint.publicKey.toString());
      assert.equal(nftOrigin.bump, nftOriginBump);
    });
  });

  describe("Cross-Chain Transfer", () => {
    it("Should initiate cross-chain transfer", async () => {
      const destinationChain = 2; // Ethereum
      const destinationOwner = new Uint8Array(32).fill(1); // Placeholder recipient
      const tokenId = 1;

      // Find NFT origin PDA
      const [nftOriginPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft_origin"), Buffer.alloc(8, 0), Buffer.alloc(6, 0)],
        program.programId
      );

      const tx = await program.methods
        .initiateCrossChainTransfer(tokenId, destinationChain, Array.from(destinationOwner))
        .accounts({
          programState: programStatePda,
          nftOrigin: nftOriginPda,
          mint: mint.publicKey,
          userTokenAccount: userTokenAccount,
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      console.log("Cross-chain transfer initiated with signature:", tx);

      // Verify the NFT is burned (supply should be 0)
      const mintInfo = await getAccount(connection, mint.publicKey);
      assert.equal(mintInfo.supply.toString(), "0");
    });
  });

  describe("Cross-Chain Message Reception", () => {
    it("Should receive cross-chain message and create NFT origin", async () => {
      const tokenId = 2;
      const originChain = 2; // Ethereum
      const originTokenId = 67890;
      const metadataUri = "https://arweave.net/ethereum-metadata.json";
      const recipient = wallet.publicKey.toBytes();

      // Create a new mint for the received NFT
      const receivedMint = Keypair.generate();
      await createMint(
        connection,
        wallet.payer,
        wallet.publicKey,
        wallet.publicKey,
        0,
        receivedMint
      );

      // Create cross-chain message
      const crossChainMessage = {
        tokenId: tokenId,
        originChain: originChain,
        originTokenId: originTokenId,
        metadataUri: metadataUri,
        recipient: recipient,
      };

      const messageBytes = Buffer.from(JSON.stringify(crossChainMessage));

      // Find PDA for new NFT origin
      const [nftOriginPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft_origin"), Buffer.alloc(8, 0), Buffer.alloc(6, 0)],
        program.programId
      );

      const tx = await program.methods
        .receiveCrossChainMessage(tokenId, messageBytes)
        .accounts({
          programState: programStatePda,
          nftOrigin: nftOriginPda,
          mint: receivedMint.publicKey,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Cross-chain message received with signature:", tx);

      // Verify NFT origin was created
      const nftOrigin = await program.account.nftOrigin.fetch(nftOriginPda);
      assert.equal(nftOrigin.tokenId.toNumber(), tokenId);
      assert.equal(nftOrigin.originChain, originChain);
      assert.equal(nftOrigin.originTokenId.toNumber(), originTokenId);
      assert.equal(nftOrigin.metadataUri, metadataUri);
      assert.equal(nftOrigin.mint.toString(), receivedMint.publicKey.toString());
    });
  });

  describe("Admin Functions", () => {
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

    it("Should reject unauthorized pause attempt", async () => {
      try {
        await program.methods
          .pause()
          .accounts({
            programState: programStatePda,
            admin: user.publicKey,
          })
          .signers([user])
          .rpc();
        
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.include(error.message, "Unauthorized");
      }
    });
  });

  describe("Error Handling", () => {
    it("Should reject operations when program is paused", async () => {
      // Pause the program first
      await program.methods
        .pause()
        .accounts({
          programState: programStatePda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      // Try to create NFT origin while paused
      try {
        const [nftOriginPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("nft_origin"), Buffer.alloc(8, 0), Buffer.alloc(6, 0)],
          program.programId
        );

        await program.methods
          .createNftOrigin(3, 1, 11111, "https://test.com/metadata.json")
          .accounts({
            programState: programStatePda,
            nftOrigin: nftOriginPda,
            mint: mint.publicKey,
            payer: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.include(error.message, "ProgramPaused");
      }

      // Unpause for other tests
      await program.methods
        .unpause()
        .accounts({
          programState: programStatePda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();
    });
  });

  describe("Integration Tests", () => {
    it("Should complete full NFT lifecycle: mint -> transfer -> receive", async () => {
      // This test demonstrates the complete flow described in the requirements
      console.log("Testing complete NFT lifecycle...");

      // 1. Create a new mint for this test
      const lifecycleMint = Keypair.generate();
      await createMint(
        connection,
        wallet.payer,
        wallet.publicKey,
        wallet.publicKey,
        0,
        lifecycleMint
      );

      // 2. Create metadata and master edition
      const lifecycleMetadataAccount = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          lifecycleMint.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      )[0];

      const lifecycleMasterEditionAccount = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          lifecycleMint.publicKey.toBuffer(),
          Buffer.from("edition"),
        ],
        METADATA_PROGRAM_ID
      )[0];

      // Create metadata
      const metadataData: DataV2 = {
        name: "Lifecycle Test NFT",
        symbol: "LCTNFT",
        uri: "https://arweave.net/lifecycle-metadata.json",
        sellerFeeBasisPoints: 500,
        creators: [
          {
            address: wallet.publicKey,
            verified: true,
            share: 100,
          },
        ],
        collection: null,
        uses: null,
      };

      const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
        {
          metadata: lifecycleMetadataAccount,
          mint: lifecycleMint.publicKey,
          mintAuthority: wallet.publicKey,
          payer: wallet.publicKey,
          updateAuthority: wallet.publicKey,
        },
        {
          createMetadataAccountArgsV3: {
            data: metadataData,
            isMutable: true,
            collectionDetails: null,
          },
        }
      );

      const createMasterEditionInstruction = createCreateMasterEditionV3Instruction(
        {
          edition: lifecycleMasterEditionAccount,
          mint: lifecycleMint.publicKey,
          updateAuthority: wallet.publicKey,
          mintAuthority: wallet.publicKey,
          payer: wallet.publicKey,
          metadata: lifecycleMetadataAccount,
        },
        {
          createMasterEditionArgs: {
            maxSupply: 0,
          },
        }
      );

      const metadataTransaction = new Transaction()
        .add(createMetadataInstruction)
        .add(createMasterEditionInstruction);
      
      const metadataSignature = await sendAndConfirmTransaction(
        connection, 
        metadataTransaction, 
        [wallet.payer]
      );
      
      console.log("Lifecycle NFT metadata created:", metadataSignature);

      // 3. Create NFT origin record
      const lifecycleTokenId = 999;
      const [lifecycleNftOriginPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft_origin"), Buffer.alloc(8, 0), Buffer.alloc(6, 0)],
        program.programId
      );

      const originTx = await program.methods
        .createNftOrigin(
          lifecycleTokenId, 
          1, // Solana
          99999, 
          "https://arweave.net/lifecycle-metadata.json"
        )
        .accounts({
          programState: programStatePda,
          nftOrigin: lifecycleNftOriginPda,
          mint: lifecycleMint.publicKey,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Lifecycle NFT origin created:", originTx);

      // 4. Initiate cross-chain transfer
      const transferTx = await program.methods
        .initiateCrossChainTransfer(lifecycleTokenId, 3, new Uint8Array(32).fill(2)) // Chain 3
        .accounts({
          programState: programStatePda,
          nftOrigin: lifecycleNftOriginPda,
          mint: lifecycleMint.publicKey,
          userTokenAccount: userTokenAccount,
          user: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("Lifecycle NFT transfer initiated:", transferTx);

      // 5. Verify the complete flow worked
      const finalNftOrigin = await program.account.nftOrigin.fetch(lifecycleNftOriginPda);
      assert.equal(finalNftOrigin.tokenId.toNumber(), lifecycleTokenId);
      assert.equal(finalNftOrigin.mint.toString(), lifecycleMint.publicKey.toString());

      console.log("✅ Complete NFT lifecycle test passed!");
    });
  });
});
