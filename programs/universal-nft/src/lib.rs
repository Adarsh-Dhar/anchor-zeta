use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Mint, Token, TokenAccount, MintTo, Burn},
    associated_token::AssociatedToken,
};
 
use anchor_lang::solana_program::rent::Rent;
use borsh::BorshSerialize;
use mpl_token_metadata::instructions::{
    CreateMetadataAccountV3CpiBuilder,
    CreateMasterEditionV3CpiBuilder,
};
use mpl_token_metadata::types::{DataV2, Creator, Collection, Uses};
use std::str::FromStr;

declare_id!("DkcNjarjaVgEpq65tHDqzNTjcxuo3PyF17sDkc4CrFnm");


pub const ZETA_GATEWAY_PROGRAM_ID: &str = "ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis";

// Compute the Anchor instruction discriminator (sighash) for a given method name.
// Uses SHA-256 over the preimage "global:<name>", then takes the first 8 bytes.
fn instruction_discriminator(name: &str) -> [u8; 8] {
    let mut discriminator = [0u8; 8];
    let preimage = format!("global:{}", name);
    let hash = anchor_lang::solana_program::hash::hashv(&[preimage.as_bytes()]);
    discriminator.copy_from_slice(&hash.to_bytes()[..8]);
    discriminator
}


fn call_gateway<'a>(
    gateway_program: AccountInfo<'a>,
    signer: AccountInfo<'a>,
    receiver: [u8; 20],
    message: Vec<u8>,
) -> Result<()> {
    use anchor_lang::solana_program::instruction::AccountMeta;

    let mut instruction_data = Vec::new();
    // Use "call" instruction - this is correct for just sending messages
    instruction_data.extend_from_slice(&instruction_discriminator("call"));
    
    instruction_data.extend_from_slice(&receiver);
    instruction_data.extend_from_slice(&(message.len() as u32).to_le_bytes());
    instruction_data.extend_from_slice(&message);
    instruction_data.push(0u8); // Option<RevertOptions>::None

    let metas = vec![
        AccountMeta::new(*signer.key, true),
    ];
    let infos = vec![signer.clone(), gateway_program.clone()];
    
    anchor_lang::solana_program::program::invoke(
        &anchor_lang::solana_program::instruction::Instruction {
            program_id: gateway_program.key(),
            accounts: metas,
            data: instruction_data,
        },
        &infos,
    )?;
    
    Ok(())
}


fn abi_encode_message(
    destination: [u8; 20],
    receiver: [u8; 20],
    token_id: u64,
    uri: String,
    sender: [u8; 20]
) -> Vec<u8> {
    let mut message = Vec::new();
    
    // destination (address)
    message.extend_from_slice(&[0u8; 12]);
    message.extend_from_slice(&destination);
    
    // receiver (address)
    message.extend_from_slice(&[0u8; 12]);
    message.extend_from_slice(&receiver);
    
    // tokenId (uint256)
    let mut token_id_bytes = [0u8; 32];
    token_id_bytes[24..32].copy_from_slice(&token_id.to_be_bytes());
    message.extend_from_slice(&token_id_bytes);
    
    // uri offset (uint256)
    let offset = 160u64;
    message.extend_from_slice(&offset.to_be_bytes());
    
    // sender (address)
    message.extend_from_slice(&[0u8; 12]);
    message.extend_from_slice(&sender);
    
    // uri length and data
    let uri_len = uri.len() as u64;
    message.extend_from_slice(&uri_len.to_be_bytes());
    message.extend_from_slice(uri.as_bytes());
    
    // padding
    let padding = (32 - (uri.len() % 32)) % 32;
    message.extend_from_slice(&vec![0u8; padding]);
    
    message
}

// ZetaChain Testnet Chain ID Constants
pub const CHAIN_ID_SOLANA_DEVNET: u64 = 901;
pub const CHAIN_ID_ZETACHAIN_TESTNET: u64 = 7001;
pub const CHAIN_ID_ETHEREUM_SEPOLIA: u64 = 11155111;
pub const CHAIN_ID_BSC_TESTNET: u64 = 97;
pub const CHAIN_ID_POLYGON_AMOY: u64 = 80002;
pub const CHAIN_ID_ARBITRUM_SEPOLIA: u64 = 421614;
pub const CHAIN_ID_BITCOIN_TESTNET: u64 = 18332;

