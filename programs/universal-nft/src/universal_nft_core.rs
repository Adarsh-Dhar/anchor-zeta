use anchor_lang::prelude::*;

#[error_code]
pub enum UniversalNFTCoreError {
    #[msg("Invalid cross-chain message")]
    InvalidCrossChainMessage,
    #[msg("Unauthorized sender")]
    UnauthorizedSender,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Invalid destination")]
    InvalidDestination,
    #[msg("Transfer failed")]
    TransferFailed,
    #[msg("Invalid gas limit")]
    InvalidGasLimit,
    #[msg("Invalid address provided")]
    InvalidAddress,
    #[msg("Invalid URI encoding")]
    InvalidUriEncoding,
    #[msg("Invalid message format")]
    InvalidMessageFormat,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Gateway call failed")]
    GatewayCallFailed,
}

pub trait UniversalNFTCore {
    /// Initialize the core functionality
    fn initialize_core(
        &mut self,
        gateway: Pubkey,
        gas_limit: u64,
        uniswap_router: Pubkey,
    ) -> Result<()>;

    /// Set the gateway address
    fn set_gateway(&mut self, gateway: Pubkey) -> Result<()> {
        require!(!gateway.to_bytes().iter().all(|&x| x == 0), UniversalNFTCoreError::InvalidAddress);
        Ok(())
    }

    /// Set the gas limit for cross-chain operations
    /// Only callable by contract owner
    /// @param gas_limit New gas limit value
    fn set_gas_limit(&mut self, gas_limit: u64) -> Result<()> {
        require!(gas_limit > 0, UniversalNFTCoreError::InvalidGasLimit);
        Ok(())
    }

    /// Links a ZRC-20 gas token address to an NFT contract on the corresponding chain
    /// Only callable by contract owner
    /// @param zrc20 Address of the ZRC-20 token
    /// @param contract_address Address of the corresponding contract
    fn set_connected(&mut self, zrc20: [u8; 20], contract_address: Vec<u8>) -> Result<()>;

    /// Get token URI for a given token ID
    fn token_uri(&self, token_id: u64) -> Result<String>;

    /// Burn an NFT token
    fn burn(&mut self, token_id: u64) -> Result<()>;

    /// Mint a new NFT token
    fn mint(&mut self, receiver: [u8; 20], token_id: u64) -> Result<()>;

    /// Set token URI for a given token ID
    fn set_token_uri(&mut self, token_id: u64, uri: String) -> Result<()>;

    /// Get connected contract address for a ZRC-20 token
    fn get_connected_contract(&self, zrc20: [u8; 20]) -> Result<[u8; 20]>;

    /// Get gas fee for destination chain
    fn get_gas_fee(&self, destination: [u8; 20]) -> Result<([u8; 20], u64)>;

    /// Swap tokens using Uniswap
    fn swap_tokens(&mut self, zrc20: [u8; 20], amount: u64, destination: [u8; 20]) -> Result<u64>;

    /// Approve gateway for token transfer
    fn approve_gateway(&mut self, destination: [u8; 20], amount: u64) -> Result<()>;

    /// Send gateway message
    fn send_gateway_message(
        &mut self,
        destination: [u8; 20],
        amount: u64,
        receiver: [u8; 20],
        token_id: u64,
        uri: String,
        sender: [u8; 20],
    ) -> Result<()>;

    /// Call gateway for cross-chain operations
    fn call_gateway(&mut self, destination: [u8; 20], message: Vec<u8>) -> Result<()>;

    /// Emit transfer event
    fn emit_transfer_event(
        &self,
        receiver: [u8; 20],
        destination: [u8; 20],
        token_id: u64,
        uri: String,
    ) -> Result<()>;

    /// Emit token received event
    fn emit_token_received_event(
        &self,
        receiver: [u8; 20],
        token_id: u64,
        uri: String,
    ) -> Result<()>;

    /// Emit transfer destination event
    fn emit_transfer_destination_event(
        &self,
        receiver: [u8; 20],
        destination: [u8; 20],
        token_id: u64,
        uri: String,
    ) -> Result<()>;

