use anchor_lang::prelude::*;
use anchor_lang::prelude::*;

/// Core functionality for Universal NFTs on Solana
/// This provides cross-chain NFT transfer capabilities via ZetaChain Gateway
pub trait UniversalNFTCore {
    /// Initialize the core functionality
    fn initialize_core(
        &mut self,
        gateway: Pubkey,
        gas_limit: u64,
        uniswap_router: Pubkey,
    ) -> Result<()>;

    /// Set the gateway address
    fn set_gateway(&mut self, gateway: Pubkey) -> Result<()>;

    /// Set the gas limit for cross-chain operations
    fn set_gas_limit(&mut self, gas_limit: u64) -> Result<()>;

    /// Set connected contract mapping
    fn set_connected(&mut self, zrc20: [u8; 20], contract_address: Vec<u8>) -> Result<()>;

    /// Transfer NFT cross-chain
    fn transfer_cross_chain(
        &mut self,
        token_id: u64,
        receiver: [u8; 20],
        destination: [u8; 20],
    ) -> Result<()>;

    /// Handle cross-chain message reception
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
        message.extend_from_slice(uri.as_bytes());
        
        // padding
        let padding = (32 - (uri.len() % 32)) % 32;
        message.extend_from_slice(&vec![0u8; padding]);
        
        message
    }

    /// Decode cross-chain message
    pub fn decode_cross_chain_message(message: &[u8]) -> Result<(u64, String, [u8; 20])> {
        if message.len() < 96 {
            return Err(crate::ErrorCode::InvalidCrossChainMessage.into());
        }

        let token_id = u64::from_be_bytes(message[32..40].try_into().unwrap());
        let uri_offset = u64::from_be_bytes(message[64..72].try_into().unwrap()) as usize;
        
        if message.len() < uri_offset + 8 {
            return Err(crate::ErrorCode::InvalidCrossChainMessage.into());
        }

        let uri_length = u64::from_be_bytes(message[uri_offset..uri_offset + 8].try_into().unwrap()) as usize;
        
        if message.len() < uri_offset + 8 + uri_length {
            return Err(crate::ErrorCode::InvalidCrossChainMessage.into());
        }

        let uri = String::from_utf8(
            message[uri_offset + 8..uri_offset + 8 + uri_length].to_vec()
        ).map_err(|_| crate::ErrorCode::InvalidCrossChainMessage)?;

        let sender = message[80..100].try_into().unwrap();

        Ok((token_id, uri, sender))
    }

    /// Call ZetaChain gateway
    pub fn call_gateway<'a>(
        gateway_program: AccountInfo<'a>,
        signer: AccountInfo<'a>,
        receiver: [u8; 20],
        message: Vec<u8>,
    ) -> Result<()> {
        use anchor_lang::solana_program::instruction::AccountMeta;

        let mut instruction_data = Vec::new();
        instruction_data.extend_from_slice(&Self::instruction_discriminator("call"));
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

    /// Generate instruction discriminator
    fn instruction_discriminator(name: &str) -> [u8; 8] {
        let mut discriminator = [0u8; 8];
        let preimage = format!("global:{}", name);
        let hash = anchor_lang::solana_program::hash::hashv(&[preimage.as_bytes()]);
        discriminator.copy_from_slice(&hash.to_bytes()[..8]);
        discriminator
    }
}

/// Error codes for Universal NFT Core
#[error_code]
pub enum UniversalNFTCoreError {
    #[msg("Invalid cross-chain message")]
    InvalidCrossChainMessage,
    #[msg("Unauthorized sender")]
    UnauthorizedSender,
    #[msg("Invalid destination")]
    InvalidDestination,
    #[msg("Transfer failed")]
    TransferFailed,
    #[msg("Invalid gas limit")]
    InvalidGasLimit,
}
