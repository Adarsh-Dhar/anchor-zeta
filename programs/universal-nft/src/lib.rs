use anchor_lang::prelude::*;

declare_id!("3HMT1ceCh8QQjA8kGDDY13hVD8emCSrJY2aUNQYif9AY");

#[program]
pub mod crosschain_nft {
    use super::*;

    /// Initialize the cross-chain NFT program
    pub fn initialize(
        ctx: Context<Initialize>,
        owner: Pubkey,
        gateway: Pubkey,
        next_token_id: u64,
    ) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        program_state.owner = owner;
        program_state.gateway = gateway;
        program_state.next_token_id = next_token_id;
        program_state.paused = false;
        program_state.bump = ctx.bumps.program_state;
        
        emit!(ProgramInitialized {
            owner,
            gateway,
            initial_token_id: next_token_id,
        });
        
        Ok(())
    }

    /// Create a new NFT origin record
    pub fn create_nft_origin(
        ctx: Context<CreateNFTOrigin>,
        token_id: u64,
        origin_chain: u16,
        origin_token_id: u64,
        metadata_uri: String,
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, ErrorCode::ProgramPaused);
        
        let nft_origin = &mut ctx.accounts.nft_origin;
        nft_origin.token_id = token_id;
        nft_origin.origin_chain = origin_chain;
        nft_origin.origin_token_id = origin_token_id;
        nft_origin.metadata_uri = metadata_uri;
        nft_origin.mint = ctx.accounts.mint.key();
        nft_origin.created_at = Clock::get()?.unix_timestamp;
        nft_origin.bump = ctx.bumps.nft_origin;

        emit!(NFTOriginCreated {
            token_id,
            origin_chain,
            origin_token_id,
            mint: ctx.accounts.mint.key(),
            metadata_uri: nft_origin.metadata_uri.clone(),
        });

        Ok(())
    }

    /// Initiate cross-chain transfer
    pub fn initiate_cross_chain_transfer(
        ctx: Context<CrossChainTransfer>,
        destination_chain: u16,
        destination_owner: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, ErrorCode::ProgramPaused);
        
        let nft_origin = &ctx.accounts.nft_origin;
        
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
        message: Vec<u8>,
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, ErrorCode::ProgramPaused);
        
        // Parse the cross-chain message
        let cross_chain_message: CrossChainMessage = CrossChainMessage::try_from_slice(&message)?;
        
        let program_state = &mut ctx.accounts.program_state;
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
        seeds = [b"program_state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateNFTOrigin<'info> {
    #[account(
        mut,
        seeds = [b"program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(
        init,
        payer = payer,
        space = 8 + 8 + 2 + 8 + 4 + 32 + 8 + 1, // 4 bytes for String length
        seeds = [b"nft_origin", &[0u8; 10]],
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
pub struct CrossChainTransfer<'info> {
    #[account(
        seeds = [b"program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(
        seeds = [b"nft_origin", &[0u8; 10]],
        bump = nft_origin.bump
    )]
    pub nft_origin: Account<'info, NFTOrigin>,
    /// CHECK: Mint account (placeholder)
    pub mint: AccountInfo<'info>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReceiveCrossChainMessage<'info> {
    #[account(
        mut,
        seeds = [b"program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(
        init,
        payer = payer,
        space = 8 + 8 + 2 + 8 + 4 + 32 + 8 + 1, // 4 bytes for String length
        seeds = [b"nft_origin", &[0u8; 10]], // Will be updated with actual token_id
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
        seeds = [b"program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    pub admin: Signer<'info>,
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
}