    /// Encode cross-chain message
    fn encode_cross_chain_message(
        &self,
        receiver: [u8; 20],
        token_id: u64,
        uri: String,
        sender: [u8; 20],
    ) -> Result<Vec<u8>>;

    /// Decode cross-chain message
    fn decode_cross_chain_message(&self, message: &[u8]) -> Result<([u8; 20], [u8; 20], u64, String, [u8; 20])>;

    /// Transfer NFT cross-chain
    /// @notice Transfers an NFT to another chain through the ZetaChain gateway
    /// @param token_id The ID of the NFT to transfer
    /// @param receiver Address of the recipient on the destination chain
    /// @param destination Address of the ZRC-20 gas token for the destination chain
    /// @return Result indicating success or failure
    fn transfer_cross_chain(
        &mut self,
        token_id: u64,
        receiver: [u8; 20],
        destination: [u8; 20],
    ) -> Result<()> {
        // Validate inputs
        require!(!receiver.iter().all(|&x| x == 0), UniversalNFTCoreError::InvalidAddress);
        require!(!destination.iter().all(|&x| x == 0), UniversalNFTCoreError::InvalidAddress);

        // Get URI and encode message
        let uri = self.token_uri(token_id)?;
        let message = self.encode_cross_chain_message(receiver, token_id, uri.clone(), [0u8; 20])?;

        // Burn the NFT
        self.burn(token_id)?;

        // Call gateway with message
        self.call_gateway(destination, message)?;

        // Emit transfer event
        self.emit_transfer_event(receiver, destination, token_id, uri)?;

        Ok(())
    }

    /// Handle cross-chain message reception
    /// @notice Handles cross-chain NFT transfers
    /// @dev This function is called by the Gateway contract upon receiving a message.
    ///      If the destination is ZetaChain, mint an NFT and set its URI.
    ///      If the destination is another chain, swap the gas token for the corresponding
    ///      ZRC-20 token and use the Gateway to send a message to mint an NFT on the
    ///      destination chain.
    /// @param context Message context metadata
    /// @param zrc20 ZRC-20 token address
    /// @param amount Amount of token provided
    /// @param message Encoded payload containing NFT metadata
    fn on_cross_chain_message(
        &mut self,
        context: CrossChainMessageContext,
        zrc20: [u8; 20],
        amount: u64,
        message: Vec<u8>,
    ) -> Result<()>;

    /// Handle cross-chain call failure
    fn on_revert(&mut self, context: RevertContext) -> Result<()>;

    /// Handle cross-chain abort
    fn on_abort(&mut self, context: AbortContext) -> Result<()>;
}

// Remove the generic implementation - we'll implement specifically for UniversalNFT

/// Cross-chain message context
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CrossChainMessageContext {
    pub sender: [u8; 20],
    pub destination: [u8; 20],
    pub gas_limit: u64,
    pub gas_price: u64,
}

/// Revert context for failed cross-chain calls
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RevertContext {
    pub asset: [u8; 20],
    pub amount: u64,
    pub revert_message: Vec<u8>,
}

/// Abort context for failed cross-chain calls
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AbortContext {
    pub outgoing: [u8; 20],
    pub asset: [u8; 20],
    pub amount: u64,
    pub revert_message: Vec<u8>,
}

/// Connected contract mapping
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConnectedContract {
    pub zrc20: [u8; 20],
    pub contract_address: Vec<u8>,
}

/// Core implementation for Universal NFT functionality
pub struct UniversalNFTCoreImpl;

impl UniversalNFTCoreImpl {
    /// Encode message for cross-chain transfer
    pub fn encode_cross_chain_message(
        receiver: [u8; 20],
        token_id: u64,
        uri: String,
        sender: [u8; 20],
    ) -> Vec<u8> {
        let mut message = Vec::new();
        
        // receiver (address)
        message.extend_from_slice(&[0u8; 12]);
        message.extend_from_slice(&receiver);
        
        // tokenId (uint256)
        let mut token_id_bytes = [0u8; 32];
        token_id_bytes[24..32].copy_from_slice(&token_id.to_be_bytes());
        message.extend_from_slice(&token_id_bytes);
        
        // uri offset (uint256)
        let offset = 96u64;
        message.extend_from_slice(&offset.to_be_bytes());
        
        // sender (address)
        message.extend_from_slice(&[0u8; 12]);
        message.extend_from_slice(&sender);
        
        // uri length and data
        let uri_len = uri.len() as u64;
        message.extend_from_slice(&uri_len.to_be_bytes());
        message.extend_from_slice(&uri.as_bytes());
        
        // padding
        let padding = (32 - (uri.len() % 32)) % 32;
        message.extend_from_slice(&vec![0u8; padding]);
        
        message
    }

