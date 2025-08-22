use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Mint, Token, TokenAccount, MintTo, Burn},
    associated_token::AssociatedToken,
};
use anchor_lang::solana_program::rent::Rent;
use mpl_token_metadata::instructions::{
    CreateMetadataAccountV3CpiBuilder,
    CreateMasterEditionV3CpiBuilder,
};
use mpl_token_metadata::types::{DataV2, Creator, Collection, Uses};
use std::str::FromStr;

use crate::*;

/// Main Universal NFT implementation for Solana
/// This provides ERC721-like functionality with cross-chain transfer capabilities
pub struct UniversalNFT;

impl UniversalNFT {
    /// Initialize the Universal NFT contract
    pub fn initialize(
        ctx: Context<Initialize>,
        gateway: Pubkey,
        next_token_id: u64,
        universal_nft_contract: [u8; 20],
        gas_limit: u64,
        uniswap_router: Pubkey,
    ) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        
        // Hardcode the admin address
        program_state.owner = Pubkey::from_str("F79VcAwM6VhL9CaZo68W1SwrkntLJpAhcbTLLzuz4g3G").unwrap();
        program_state.gateway = gateway;
        program_state.universal_nft_contract = universal_nft_contract;
        program_state.next_token_id = next_token_id;
        program_state.paused = false;
        program_state.bump = ctx.bumps.program_state;
        program_state.gas_limit = gas_limit;
        program_state.uniswap_router = uniswap_router;
        
        emit!(ProgramInitialized {
            owner: program_state.owner,
            gateway,
            initial_token_id: next_token_id,
            gas_limit,
            uniswap_router,
        });
        
