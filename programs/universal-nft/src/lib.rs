use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Mint, Token, TokenAccount, MintTo, Burn},
};
use std::str::FromStr;

declare_id!("C2jwo1xMeUzb2Pb4xHU72yi4HrSzDdTZKXxtaJH6M5NX");

// Helper function to generate NFT origin seed
fn nft_origin_seed(token_id: u64) -> Vec<u8> {
    let mut seed = Vec::new();
    seed.extend_from_slice(b"nft_origin");
    seed.extend_from_slice(&token_id.to_le_bytes());
    seed
}

// Helper function to generate token ID: [mint pubkey + block.number + nextTokenId]
fn generate_token_id(mint: &Pubkey, block_number: u64, next_token_id: u64) -> u64 {
    let mut data = Vec::new();
    data.extend_from_slice(&mint.to_bytes());
    data.extend_from_slice(&block_number.to_le_bytes());
    data.extend_from_slice(&next_token_id.to_le_bytes());
    
    // Create a hash from the combined data
    let hash = anchor_lang::solana_program::hash::hash(&data);
    
    // Convert first 8 bytes to u64
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&hash.to_bytes()[..8]);
    u64::from_le_bytes(bytes)
}

#[program]
pub mod universal_nft {
    use super::*;

    /// Initialize the cross-chain NFT program
    pub fn initialize(
        ctx: Context<Initialize>,
        gateway: Pubkey,
        next_token_id: u64,
    ) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        // Hardcode the admin address
        program_state.owner = Pubkey::from_str("F79VcAwM6VhL9CaZo68W1SwrkntLJpAhcbTLLzuz4g3G").unwrap();
        program_state.gateway = gateway;
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

    /// Mint a new NFT on Solana
    pub fn mint_nft(
        ctx: Context<MintNFT>,
        uri: String,
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, ErrorCode::ProgramPaused);
        
        let program_state = &mut ctx.accounts.program_state;
        let clock = Clock::get()?;
        
        // Generate unique token ID
        let token_id = generate_token_id(
            &ctx.accounts.mint.key(),
            clock.slot,
            program_state.next_token_id
        );
        
        // Increment next token ID
        program_state.next_token_id = program_state.next_token_id.checked_add(1)
            .ok_or(ErrorCode::TokenIdOverflow)?;
        