pub const CHAIN_ID_SOLANA: u64 = 0;

pub fn get_chain_name(chain_id: u64) -> &'static str {
    match chain_id {
        CHAIN_ID_SOLANA_DEVNET => "Solana Devnet",
        CHAIN_ID_ZETACHAIN_TESTNET => "ZetaChain Testnet (Athens)",
        CHAIN_ID_ETHEREUM_SEPOLIA => "Ethereum Sepolia Testnet",
        CHAIN_ID_BSC_TESTNET => "BSC Testnet",
        CHAIN_ID_POLYGON_AMOY => "Polygon Amoy Testnet",
        CHAIN_ID_ARBITRUM_SEPOLIA => "Arbitrum Sepolia Testnet",
        CHAIN_ID_BITCOIN_TESTNET => "Bitcoin Testnet",
        CHAIN_ID_SOLANA => "Solana Mainnet",
        _ => "Unknown Chain"
    }
}

fn nft_origin_seed(token_id: u64) -> Vec<u8> {
    let mut seed = Vec::new();
    seed.extend_from_slice(b"nft_origin");
    seed.extend_from_slice(&token_id.to_le_bytes());
    seed
}

fn generate_token_id(_mint: &Pubkey, next_token_id: u64) -> u64 {
    // Use simple sequential token IDs instead of complex hash-based IDs
    // This makes the system much more user-friendly and predictable
    next_token_id
}