        Ok(())
    }

    /// Create mint and NFT function
    pub fn create_mint_and_nft(
        ctx: Context<CreateMintAndNFT>,
        uri: String,
        decimals: u8,
        token_id: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, crate::ErrorCode::ProgramPaused);
        
        let program_state = &mut ctx.accounts.program_state;
        let clock = Clock::get()?;

        // Validate that the provided token_id matches the expected next_token_id
        require_eq!(token_id, program_state.next_token_id, crate::ErrorCode::NextTokenIdMismatch);

        // Step 1: Create mint account (this is handled by the account constraint)
        // The mint account is already initialized by the account constraint
        
        // Step 2: Mint NFT and create metadata
        let final_token_id = generate_token_id(
            &ctx.accounts.mint.key(),
            program_state.next_token_id
        );
        
        // Increment the token ID counter
        program_state.next_token_id = program_state.next_token_id.checked_add(1)
            .ok_or(crate::ErrorCode::TokenIdOverflow)?;
        
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
        
        // Step 3: Initialize NFT origin record (automatically handled by Anchor)
        ctx.accounts.nft_origin.token_id = final_token_id;
        ctx.accounts.nft_origin.origin_chain = CHAIN_ID_SOLANA_DEVNET;
        ctx.accounts.nft_origin.origin_token_id = final_token_id;
        ctx.accounts.nft_origin.metadata_uri = uri.clone();
        ctx.accounts.nft_origin.mint = ctx.accounts.mint.key();
        ctx.accounts.nft_origin.created_at = clock.unix_timestamp;
        ctx.accounts.nft_origin.bump = ctx.bumps.nft_origin;
        
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

    /// Transfer NFT cross-chain
    pub fn transfer_cross_chain(
        ctx: Context<CrossChainTransfer>,
        token_id: u64,
        receiver: [u8; 20],
        destination: [u8; 20],
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, crate::ErrorCode::ProgramPaused);
        
        let program_state = &ctx.accounts.program_state;
        let nft_origin = &ctx.accounts.nft_origin;
        
        // Burn the NFT on Solana
        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        
        anchor_spl::token::burn(burn_ctx, 1)?;
        
        // Encode the cross-chain message
        let message_data = UniversalNFTCoreImpl::encode_cross_chain_message(
            receiver,
            nft_origin.token_id,
            nft_origin.metadata_uri.clone(),
            [0u8; 20], // Solana doesn't have EVM-style addresses
        );
        
        // Call the ZetaChain gateway
        UniversalNFTCoreImpl::call_gateway(
            ctx.accounts.gateway_program.to_account_info(),
            ctx.accounts.user.to_account_info(),
            destination,
            message_data,
        )?;
        
        emit!(CrossChainTransferInitiated {
            token_id: nft_origin.token_id,
            destination_chain: 0, // Will be determined by destination
            destination_owner: receiver,
            mint: ctx.accounts.mint.key(),
        });
        
        Ok(())
    }

    /// Receive cross-chain message and mint NFT
    pub fn receive_cross_chain_message(
        ctx: Context<ReceiveCrossChainMessage>,
        token_id: u64,
        message: Vec<u8>,
    ) -> Result<()> {
        require!(!ctx.accounts.program_state.paused, crate::ErrorCode::ProgramPaused);
        
        // Decode the cross-chain message
        let (decoded_token_id, uri, sender) = UniversalNFTCoreImpl::decode_cross_chain_message(&message)?;
        
        // Validate token ID
        require_eq!(decoded_token_id, token_id, crate::ErrorCode::InvalidCrossChainMessage);
        
        let _program_state = &mut ctx.accounts.program_state;

        let nft_origin = &mut ctx.accounts.nft_origin;
        nft_origin.token_id = token_id;
        nft_origin.origin_chain = CHAIN_ID_ZETACHAIN_TESTNET;
        nft_origin.origin_token_id = token_id;
        nft_origin.metadata_uri = uri.clone();
        nft_origin.mint = ctx.accounts.mint.key();
        nft_origin.created_at = Clock::get()?.unix_timestamp;
        nft_origin.bump = ctx.bumps.nft_origin;

        // Mint the NFT to the recipient
        let mint_to_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
        );
        
        anchor_spl::token::mint_to(mint_to_ctx, 1)?;

        // Convert EVM address to Solana pubkey
        let recipient_pubkey = Pubkey::new_from_array({
            let mut recipient = [0u8; 32];
            recipient[12..32].copy_from_slice(&sender);
            recipient
        });

        emit!(CrossChainMessageReceived {
            token_id,
            origin_chain: CHAIN_ID_ZETACHAIN_TESTNET,
            mint: ctx.accounts.mint.key(),
            recipient: recipient_pubkey,
        });

        Ok(())
    }

    /// Set gateway address (admin only)
    pub fn set_gateway(ctx: Context<AdminAction>, gateway: Pubkey) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.program_state.owner,
            crate::ErrorCode::Unauthorized
        );
        
        ctx.accounts.program_state.gateway = gateway;
        
        emit!(GatewayUpdated {
            admin: ctx.accounts.admin.key(),
            gateway,
        });
        
        Ok(())
    }

    /// Set gas limit (admin only)
    pub fn set_gas_limit(ctx: Context<AdminAction>, gas_limit: u64) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.program_state.owner,
            crate::ErrorCode::Unauthorized
        );
        
        require!(gas_limit > 0, UniversalNFTCoreError::InvalidGasLimit);
        
        ctx.accounts.program_state.gas_limit = gas_limit;
        
        emit!(GasLimitUpdated {
            admin: ctx.accounts.admin.key(),
            gas_limit,
        });
        
        Ok(())
    }

    /// Set connected contract mapping (admin only)
    pub fn set_connected_contract(
        ctx: Context<AdminAction>,
        zrc20: [u8; 20],
        contract_address: Vec<u8>,
    ) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.admin.key(),
            crate::ErrorCode::Unauthorized
        );
        
        require!(!contract_address.is_empty(), UniversalNFTCoreError::InvalidDestination);
        
        // Store connected contract mapping
        let connected_contract = ConnectedContract {
            zrc20,
            contract_address: contract_address.clone(),
        };
        
        // This would typically be stored in a separate account or mapping
        // For now, we'll emit an event
        emit!(ConnectedContractSet {
            admin: ctx.accounts.admin.key(),
            zrc20,
            contract_address,
        });
        
        Ok(())
    }

    /// Pause the program (admin only)
    pub fn pause(ctx: Context<AdminAction>) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.program_state.owner,
            crate::ErrorCode::Unauthorized
        );
        
        ctx.accounts.program_state.paused = true;
        
        emit!(ProgramPaused {
            admin: ctx.accounts.admin.key(),
        });
        
        Ok(())
    }

    /// Unpause the program (admin only)
    pub fn unpause(ctx: Context<AdminAction>) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.program_state.owner,
            crate::ErrorCode::Unauthorized
        );
        
        ctx.accounts.program_state.paused = false;
        
        emit!(ProgramUnpaused {
            admin: ctx.accounts.admin.key(),
        });
        
        Ok(())
    }

    /// Update universal NFT contract address (admin only)
    pub fn set_universal_nft_contract(
        ctx: Context<AdminAction>,
        universal_nft_contract: [u8; 20],
    ) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.program_state.owner,
            crate::ErrorCode::Unauthorized
        );
        
        ctx.accounts.program_state.universal_nft_contract = universal_nft_contract;
        
        emit!(UniversalNFTContractUpdated {
            admin: ctx.accounts.admin.key(),
            universal_nft_contract,
        });
        
        Ok(())
    }

    /// Migrate program state to new structure (for backward compatibility)
    pub fn migrate_program_state(
        ctx: Context<MigrateProgramState>,
    ) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        
        // Check if migration is needed (if gas_limit is 0, it means it's the old structure)
        if program_state.gas_limit == 0 {
            // Set default values for new fields
            program_state.gas_limit = 1000000; // Default gas limit
            program_state.uniswap_router = Pubkey::default(); // Default router address
            
            emit!(ProgramStateMigrated {
                admin: ctx.accounts.payer.key(),
                gas_limit: program_state.gas_limit,
                uniswap_router: program_state.uniswap_router,
            });
        }
        
        Ok(())
    }
}

// Additional events for the Universal NFT implementation
#[event]
pub struct GatewayUpdated {
    pub admin: Pubkey,
    pub gateway: Pubkey,
}

#[event]
pub struct GasLimitUpdated {
    pub admin: Pubkey,
    pub gas_limit: u64,
}

#[event]
pub struct ConnectedContractSet {
    pub admin: Pubkey,
    pub zrc20: [u8; 20],
    pub contract_address: Vec<u8>,
}

#[event]
pub struct UniversalNFTContractUpdated {
    pub admin: Pubkey,
    pub universal_nft_contract: [u8; 20],
}
