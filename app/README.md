# Universal NFT Frontend

A React-based frontend application for interacting with the Universal NFT Solana program. This application provides a user-friendly interface for managing cross-chain NFTs on the Solana blockchain.

## Features

- **Program Management**: Initialize and manage the Universal NFT program
- **NFT Operations**: Mint new NFTs and create NFT origin records
- **Cross-Chain Transfers**: Initiate cross-chain NFT transfers
- **Message Handling**: Receive and process cross-chain messages
- **Admin Controls**: Pause/unpause the program (owner only)
- **Real-time Updates**: Live program state and NFT data
- **Wallet Integration**: Full Solana wallet support

## Prerequisites

- Node.js 16+ and npm/yarn
- Solana CLI tools
- A Solana wallet (Phantom, Solflare, etc.)
- Solana devnet SOL for testing

## Installation

1. Install dependencies:
```bash
yarn install
```

2. Build the Solana program:
```bash
anchor build
```

3. Deploy to devnet:
```bash
anchor deploy --provider.cluster devnet
```

4. Start the development server:
```bash
yarn dev
```

## Usage

### 1. Connect Wallet

First, connect your Solana wallet using the wallet connect button in the top-right corner. The application supports:
- Phantom
- Solflare
- Other Solana wallet adapters

### 2. Initialize Program

Before using other features, you must initialize the program:

1. Navigate to the "Initialize" tab
2. Enter the owner's public key (your wallet address)
3. Enter the gateway address for cross-chain operations
4. Set the initial token ID (usually 1)
5. Click "Initialize Program"

**Note**: Only the program owner can initialize the program.

### 3. Mint NFTs

To mint a new NFT:

1. Go to the "Mint NFT" tab
2. Enter the metadata URI (e.g., Arweave link)
3. Provide the mint address (you'll need to create this first)
4. Click "Mint NFT"

**Note**: You'll need to create a mint and associated token account before minting.

### 4. Create NFT Origin Records

Create records for NFTs that originated on other chains:

1. Navigate to "Create Origin"
2. Enter the token ID
3. Specify the origin chain ID
4. Provide the metadata URI
5. Enter the mint address
6. Click "Create NFT Origin"

### 5. Cross-Chain Transfers

Initiate cross-chain NFT transfers:

1. Go to "Cross-Chain Transfer"
2. Enter the token ID to transfer
3. Specify the destination chain ID
4. Click "Initiate Transfer"

**Note**: This will burn the NFT on Solana and create a cross-chain message.

### 6. Receive Cross-Chain Messages

Process incoming cross-chain messages:

1. Navigate to "Receive Message"
2. Enter the token ID
3. Provide the cross-chain message data
4. Enter the mint address
5. Click "Receive Message"

### 7. Admin Controls

Program owners can:

- **Pause Program**: Temporarily disable all operations
- **Unpause Program**: Re-enable operations after pausing

## Architecture

### Frontend Structure

```
app/
├── components/          # React components
│   ├── SolanaProvider.tsx    # Solana wallet provider
│   └── WalletConnect.tsx     # Wallet connection component
├── hooks/              # Custom React hooks
│   └── useProgram.ts         # Program interaction hook
├── lib/                # Utility libraries
│   ├── program.ts            # Solana program client
│   └── utils.ts              # Helper functions
├── idl/                # Anchor IDL files
│   └── universal_nft.json    # Program interface definition
└── index.tsx           # Main application component
```

### Key Components

- **UniversalNFTClient**: Handles all Solana program interactions
- **useProgram Hook**: Manages program state and provides transaction functions
- **SolanaProvider**: Sets up Solana wallet and connection context
- **Form Components**: Handle user input and transaction submission

## Program Functions

The frontend integrates with these Solana program instructions:

- `initialize`: Set up the program with owner and gateway
- `mint_nft`: Create new NFTs with metadata
- `create_nft_origin`: Record NFTs from other chains
- `initiate_cross_chain_transfer`: Start cross-chain transfers
- `receive_cross_chain_message`: Process incoming messages
- `pause`/`unpause`: Program control (owner only)

## Error Handling

The application provides comprehensive error handling:

- **Validation**: Input validation for public keys and form data
- **Transaction Errors**: Clear error messages for failed transactions
- **Network Issues**: Connection and RPC error handling
- **User Feedback**: Success/error notifications with dismiss options

## Development

### Adding New Features

1. **Program Instructions**: Add new methods to `UniversalNFTClient`
2. **Hook Functions**: Extend `useProgram` hook with new functionality
3. **UI Components**: Create new form components and tab content
4. **Validation**: Add input validation in the hook layer

### Testing

```bash
# Run Solana program tests
anchor test

# Run frontend tests (if configured)
yarn test
```

### Building for Production

```bash
# Build the frontend
yarn build:frontend

# Build and deploy the program
anchor build
anchor deploy --provider.cluster mainnet-beta
```

## Troubleshooting

### Common Issues

1. **Wallet Not Connecting**
   - Ensure wallet extension is installed and unlocked
   - Check browser console for connection errors
   - Try refreshing the page

2. **Transaction Failures**
   - Verify sufficient SOL balance for transaction fees
   - Check that all required accounts exist
   - Ensure program is not paused

3. **Program Not Found**
   - Verify program ID in `Anchor.toml`
   - Ensure program is deployed to the correct cluster
   - Check network configuration

### Debug Mode

Enable debug logging by setting:
```typescript
// In SolanaProvider.tsx
const network = WalletAdapterNetwork.Devnet;
console.log('Debug mode enabled');
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions:
- Check the troubleshooting section
- Review Solana and Anchor documentation
- Open an issue on GitHub