#[program]
pub mod universal_nft {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        gateway: Pubkey,
        next_token_id: u64,
        universal_nft_contract: [u8; 20],
    ) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        // Hardcode the admin address
        program_state.owner = Pubkey::from_str("F79VcAwM6VhL9CaZo68W1SwrkntLJpAhcbTLLzuz4g3G").unwrap();
        program_state.gateway = gateway;
        // Set the destination chain (Zeta/EVM) contract address to call via gateway
        program_state.universal_nft_contract = universal_nft_contract;
        program_state.next_token_id = next_token_id;
        program_state.paused = false;
        program_state.bump = ctx.bumps.program_state;
        
        emit!(ProgramInitialized {
            owner: program_state.owner,
            gateway,
            initial_token_id: next_token_id,
        });
        
        Ok(())
    }

    pub fn create_mint_and_nft(
        ctx: Context<CreateMintAndNFT>,
        uri: String,
        decimals: u8,
        token_id: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, ErrorCode::ProgramPaused);
        
        let program_state = &mut ctx.accounts.program_state;
        let clock = Clock::get()?;

        // Validate that the provided token_id matches the expected next_token_id
        require_eq!(token_id, program_state.next_token_id, ErrorCode::NextTokenIdMismatch);

        // Step 1: Create mint account (this is handled by the account constraint)
        // The mint account is already initialized by the account constraint
        
        // Step 2: Mint NFT and create metadata
        let final_token_id = generate_token_id(
            &ctx.accounts.mint.key(),
            program_state.next_token_id
        );
        
        // Increment the token ID counter
        program_state.next_token_id = program_state.next_token_id.checked_add(1)
            .ok_or(ErrorCode::TokenIdOverflow)?;
        
        // Mint 1 token to the user's token account
        let mint_to_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
        );
        
        anchor_spl::token::mint_to(mint_to_ctx, 1)?;

        // Create metadata for the NFT
        let data_v2 = DataV2 {
            name: String::from("Universal NFT"),
            symbol: String::from("UNFT"),
            uri: uri.clone(),
            seller_fee_basis_points: 0,
            creators: None::<Vec<Creator>>,
            collection: None::<Collection>,
            uses: None::<Uses>,
        };

        CreateMetadataAccountV3CpiBuilder::new(&ctx.accounts.token_metadata_program)
            .metadata(&ctx.accounts.metadata)
            .mint(&ctx.accounts.mint.to_account_info())
            .mint_authority(&ctx.accounts.mint_authority.to_account_info())
            .payer(&ctx.accounts.payer.to_account_info())
            .update_authority(&ctx.accounts.mint_authority.to_account_info(), true)
            .system_program(&ctx.accounts.system_program.to_account_info())
            .data(data_v2)
            .is_mutable(true)
            .invoke()?;

        CreateMasterEditionV3CpiBuilder::new(&ctx.accounts.token_metadata_program)
            .edition(&ctx.accounts.master_edition)
            .mint(&ctx.accounts.mint.to_account_info())
            .update_authority(&ctx.accounts.mint_authority.to_account_info())
            .mint_authority(&ctx.accounts.mint_authority.to_account_info())
            .payer(&ctx.accounts.payer.to_account_info())
            .metadata(&ctx.accounts.metadata)
            .system_program(&ctx.accounts.system_program.to_account_info())
            .token_program(&ctx.accounts.token_program.to_account_info())
            .max_supply(0)
            .invoke()?;
        
        // Step 3: Create NFT origin record manually using CPI
        let token_id_bytes = final_token_id.to_le_bytes();
        let (nft_origin_pda, nft_origin_bump) = Pubkey::find_program_address(
            &[b"nft_origin", &token_id_bytes],
            ctx.program_id,
        );
        
        // Validate that the provided nft_origin account matches the expected PDA
        require_keys_eq!(ctx.accounts.nft_origin.key(), nft_origin_pda, ErrorCode::NFTOriginNotFound);
        
        // Create the NFT origin account using CPI
        let origin_record = NFTOrigin {
            token_id: final_token_id,
            origin_chain: CHAIN_ID_SOLANA_DEVNET,
            origin_token_id: final_token_id,
            metadata_uri: uri.clone(),
            mint: ctx.accounts.mint.key(),
            created_at: clock.unix_timestamp,
            bump: nft_origin_bump,
        };

        let serialized = origin_record.try_to_vec()?;
        let account_size: usize = 8 + serialized.len();

        let lamports: u64 = Rent::get()?.minimum_balance(account_size);

        let signer_seeds: &[&[&[u8]]] = &[&[b"nft_origin", &token_id_bytes, &[nft_origin_bump]]];
        let create_cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::CreateAccount {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.nft_origin.to_account_info(),
            },
        );
        anchor_lang::system_program::create_account(
            create_cpi_ctx.with_signer(signer_seeds),
            lamports,
            account_size as u64,
            ctx.program_id,
        )?;

        let mut data = ctx.accounts.nft_origin.try_borrow_mut_data()?;
        let disc = NFTOrigin::DISCRIMINATOR;
        data[..8].copy_from_slice(&disc);
        data[8..8 + serialized.len()].copy_from_slice(&serialized);
        
        // Emit events for all operations
        emit!(MintCreated {
            mint: ctx.accounts.mint.key(),
            mint_authority: ctx.accounts.mint_authority.key(),
            decimals,
            token_id: program_state.next_token_id,
        });
        
        emit!(NFTMinted {
            token_id: final_token_id,
            mint: ctx.accounts.mint.key(),
            metadata_uri: uri.clone(),
        });
        
        emit!(NFTOriginCreated {
            token_id: final_token_id,
            origin_chain: CHAIN_ID_SOLANA_DEVNET,
            origin_token_id: final_token_id,
            mint: ctx.accounts.mint.key(),
            metadata_uri: uri,
        });
        
        Ok(())
    }

    pub fn initiate_cross_chain_transfer(
        ctx: Context<CrossChainTransfer>,
        _token_id: u64,
        zrc20_address: [u8; 20], // Change parameter to ZRC-20 address
        destination_owner: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, ErrorCode::ProgramPaused);
        
        let program_state = &ctx.accounts.program_state;
        let nft_origin = &ctx.accounts.nft_origin;
        
        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        
        anchor_spl::token::burn(burn_ctx, 1)?;
        
        let receiver_evm: [u8; 20] = destination_owner[0..20].try_into().unwrap();
        let sender_evm = [0u8; 20]; // Not used for Solana-originated transfers
        
        let message_data = abi_encode_message(
            zrc20_address,
            receiver_evm,
            nft_origin.token_id,
            nft_origin.metadata_uri.clone(),
            sender_evm
        );
        
        // Use the provided destination contract/address as the receiver for the gateway call
        call_gateway(
            ctx.accounts.gateway_program.to_account_info(),
            ctx.accounts.user.to_account_info(),
            zrc20_address,
            message_data,
        )?;
        
        emit!(CrossChainTransferInitiated {
            token_id: nft_origin.token_id,
            destination_chain: 0, // Will be determined by ZRC-20 address
            destination_owner,
            mint: ctx.accounts.mint.key(),
        });
        
        Ok(())
    }

    pub fn receive_cross_chain_message(
        ctx: Context<ReceiveCrossChainMessage>,
        _token_id: u64,
        message: Vec<u8>,
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, ErrorCode::ProgramPaused);
        
        // Decode ABI-encoded message (address, uint256, string, uint256, address)
        // Layout (32-byte words):
        // 0: destination (address padded)
        // 1: receiver (address padded)
        // 2: token_id (uint256)
        // 3: uri (offset as uint256)
        // 4: sender (address padded)
        // Then at uri_offset: [len (uint256), bytes..., padding]
        let receiver_evm: [u8; 20] = message[44..64].try_into().unwrap();
        let token_id = u64::from_be_bytes(message[96..104].try_into().unwrap());
        let uri_offset = u64::from_be_bytes(message[128..136].try_into().unwrap()) as usize;
        let uri_length = u64::from_be_bytes(message[uri_offset..uri_offset + 8].try_into().unwrap()) as usize;
        let uri = String::from_utf8(message[uri_offset + 8..uri_offset + 8 + uri_length].to_vec()).unwrap();
        
        let recipient_pubkey = Pubkey::new_from_array({
            let mut recipient = [0u8; 32];
            recipient[12..32].copy_from_slice(&receiver_evm);
            recipient
        });

        let _program_state = &mut ctx.accounts.program_state;

        let nft_origin = &mut ctx.accounts.nft_origin;
        nft_origin.token_id = token_id;
        nft_origin.origin_chain = CHAIN_ID_ZETACHAIN_TESTNET;
        nft_origin.origin_token_id = token_id;
        nft_origin.metadata_uri = uri.clone();
        nft_origin.mint = ctx.accounts.mint.key();
        nft_origin.created_at = Clock::get()?.unix_timestamp;
        nft_origin.bump = ctx.bumps.nft_origin;

        let mint_to_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
        );
        
        anchor_spl::token::mint_to(mint_to_ctx, 1)?;

        emit!(CrossChainMessageReceived {
            token_id,
            origin_chain: CHAIN_ID_ZETACHAIN_TESTNET,
            mint: ctx.accounts.mint.key(),
            recipient: recipient_pubkey,
        });

        Ok(())
    }

    pub fn pause(ctx: Context<AdminAction>) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.program_state.owner,
            ErrorCode::Unauthorized
        );
        
        ctx.accounts.program_state.paused = true;
        
        emit!(ProgramPaused {
            admin: ctx.accounts.admin.key(),
        });
        
        Ok(())
    }


    pub fn unpause(ctx: Context<AdminAction>) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.program_state.owner,
            ErrorCode::Unauthorized
        );
        
        ctx.accounts.program_state.paused = false;
        
        emit!(ProgramUnpaused {
            admin: ctx.accounts.admin.key(),
        });
        
        Ok(())
    }
}

