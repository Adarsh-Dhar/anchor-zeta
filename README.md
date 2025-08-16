# Universal NFT - Cross-Chain NFT Platform

A cross-chain NFT platform built on Solana using the Anchor framework. This project enables NFTs to be minted, transferred, and managed across different blockchain networks.

## Features

### Core Functionality
- **Initialize Program**: Set up the cross-chain NFT program with owner and gateway addresses
- **Mint NFT**: Create new NFTs on Solana with unique token IDs
- **Create NFT Origin**: Record NFT origins for cross-chain tracking
- **Cross-Chain Transfer**: Initiate transfers between different blockchain networks
- **Receive Cross-Chain Messages**: Handle incoming cross-chain NFT transfers
- **Admin Controls**: Pause/unpause the program for maintenance

### Technical Features
- Unique token ID generation using mint address, block number, and sequence
- Cross-chain message handling with recipient address conversion
- Program state management with pause/unpause functionality
- Comprehensive event emission for all operations
- Secure account validation and error handling

## Project Structure

```
universal-nft/
├── app/                    # React frontend application
│   ├── index.tsx         # Main App component
│   ├── main.tsx          # React entry point
│   └── globals.css       # Global styles with Tailwind CSS
├── programs/              # Solana program (Rust)
│   └── universal-nft/
│       └── src/
│           └── lib.rs    # Main program logic
├── tests/                 # Program tests
├── migrations/            # Deployment scripts
├── Anchor.toml           # Anchor configuration
├── package.json          # Dependencies and scripts
├── tailwind.config.js    # Tailwind CSS configuration
├── vite.config.ts        # Vite build configuration
└── postcss.config.js     # PostCSS configuration
```

## Getting Started

### Prerequisites
- Node.js 18+ and Yarn
- Rust and Cargo
- Solana CLI tools
- Anchor CLI

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd universal-nft
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Build the Solana program**
   ```bash
   anchor build
   ```

4. **Run tests**
   ```bash
   anchor test
   ```

### Running the Frontend

1. **Start the development server**
   ```bash
   yarn dev
   ```

2. **Open your browser**
   Navigate to `http://localhost:3000`

3. **Build for production**
   ```bash
   yarn build:frontend
   ```

## Frontend Features

The React frontend provides a comprehensive interface for all program functions:

### Dashboard Overview
- Program status and statistics
- NFT count and next token ID
- Recent NFT origins table

### Program Management
- **Initialize**: Set up program parameters
- **Mint NFT**: Create new NFTs with metadata
- **Create Origin**: Record cross-chain NFT origins
- **Cross-Chain Transfer**: Initiate transfers between chains
- **Receive Messages**: Handle incoming cross-chain transfers
- **Admin Panel**: Program control and status monitoring

### User Experience
- Modern, responsive design with Tailwind CSS
- Tab-based navigation for easy function access
- Form validation and user feedback
- Wallet connection simulation
- Real-time program state display

## Solana Program Functions

### `initialize`
Initializes the cross-chain NFT program with owner and gateway addresses.

### `mint_nft`
Mints new NFTs on Solana with unique token IDs and metadata URIs.

### `create_nft_origin`
Creates NFT origin records for cross-chain tracking.

### `initiate_cross_chain_transfer`
Burns NFTs and initiates cross-chain transfers to other networks.

### `receive_cross_chain_message`
Handles incoming cross-chain messages and creates local NFT records.

### `pause` / `unpause`
Administrative functions to pause/unpause the program.

## Development

### Adding New Features
1. Implement the logic in `programs/universal-nft/src/lib.rs`
2. Add corresponding UI components in `app/index.tsx`
3. Update tests in `tests/universal-nft.ts`
4. Test with `anchor test`

### Styling
The frontend uses Tailwind CSS with custom component classes:
- `.btn-primary`: Primary action buttons
- `.btn-secondary`: Secondary action buttons
- `.card`: Content containers
- `.input-field`: Form inputs
- `.form-label`: Form labels

### State Management
The React app uses local state for:
- Active tab selection
- Wallet connection status
- Program state display
- Form data management

## Testing

Run the complete test suite:
```bash
yarn test
```

Or run specific test files:
```bash
anchor test tests/universal-nft.ts
```

## Deployment

1. **Build the program**
   ```bash
   anchor build
   ```

2. **Deploy to Solana**
   ```bash
   anchor deploy
   ```

3. **Update program ID**
   Update the `declare_id!` macro in `lib.rs` with the deployed program ID

4. **Deploy frontend**
   ```bash
   yarn build:frontend
   # Deploy the `dist` folder to your hosting service
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For questions and support, please open an issue on GitHub or contact the development team.
