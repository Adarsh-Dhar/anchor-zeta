use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Mint, Token, TokenAccount},
    associated_token::AssociatedToken,
};
 
use anchor_lang::solana_program::rent::Rent;

// Import our custom modules
pub mod universal_nft;
pub mod universal_nft_core;

// Re-export main types for easy access
pub use universal_nft::*;
pub use universal_nft_core::*;

declare_id!("7uVLXw3wQoGjFD1KVGdhFpiWHSwzQKEDASfKiQ8GrAWR");

// ZetaChain Gateway Program ID
pub const ZETA_GATEWAY_PROGRAM_ID: &str = "ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis";

// Chain ID Constants
pub const CHAIN_ID_SOLANA_DEVNET: u64 = 901;
pub const CHAIN_ID_ZETACHAIN_TESTNET: u64 = 7001;
pub const CHAIN_ID_ETHEREUM_SEPOLIA: u64 = 11155111;
pub const CHAIN_ID_BSC_TESTNET: u64 = 97;
pub const CHAIN_ID_POLYGON_AMOY: u64 = 80002;
pub const CHAIN_ID_ARBITRUM_SEPOLIA: u64 = 421614;
pub const CHAIN_ID_BITCOIN_TESTNET: u64 = 18332;
pub const CHAIN_ID_SOLANA: u64 = 0;

// Add these constants for ZetaChain integration
pub const ZETA_CHAIN_ID: u64 = 7001; // ZetaChain testnet
pub const ZETA_MAINNET_ID: u64 = 7000; // ZetaChain mainnet


// Utility functions
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
    next_token_id
}

// Main program module
#[program]
pub mod universal_nft_program {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        gateway: Pubkey,
        next_token_id: u64,
        universal_nft_contract: [u8; 20],
        gas_limit: u64,
        uniswap_router: Pubkey,
    ) -> Result<()> {
        universal_nft::UniversalNFT::initialize(
            ctx,
            gateway,
            next_token_id,
            universal_nft_contract,
            gas_limit,
            uniswap_router,
        )
    }

    pub fn create_mint_and_nft(
        ctx: Context<CreateMintAndNFT>,
        uri: String,
        decimals: u8,
        token_id: u64,
    ) -> Result<()> {
        universal_nft::UniversalNFT::create_mint_and_nft(ctx, uri, decimals, token_id)
    }

    pub fn transfer_cross_chain(
        ctx: Context<CrossChainTransfer>,
        token_id: u64,
        receiver: [u8; 20],
        destination: [u8; 20],
    ) -> Result<()> {
        universal_nft::UniversalNFT::transfer_cross_chain(ctx, token_id, receiver, destination)
    }

    pub fn receive_cross_chain_message(
        ctx: Context<ReceiveCrossChainMessage>,
        token_id: u64,
        message: Vec<u8>,
    ) -> Result<()> {
        universal_nft::UniversalNFT::receive_cross_chain_message(ctx, token_id, message)
    }

    pub fn set_gateway(ctx: Context<AdminAction>, gateway: Pubkey) -> Result<()> {
        universal_nft::UniversalNFT::set_gateway(ctx, gateway)
    }

    pub fn set_gas_limit(ctx: Context<AdminAction>, gas_limit: u64) -> Result<()> {
        universal_nft::UniversalNFT::set_gas_limit(ctx, gas_limit)
    }

    pub fn set_connected_contract(
        ctx: Context<AdminAction>,
        zrc20: [u8; 20],
        contract_address: Vec<u8>,
    ) -> Result<()> {
        universal_nft::UniversalNFT::set_connected_contract(ctx, zrc20, contract_address)
    }

    pub fn pause(ctx: Context<AdminAction>) -> Result<()> {
        universal_nft::UniversalNFT::pause(ctx)
    }

    pub fn unpause(ctx: Context<AdminAction>) -> Result<()> {
        universal_nft::UniversalNFT::unpause(ctx)
    }

    pub fn set_universal_nft_contract(
        ctx: Context<AdminAction>,
        universal_nft_contract: [u8; 20],
    ) -> Result<()> {
        universal_nft::UniversalNFT::set_universal_nft_contract(ctx, universal_nft_contract)
    }

    pub fn migrate_program_state(
        ctx: Context<MigrateProgramState>,
    ) -> Result<()> {
        universal_nft::UniversalNFT::migrate_program_state(ctx)
    }
}

// Account structures
#[account]
pub struct ProgramState {
    pub owner: Pubkey,
    pub gateway: Pubkey,
    pub universal_nft_contract: [u8; 20], 
    pub next_token_id: u64,
    pub paused: bool,
    pub bump: u8,
    pub gas_limit: u64,
    pub uniswap_router: Pubkey,
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

// Account validation structs
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 20 + 8 + 1 + 1 + 8 + 32, // Added gas_limit and uniswap_router
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
    
    #[account(
        init,
        payer = payer,
        space = 8 + 8 + 8 + 8 + 4 + 1000 + 32 + 8 + 1, // 8 (discriminator) + 8 (token_id) + 8 (origin_chain) + 8 (origin_token_id) + 4 (String length) + 1000 (String content max) + 32 (mint) + 8 (created_at) + 1 (bump)
        seeds = [&nft_origin_seed(token_id)],
        bump
    )]
    pub nft_origin: Account<'info, NFTOrigin>,
    
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
        space = 8 + 8 + 8 + 8 + 4 + 1000 + 32 + 8 + 1, // 8 (discriminator) + 8 (token_id) + 8 (origin_chain) + 8 (origin_token_id) + 4 (String length) + 1000 (String content max) + 32 (mint) + 8 (created_at) + 1 (bump)
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

#[derive(Accounts)]
pub struct MigrateProgramState<'info> {
    #[account(
        mut,
        seeds = [b"test_program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Events
#[event]
pub struct ProgramInitialized {
    pub owner: Pubkey,
    pub gateway: Pubkey,
    pub initial_token_id: u64,
    pub gas_limit: u64,
    pub uniswap_router: Pubkey,
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
    pub destination_owner: [u8; 20],
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

#[event]
pub struct ProgramStateMigrated {
    pub admin: Pubkey,
    pub gas_limit: u64,
    pub uniswap_router: Pubkey,
}

// Universal NFT Core Events (Solidity equivalent events)
#[event]
pub struct TokenTransfer {
    pub receiver: Pubkey,
    pub destination: [u8; 20],
    pub token_id: u64,
    pub uri: String,
}

#[event]
pub struct TokenTransferReceived {
    pub receiver: Pubkey,
    pub token_id: u64,
    pub uri: String,
}

#[event]
pub struct TokenTransferToDestination {
    pub receiver: Pubkey,
    pub destination: [u8; 20],
    pub token_id: u64,
    pub uri: String,
}

// Error codes
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