    /// Decode cross-chain message
    pub fn decode_cross_chain_message(message: &[u8]) -> Result<([u8; 20], [u8; 20], u64, String, [u8; 20])> {
        if message.len() < 96 {
            return Err(UniversalNFTCoreError::InvalidMessageFormat.into());
        }

        let receiver = message[12..32].try_into()
            .map_err(|_| UniversalNFTCoreError::InvalidMessageFormat)?;
        
        let token_id = u64::from_be_bytes(
            message[32..40].try_into()
                .map_err(|_| UniversalNFTCoreError::InvalidMessageFormat)?
        );
        
        let uri_offset = u64::from_be_bytes(
            message[64..72].try_into()
                .map_err(|_| UniversalNFTCoreError::InvalidMessageFormat)?
        ) as usize;
        
        if message.len() < uri_offset + 8 {
            return Err(UniversalNFTCoreError::InvalidMessageFormat.into());
        }

        let uri_length = u64::from_be_bytes(
            message[uri_offset..uri_offset + 8].try_into()
                .map_err(|_| UniversalNFTCoreError::InvalidMessageFormat)?
        ) as usize;
        
        if message.len() < uri_offset + 8 + uri_length {
            return Err(UniversalNFTCoreError::InvalidMessageFormat.into());
        }

        let uri = String::from_utf8(
            message[uri_offset + 8..uri_offset + 8 + uri_length].to_vec()
        ).map_err(|_| UniversalNFTCoreError::InvalidUriEncoding)?;

        let sender = message[80..100].try_into()
            .map_err(|_| UniversalNFTCoreError::InvalidMessageFormat)?;

        // For now, we'll use a default destination (this should be passed in the message)
        let destination = [0u8; 20];

        Ok((destination, receiver, token_id, uri, sender))
    }

    /// Call ZetaChain gateway with proper parameters
    pub fn call_gateway<'a>(
        gateway_program: AccountInfo<'a>,
        signer: AccountInfo<'a>,
        destination: [u8; 20],
        message: Vec<u8>,
    ) -> Result<()> {
        // This should match the ZetaChain gateway call format
        // Similar to: gateway.call(connected[destination], destination, message, callOptions, revertOptions)
        
        let mut instruction_data = Vec::new();
        
        // Add gateway-specific instruction data
        instruction_data.extend_from_slice(&Self::instruction_discriminator("call"));
        instruction_data.extend_from_slice(&destination);
        instruction_data.extend_from_slice(&(message.len() as u32).to_le_bytes());
        instruction_data.extend_from_slice(&message);
        
        // Add call options (gas limit, etc.)
        let gas_limit = 1000000u64; // Set appropriate gas limit
        instruction_data.extend_from_slice(&gas_limit.to_le_bytes());
        
        // Add revert options
        instruction_data.push(1u8); // Enable revert handling
        
        let metas = vec![
            AccountMeta::new(signer.key(), true),
            AccountMeta::new_readonly(gateway_program.key(), false),
        ];
        
        let infos = vec![signer.clone(), gateway_program.clone()];
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::instruction::Instruction {
                program_id: gateway_program.key(),
                accounts: metas,
                data: instruction_data,
            },
            &infos,
        ).map_err(|_| UniversalNFTCoreError::GatewayCallFailed)?;
        
        Ok(())
    }

    /// Generate instruction discriminator
    fn instruction_discriminator(name: &str) -> [u8; 8] {
        let mut discriminator = [0u8; 8];
        let preimage = format!("global:{}", name);
        let hash = anchor_lang::solana_program::hash::hashv(&[preimage.as_bytes()]);
        discriminator.copy_from_slice(&hash.to_bytes()[..8]);
        discriminator
    }
}
