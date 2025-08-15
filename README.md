# Universal NFT Program

A Solana program for cross-chain NFT operations, enabling NFTs to be minted on Solana and transferred to other blockchain networks.

## Features

- **NFT Minting**: Create new NFTs with Metaplex standard metadata and master edition accounts
- **Cross-Chain Transfer**: Transfer NFTs from Solana to other blockchain networks
- **Origin Tracking**: Maintain records of NFT origins across different chains
- **Program State Management**: Admin controls for pausing/unpausing operations

## Architecture

### Core Components

1. **Program State**: Central configuration including owner, gateway, and next token ID
2. **NFT Origin Records**: PDAs storing information about NFT origins and cross-chain transfers
3. **Cross-Chain Messages**: Structured data for communicating NFT transfers between chains

### Key Instructions

- `initialize`: Set up the program with owner and gateway
- `create_nft_origin`: Create a new NFT origin record
- `initiate_cross_chain_transfer`: Start a cross-chain transfer
- `receive_cross_chain_message`: Handle incoming cross-chain messages
- `pause`/`unpause`: Admin controls

## Testing

The test suite covers all major functionality and integration scenarios:

### Test Categories

1. **Program Initialization**: Basic setup and configuration
2. **NFT Minting**: Complete NFT creation flow with metadata
3. **Cross-Chain Operations**: Transfer initiation and message handling
4. **Admin Functions**: Pause/unpause functionality
5. **Error Handling**: Validation and security checks
6. **Integration Tests**: End-to-end NFT lifecycle

### Running Tests

1. Install dependencies:
```bash
yarn install
```

2. Build the program:
```bash
anchor build
```

3. Run tests:
```bash
anchor test
```

Or use the npm script:
```bash
yarn test
```

### Test Dependencies

- `@solana/web3.js`: Solana blockchain interaction
- `@solana/spl-token`: Token program operations
- `@metaplex-foundation/mpl-token-metadata`: NFT metadata standards
- `chai`: Assertion library for testing

## Development

### Prerequisites

- Solana CLI tools
- Anchor framework
- Node.js and Yarn

### Local Development

1. Start a local Solana validator:
```bash
solana-test-validator
```

2. Configure Anchor to use local cluster:
```bash
anchor config set --provider localnet
```

3. Deploy the program:
```bash
anchor deploy
```

## Cross-Chain Flow

1. **Mint NFT on Solana**
   - Create mint account
   - Create metadata account (Metaplex standard)
   - Create master edition account
   - Generate unique token ID
   - Create NFT origin PDA

2. **Transfer to Connected Chain**
   - Burn NFT on Solana
   - Send cross-chain message with token ID
   - Mint NFT on destination chain
   - Create corresponding origin record

## Security Features

- **Pause Mechanism**: Emergency stop for all operations
- **Owner Controls**: Restricted admin functions
- **PDA Validation**: Secure account derivation
- **Input Validation**: Comprehensive parameter checking

## License

ISC