        // Mint 1 token to the mint authority
        let mint_to_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
        );
        
        anchor_spl::token::mint_to(mint_to_ctx, 1)?;
        
        // Create NFT origin record
        let nft_origin = &mut ctx.accounts.nft_origin;
        nft_origin.token_id = token_id;
        nft_origin.origin_chain = 0; // 0 for Solana
        nft_origin.origin_token_id = token_id;
        nft_origin.metadata_uri = uri.clone();
        nft_origin.mint = ctx.accounts.mint.key();
        nft_origin.created_at = clock.unix_timestamp;
        nft_origin.bump = ctx.bumps.nft_origin;
        
        emit!(NFTMinted {
            token_id,
            mint: ctx.accounts.mint.key(),
            metadata_uri: uri,
        });
        
        Ok(())
    }

    /// Create a new mint for NFT
    pub fn create_mint(
        ctx: Context<CreateMint>,
        decimals: u8,
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, ErrorCode::ProgramPaused);
        
        let clock = Clock::get()?;
        
        // Initialize the mint account with the specified decimals
        // The mint account is already initialized by the account constraint
        // We just need to set the decimals and authorities
        
        // Create NFT origin record for the new mint
        let nft_origin = &mut ctx.accounts.nft_origin;
        nft_origin.token_id = ctx.accounts.program_state.next_token_id;
        nft_origin.origin_chain = 0; // 0 for Solana
        nft_origin.origin_token_id = ctx.accounts.program_state.next_token_id;
        nft_origin.metadata_uri = "".to_string(); // Will be set when minting
        nft_origin.mint = ctx.accounts.mint.key();
        nft_origin.created_at = clock.unix_timestamp;
        nft_origin.bump = ctx.bumps.nft_origin;
        
        // Increment next token ID
        ctx.accounts.program_state.next_token_id = ctx.accounts.program_state.next_token_id
            .checked_add(1)
            .ok_or(ErrorCode::TokenIdOverflow)?;
        
        emit!(MintCreated {
            mint: ctx.accounts.mint.key(),
            mint_authority: ctx.accounts.mint_authority.key(),
            decimals,
            token_id: nft_origin.token_id,
        });
        
        Ok(())
    }

    /// Create a new NFT origin record
    pub fn create_nft_origin(
        ctx: Context<CreateNFTOrigin>,
        _token_id: u64,
        origin_chain: u16,
        origin_token_id: u64,
        metadata_uri: String,
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, ErrorCode::ProgramPaused);
        
        let nft_origin = &mut ctx.accounts.nft_origin;
        nft_origin.token_id = _token_id;
        nft_origin.origin_chain = origin_chain;
        nft_origin.origin_token_id = origin_token_id;
        nft_origin.metadata_uri = metadata_uri;
        nft_origin.mint = ctx.accounts.mint.key();
        nft_origin.created_at = Clock::get()?.unix_timestamp;
        nft_origin.bump = ctx.bumps.nft_origin;

        emit!(NFTOriginCreated {
            token_id: _token_id,
            origin_chain,
            origin_token_id,
            mint: ctx.accounts.mint.key(),
            metadata_uri: nft_origin.metadata_uri.clone(),
        });

        Ok(())
    }

    /// Initiate cross-chain transfer (burn NFT)
    pub fn initiate_cross_chain_transfer(
        ctx: Context<CrossChainTransfer>,
        _token_id: u64,
        destination_chain: u16,
        destination_owner: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, ErrorCode::ProgramPaused);
        
        let nft_origin = &ctx.accounts.nft_origin;
        
        // Burn the NFT token
        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        
        anchor_spl::token::burn(burn_ctx, 1)?;
        
        // Create cross-chain message
        let _cross_chain_message = CrossChainMessage {
            token_id: nft_origin.token_id,
            origin_chain: nft_origin.origin_chain,
            origin_token_id: nft_origin.origin_token_id,
            metadata_uri: nft_origin.metadata_uri.clone(),
            recipient: destination_owner,
        };

        // Here you would call the Gateway's deposit_and_call instruction
        // This is a placeholder for the actual Gateway CPI call
        emit!(CrossChainTransferInitiated {
            token_id: nft_origin.token_id,
            destination_chain,
            destination_owner,
            mint: ctx.accounts.mint.key(),
        });

        Ok(())
    }

    /// Handle incoming cross-chain message
    pub fn receive_cross_chain_message(
        ctx: Context<ReceiveCrossChainMessage>,
        _token_id: u64,
        message: Vec<u8>,
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, ErrorCode::ProgramPaused);
        
        // Parse the cross-chain message
        let cross_chain_message: CrossChainMessage = CrossChainMessage::try_from_slice(&message)?;
        
        let _program_state = &mut ctx.accounts.program_state;
        let token_id = cross_chain_message.token_id;

        // Create or update NFT origin record
        let nft_origin = &mut ctx.accounts.nft_origin;
        nft_origin.token_id = token_id;
        nft_origin.origin_chain = cross_chain_message.origin_chain;
        nft_origin.origin_token_id = cross_chain_message.origin_token_id;
        nft_origin.metadata_uri = cross_chain_message.metadata_uri.clone();
        nft_origin.mint = ctx.accounts.mint.key();
        nft_origin.created_at = Clock::get()?.unix_timestamp;
        nft_origin.bump = ctx.bumps.nft_origin;

        // Convert [u8; 32] to Pubkey for the recipient
        let recipient_pubkey = Pubkey::new_from_array(cross_chain_message.recipient);

        emit!(CrossChainMessageReceived {
            token_id,
            origin_chain: cross_chain_message.origin_chain,
            mint: ctx.accounts.mint.key(),
            recipient: recipient_pubkey,
        });

        Ok(())
    }

    /// Pause the program
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

    /// Unpause the program
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

// Account Structures
#[account]
pub struct ProgramState {
    pub owner: Pubkey,
    pub gateway: Pubkey,
    pub next_token_id: u64,
    pub paused: bool,
    pub bump: u8,
}

#[account]
pub struct NFTOrigin {
    pub token_id: u64,
    pub origin_chain: u16,
    pub origin_token_id: u64,
    pub metadata_uri: String,
    pub mint: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

// Context Structures
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 8 + 1 + 1,
        seeds = [b"test_program_state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(uri: String)]
pub struct MintNFT<'info> {
    #[account(
        mut,
        seeds = [b"test_program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(
        init,
        payer = payer,
        space = 8 + 8 + 2 + 8 + 4 + 32 + 8 + 1 + 500,
        seeds = [b"nft_origin", &[0u8; 10]], // Placeholder seed, will be updated in instruction
        bump
    )]
    pub nft_origin: Account<'info, NFTOrigin>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    pub mint_authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(token_id: u64)]
pub struct CreateNFTOrigin<'info> {
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
    /// CHECK: Mint account (placeholder)
    pub mint: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
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
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
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
    /// CHECK: Mint account (placeholder)
    pub mint: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
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
#[instruction(decimals: u8)]
pub struct CreateMint<'info> {
    #[account(
        mut,
        seeds = [b"test_program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    
    #[account(
        init,
        payer = mint_authority,
        mint::decimals = decimals,
        mint::authority = mint_authority.key(),
        mint::freeze_authority = mint_authority.key(),
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = mint_authority,
        space = 8 + 8 + 2 + 8 + 4 + 32 + 8 + 1 + 500,
        seeds = [&nft_origin_seed(program_state.next_token_id)],
        bump
    )]
    pub nft_origin: Account<'info, NFTOrigin>,
    
    #[account(mut)]
    pub mint_authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Data Structures
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CrossChainMessage {
    pub token_id: u64,
    pub origin_chain: u16,
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
    pub origin_chain: u16,
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
    pub destination_chain: u16,
    pub destination_owner: [u8; 32],
    pub mint: Pubkey,
}

#[event]
pub struct CrossChainMessageReceived {
    pub token_id: u64,
    pub origin_chain: u16,
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

// Error Codes
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
}