#[account]
pub struct ProgramState {
    pub owner: Pubkey,
    pub gateway: Pubkey,
    pub universal_nft_contract: [u8; 20], 
    pub next_token_id: u64,
    pub paused: bool,
    pub bump: u8,
}

#[account]
pub struct NFTOrigin {
    pub token_id: u64,
    pub origin_chain: u64,
    pub origin_token_id: u64,
    pub metadata_uri: String,
    pub mint: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        // 8 (disc) + 32 (owner) + 32 (gateway) + 20 (universal_nft_contract) + 8 (next_token_id) + 1 (paused) + 1 (bump)
        space = 8 + 32 + 32 + 20 + 8 + 1 + 1,
        seeds = [b"test_program_state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(uri: String, decimals: u8, token_id: u64)]
pub struct CreateMintAndNFT<'info> {
    #[account(
        mut,
        seeds = [b"test_program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    
    /// CHECK: This account will be created by the program using CPI
    #[account(mut)]
    pub nft_origin: AccountInfo<'info>,
    
    #[account(
        init,
        payer = payer,
        mint::decimals = decimals,
        mint::authority = mint_authority.key(),
        mint::freeze_authority = mint_authority.key(),
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = mint_authority,
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    pub mint_authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    
    /// CHECK: Verified by address constraint to the Token Metadata program ID
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: AccountInfo<'info>,
    
    /// CHECK: PDA derived off-chain by the client per Metaplex conventions; only used by CPI
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), mint.key().as_ref()],
        seeds::program = token_metadata_program.key(),
        bump
    )]
    pub metadata: AccountInfo<'info>,
    
    /// CHECK: PDA derived off-chain by the client per Metaplex conventions; only used by CPI
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), mint.key().as_ref(), b"edition"],
        seeds::program = token_metadata_program.key(),
        bump
    )]
    pub master_edition: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(token_id: u64)]
pub struct CrossChainTransfer<'info> {
    #[account(
        seeds = [b"test_program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(
        seeds = [&nft_origin_seed(token_id)],
        bump = nft_origin.bump
    )]
    pub nft_origin: Account<'info, NFTOrigin>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    // Must be the caller's ATA for this mint
    #[account(
        mut,
        token::mint = mint,
        token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    /// CHECK: External program account; only its pubkey is used to invoke CPI
    pub gateway_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(token_id: u64)]
pub struct ReceiveCrossChainMessage<'info> {
    #[account(
        mut,
        seeds = [b"test_program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(
        init,
        payer = payer,
        space = 8 + 8 + 2 + 8 + 4 + 32 + 8 + 1 + 500, // 8 (discriminator) + 8 (token_id) + 2 (origin_chain) + 8 (origin_token_id) + 4 (String length) + 500 (String content) + 32 (mint) + 8 (created_at) + 1 (bump)
        seeds = [&nft_origin_seed(token_id)],
        bump
    )]
    pub nft_origin: Account<'info, NFTOrigin>,
    // Use strong types and create ATA idempotently for the recipient
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    pub mint_authority: Signer<'info>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = mint_authority,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(
        mut,
        seeds = [b"test_program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    pub admin: Signer<'info>,
}

// Data Structures
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CrossChainMessage {
    pub token_id: u64,
    pub origin_chain: u64,
    pub origin_token_id: u64,
    pub metadata_uri: String,
    pub recipient: [u8; 32],
}

// Events
#[event]
pub struct ProgramInitialized {
    pub owner: Pubkey,
    pub gateway: Pubkey,
    pub initial_token_id: u64,
}

#[event]
pub struct NFTOriginCreated {
    pub token_id: u64,
    pub origin_chain: u64,
    pub origin_token_id: u64,
    pub mint: Pubkey,
    pub metadata_uri: String,
}

#[event]
pub struct NFTMinted {
    pub token_id: u64,
    pub mint: Pubkey,
    pub metadata_uri: String,
}

#[event]
pub struct CrossChainTransferInitiated {
    pub token_id: u64,
    pub destination_chain: u64,
    pub destination_owner: [u8; 32],
    pub mint: Pubkey,
}

#[event]
pub struct CrossChainMessageReceived {
    pub token_id: u64,
    pub origin_chain: u64,
    pub mint: Pubkey,
    pub recipient: Pubkey,
}

#[event]
pub struct ProgramPaused {
    pub admin: Pubkey,
}

#[event]
pub struct ProgramUnpaused {
    pub admin: Pubkey,
}

#[event]
pub struct MintCreated {
    pub mint: Pubkey,
    pub mint_authority: Pubkey,
    pub decimals: u8,
    pub token_id: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Program is currently paused")]
    ProgramPaused,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Invalid cross-chain message")]
    InvalidCrossChainMessage,
    #[msg("NFT origin not found")]
    NFTOriginNotFound,
    #[msg("Insufficient tokens")]
    InsufficientTokens,
    #[msg("Token ID overflow")]
    TokenIdOverflow,
    #[msg("Next token id mismatch between client and program state")]
    NextTokenIdMismatch,
}