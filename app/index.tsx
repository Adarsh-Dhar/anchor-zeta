import React, { useState } from 'react'
import { SolanaProvider } from './components/SolanaProvider'
import { WalletConnect } from './components/WalletConnect'
import { useProgram } from './hooks/useProgram'

// Frontend interfaces for display
interface FrontendProgramState {
  owner: string;
  gateway: string;
  nextTokenId: number | string;
  paused: boolean;
  bump: number;
}

interface FrontendNFTOrigin {
  tokenId: number | string;
  originChain: number;
  originTokenId: number | string;
  metadataUri: string;
  mint: string;
  createdAt: number | string;
  bump: number;
}

const AppContent: React.FC = () => {
  const {
    programState,
    nftOrigins,
    loading,
    error,
    success,
    initialize,
    createMintAndNFT,
    receiveMessage,
    pauseProgram,
    unpauseProgram,
    clearMessages,
    isConnected,
    crossChainLogs,
    initiateTransferWithLogging
  } = useProgram()

  const [activeTab, setActiveTab] = useState('overview')

  // Form states
  const [initializeForm, setInitializeForm] = useState({
    owner: '',
    gateway: '',
    nextTokenId: 1
  })
  const [mintForm, setMintForm] = useState({
    uri: '',
    mint: ''
  })
  const [createMintForm, setCreateMintForm] = useState({
    decimals: 0
  })
  const [createdMintAddress, setCreatedMintAddress] = useState<string | null>(null)
  const [createdTokenId, setCreatedTokenId] = useState<number | null>(null)
  const [transferForm, setTransferForm] = useState({
    tokenId: 1,
    destinationChain: 7001, // Default to ZetaChain Testnet
    destinationOwner: '0xfeC46bFEE779652CA9c2706F5cA12D92c81B4188' // Your deployed ZetaChain contract
  })
  const [receiveForm, setReceiveForm] = useState({
    tokenId: 1,
    message: '',
    mint: ''
  })

  // Safe conversion function for BN to number or string
  const safeBNToNumber = (bn: any): number | string => {
    if (!bn) return 0;
    
    try {
      // Handle BN objects
      if (bn.toNumber && typeof bn.toNumber === 'function') {
        try {
          // Try to convert to number first
          return bn.toNumber();
        } catch (error) {
          // If toNumber fails due to size, return string representation
          if (error instanceof Error && error.message && error.message.includes('53 bits')) {
            return bn.toString();
          }
          throw error;
        }
      }
      
      // Handle regular numbers
      if (typeof bn === 'number') {
        return bn;
      }
      
      // Handle strings
      if (typeof bn === 'string') {
        const numValue = Number(bn);
        return isNaN(numValue) ? bn : numValue;
      }
      
      // Handle other types by converting to string first
      const stringValue = String(bn);
      const numValue = Number(stringValue);
      
      // Check if the conversion was successful
      if (isNaN(numValue)) {
        console.warn('Failed to convert value to number, using string as fallback:', bn, stringValue);
        return stringValue;
      }
      
      return numValue;
    } catch (error) {
      console.warn('Error converting BN to number, using string as fallback:', error, bn);
      return String(bn);
    }
  };

  // Helper function to get chain options
  const getChainOptions = () => [
    { value: 901, label: 'Solana Devnet (901)' },
    { value: 7001, label: 'ZetaChain Testnet (7001)' },
    { value: 11155111, label: 'Ethereum Sepolia (11155111)' },
    { value: 97, label: 'BSC Testnet (97)' },
    { value: 80002, label: 'Polygon Amoy (80002)' },
    { value: 421614, label: 'Arbitrum Sepolia (421614)' },
    { value: 18332, label: 'Bitcoin Testnet (18332)' },
  ];

  // Convert program state to frontend format
  const frontendProgramState: FrontendProgramState | null = programState ? {
    owner: programState.owner.toString(),
    gateway: programState.gateway.toString(),
    nextTokenId: safeBNToNumber(programState.nextTokenId),
    paused: programState.paused,
    bump: programState.bump
  } : null

  // Convert NFT origins to frontend format
  const frontendNFTOrigins: FrontendNFTOrigin[] = nftOrigins.map(origin => ({
    tokenId: safeBNToNumber(origin.tokenId),
    originChain: origin.originChain,
    originTokenId: safeBNToNumber(origin.originTokenId),
    metadataUri: origin.metadataUri,
    mint: origin.mint.toString(),
    createdAt: safeBNToNumber(origin.createdAt),
    bump: origin.bump
  }))

  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (!initializeForm.owner.trim()) {
      alert('Please enter an owner address');
      return;
    }
    
    if (!initializeForm.gateway.trim()) {
      alert('Please enter a gateway address');
      return;
    }
    
    if (!initializeForm.nextTokenId || isNaN(initializeForm.nextTokenId)) {
      alert('Please enter a valid next token ID');
      return;
    }
    
    try {
      await initialize(initializeForm.owner, initializeForm.gateway, initializeForm.nextTokenId)
    } catch (err) {
      // Error is already handled by the hook
    }
  }

  const handleCreateMint = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (createMintForm.decimals === undefined || isNaN(createMintForm.decimals)) {
      alert('Please enter a valid number of decimals');
      return;
    }
    
    if (createMintForm.decimals < 0 || createMintForm.decimals > 9) {
      alert('Decimals must be between 0 and 9');
      return;
    }
    
    if (!mintForm.uri.trim()) {
      alert('Please enter a metadata URI');
      return;
    }
    
    try {
      // For the combined function, we need both URI and decimals
      const result = await createMintAndNFT(mintForm.uri, createMintForm.decimals)
      if (result?.mintAddress) {
        setCreatedMintAddress(result.mintAddress)
        setCreatedTokenId(result.tokenId)
        // Automatically populate the mint form and transfer form
        setMintForm(prev => ({ ...prev, mint: result.mintAddress }))
        setTransferForm(prev => ({ ...prev, tokenId: result.tokenId }))
      }
    } catch (err) {
      // Error is already handled by the hook
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (!transferForm.tokenId || isNaN(transferForm.tokenId)) {
      alert('Please enter a valid token ID');
      return;
    }
    
    if (!transferForm.destinationChain || isNaN(transferForm.destinationChain)) {
      alert('Please enter a valid destination chain');
      return;
    }
    
    if (!transferForm.destinationOwner.trim()) {
      alert('Please enter a destination owner');
      return;
    }
    
    try {
      await initiateTransferWithLogging(transferForm.tokenId, transferForm.destinationChain, transferForm.destinationOwner)
      
      // Clear form after successful transfer (but keep the contract address)
      setTransferForm({
        tokenId: 1,
        destinationChain: 7001, // Default to ZetaChain Testnet
        destinationOwner: '0xfeC46bFEE779652CA9c2706F5cA12D92c81B4188' // Keep the contract address
      });
    } catch (err) {
      // Error is already handled by the hook
    }
  }

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (!receiveForm.tokenId || isNaN(receiveForm.tokenId)) {
      alert('Please enter a valid token ID');
      return;
    }
    
    if (!receiveForm.message.trim()) {
      alert('Please enter a message');
      return;
    }
    
    if (!receiveForm.mint.trim()) {
      alert('Please enter a mint address');
      return;
    }
    
    try {
      await receiveMessage(
        receiveForm.tokenId,
        receiveForm.message,
        receiveForm.mint
      )
    } catch (err) {
      // Error is already handled by the hook
    }
  }

  const handlePause = async () => {
    try {
      await pauseProgram()
    } catch (err) {
      // Error is already handled by the hook
    }
  }

  const handleUnpause = async () => {
    try {
      await unpauseProgram()
    } catch (err) {
      // Error is already handled by the hook
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'initialize', label: 'Initialize' },
    { id: 'create-mint-and-nft', label: 'Create Mint & NFT' },
    { id: 'transfer', label: 'Cross-Chain Transfer ✅' },
    { id: 'receive', label: 'Receive Message' },
    { id: 'admin', label: 'Admin' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {!isConnected && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">Please connect your wallet to view program data</p>
              </div>
            )}
            
            {loading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800">Loading program data...</p>
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
                <button 
                  onClick={clearMessages}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Dismiss
                </button>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800">{success}</p>
                <button 
                  onClick={clearMessages}
                  className="mt-2 text-sm text-green-600 hover:text-green-800 underline"
                >
                  Dismiss
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900">Total NFTs</h3>
                <p className="text-3xl font-bold text-blue-600">{frontendNFTOrigins.length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900">Program Status</h3>
                <p className={`text-3xl font-bold ${frontendProgramState?.paused ? 'text-red-600' : 'text-green-600'}`}>
                  {frontendProgramState?.paused ? 'Paused' : 'Active'}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900">Next Token ID</h3>
                <p className="text-3xl font-bold text-purple-600">{frontendProgramState?.nextTokenId || 0}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900">ZetaChain Integration</h3>
                <p className="text-3xl font-bold text-green-600">✅ Ready</p>
                <p className="text-xs text-gray-500 mt-1">Contract: 0xfeC46b...4188</p>
              </div>
            </div>
            
            {frontendProgramState && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Program Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Owner</p>
                    <p className="text-sm font-mono text-gray-900 break-all">{frontendProgramState.owner}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Gateway</p>
                    <p className="text-sm font-mono text-gray-900 break-all">{frontendProgramState.gateway}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Supported Chain IDs</h3>
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  <strong>🎯 Primary Integration:</strong> ZetaChain Testnet (7001) - Your contract is deployed and ready!
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getChainOptions().map(option => (
                  <div key={option.value} className={`flex items-center justify-between p-3 rounded-lg ${
                    option.value === 7001 ? 'bg-green-100 border border-green-300' : 'bg-gray-50'
                  }`}>
                    <span className="text-sm font-medium text-gray-700">{option.label}</span>
                    <span className="text-xs text-gray-500 font-mono">{option.value}</span>
                    {option.value === 7001 && <span className="text-xs text-green-600 font-medium">✅ Ready</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'initialize':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Initialize Program</h3>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ Program initialization:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• This can only be done once</li>
                <li>• You need sufficient SOL for transaction fees</li>
                <li>• The owner address will have admin privileges</li>
                <li>• The gateway address should be a valid program</li>
              </ul>
            </div>
            <form onSubmit={handleInitialize} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Owner Address</label>
                <p className="text-sm text-gray-500 mb-2">Public key of the program owner/admin</p>
                <input
                  type="text"
                  value={initializeForm.owner}
                  onChange={(e) => setInitializeForm({...initializeForm, owner: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., F79VcAwM6VhL9CaZo68W1SwrkntLJpAhcbTLLzuz4g3G"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gateway Address</label>
                <p className="text-sm text-gray-500 mb-2">Public key of the cross-chain gateway program</p>
                <input
                  type="text"
                  value={initializeForm.gateway}
                  onChange={(e) => setInitializeForm({...initializeForm, gateway: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Gateway program public key"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Initial Token ID</label>
                <p className="text-sm text-gray-500 mb-2">Starting token ID for the program (typically 1)</p>
                <input
                  type="number"
                  value={initializeForm.nextTokenId}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      setInitializeForm({...initializeForm, nextTokenId: value});
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || !isConnected}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg disabled:cursor-not-allowed"
              >
                {loading ? 'Initializing...' : 'Initialize Program'}
              </button>
            </form>
          </div>
        )

      case 'create-mint-and-nft':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Mint & Mint NFT</h3>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ What this does:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Creates a new SPL Token mint account with the specified decimals</li>
                <li>• Mints 1 NFT token to your wallet</li>
                <li>• Creates metadata for the NFT (name, symbol, URI)</li>
                <li>• Creates a master edition for the NFT</li>
                <li>• Creates an NFT origin record</li>
                <li>• All in one transaction!</li>
              </ul>
            </div>
            <form onSubmit={handleCreateMint} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Metadata URI</label>
                <p className="text-sm text-gray-500 mb-2">URI pointing to the NFT metadata (JSON format)</p>
                <input
                  type="url"
                  value={mintForm.uri}
                  onChange={(e) => setMintForm({...mintForm, uri: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://arweave.net/your-metadata or ipfs://your-hash"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Decimals</label>
                <input
                  type="number"
                  value={createMintForm.decimals}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      setCreateMintForm({...createMintForm, decimals: value});
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="9"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">For NFTs, typically use 0 decimals</p>
              </div>
              <button 
                type="submit" 
                disabled={loading || !isConnected}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Mint & NFT...' : 'Create Mint & Mint NFT'}
              </button>
            </form>
            
            {createdMintAddress && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="text-sm font-medium text-green-800 mb-2">✅ Mint & NFT Created Successfully!</h4>
                <div className="space-y-2">
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Token ID:</span> {createdTokenId}
                  </p>
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Mint Address:</span>
                  </p>
                  <p className="text-sm font-mono text-green-800 break-all bg-green-100 p-2 rounded">
                    {createdMintAddress}
                  </p>
                  <p className="text-xs text-green-600">
                    Your NFT has been minted and is now in your wallet! The mint account, token account, metadata, and origin record were all created in one transaction.
                    <br /><br />
                    <strong>💡 Tip:</strong> You can now use Token ID {createdTokenId} for cross-chain transfers.
                  </p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setCreatedMintAddress(null)
                        setCreatedTokenId(null)
                        setCreateMintForm({ decimals: 0 })
                        setMintForm({ uri: '', mint: '' })
                      }}
                      className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md transition-colors"
                    >
                      Create Another NFT
                    </button>
                    <button
                      onClick={() => {
                        setCreatedMintAddress(null)
                        setCreatedTokenId(null)
                      }}
                      className="text-sm bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md transition-colors"
                    >
                      Clear NFT Data
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 'transfer':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Initiate Cross-Chain Transfer</h3>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="text-sm font-medium text-green-800 mb-2">✅ ZetaChain Contract Integration Ready:</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Your ZetaChain contract is deployed at: <code className="bg-green-100 px-1 rounded">0xfeC46bFEE779652CA9c2706F5cA12D92c81B4188</code></li>
                <li>• NFT will be burned on Solana and minted on ZetaChain</li>
                <li>• Cross-chain message sent via ZetaChain gateway</li>
                <li>• Your contract's onCall function will handle the NFT minting</li>
                <li>• You'll get real ZetaChain transaction hashes!</li>
              </ul>
            </div>
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Token ID</label>
                {createdTokenId && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Available NFT:</strong> Token ID {createdTokenId} (Mint: {createdMintAddress?.slice(0, 8)}...{createdMintAddress?.slice(-8)})
                    </p>
                  </div>
                )}
                <input
                  type="number"
                  value={transferForm.tokenId}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      setTransferForm({...transferForm, tokenId: value});
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  required
                />
                {!createdTokenId && (
                  <p className="mt-1 text-sm text-gray-500">
                    You need to create an NFT first before you can transfer it.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination Chain</label>
                <p className="text-sm text-gray-500 mb-2">Select the target blockchain for the transfer</p>
                <select
                  value={transferForm.destinationChain}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      setTransferForm({...transferForm, destinationChain: value});
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {getChainOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination Owner (ZetaChain Contract)</label>
                <p className="text-sm text-blue-600 mb-2">⚠️ This should be your deployed ZetaChain contract address (0xfeC46bFEE779652CA9c2706F5cA12D92c81B4188)</p>
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>What happens:</strong> When you transfer an NFT, it will be burned on Solana and minted on ZetaChain at this contract address. 
                    The contract's <code className="bg-blue-100 px-1 rounded">onCall</code> function will automatically handle the NFT creation.
                  </p>
                </div>
                <input
                  type="text"
                  value={transferForm.destinationOwner}
                  onChange={(e) => setTransferForm({...transferForm, destinationOwner: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-500"
                  placeholder="0xfeC46bFEE779652CA9c2706F5cA12D92c81B4188"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || !isConnected}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg disabled:cursor-not-allowed"
              >
                {loading ? 'Initiating...' : 'Initiate Transfer'}
              </button>
            </form>
            {crossChainLogs && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-lg font-semibold text-gray-900">
                    Cross-Chain Transfer Transaction
                  </h4>
                  <button
                    onClick={() => initiateTransferWithLogging(transferForm.tokenId, transferForm.destinationChain, transferForm.destinationOwner)}
                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition-colors"
                  >
                    Refresh Status
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-white p-3 rounded-lg border">
                    <p className="text-sm font-medium text-gray-700">Status</p>
                    <p className={`text-lg font-semibold ${
                      crossChainLogs.status === 'completed' ? 'text-green-600' : 
                      crossChainLogs.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {crossChainLogs.status === 'completed' ? '✅ Completed' :
                       crossChainLogs.status === 'failed' ? '❌ Failed' : '⏳ Pending'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border">
                    <p className="text-sm font-medium text-gray-700">Destination Chain</p>
                    <p className="text-lg font-semibold text-blue-600">{crossChainLogs.destinationChainName}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border">
                    <p className="text-sm font-medium text-gray-700">Recipient</p>
                    <p className="text-sm font-mono text-gray-900 break-all">{crossChainLogs.destinationOwner}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border">
                    <p className="text-sm font-medium text-gray-700">Solana TX Hash</p>
                    <p className="text-sm font-mono text-gray-900 break-all">{crossChainLogs.solanaTxSignature}</p>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded p-3 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {crossChainLogs.logs.join('\n')}
                  </pre>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  <p>✅ Transaction logs show real blockchain data from the cross-chain transfer</p>
                  <p>🔍 Use the refresh button to get the latest transaction status</p>
                  <p>📋 ZetaChain Contract: <code className="bg-gray-100 px-1 rounded">0xfeC46bFEE779652CA9c2706F5cA12D92c81B4188</code></p>
                </div>
              </div>
            )}
          </div>
        )

      case 'receive':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Receive Cross-Chain Message</h3>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ Before receiving a message:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Make sure the program is initialized</li>
                <li>• Ensure you have a valid mint address</li>
                <li>• The program must not be paused</li>
                <li>• You need sufficient SOL for transaction fees</li>
              </ul>
            </div>
            <form onSubmit={handleReceive} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Token ID</label>
                <input
                  type="number"
                  value={receiveForm.tokenId}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      setReceiveForm({...receiveForm, tokenId: value});
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cross-Chain Message</label>
                <p className="text-sm text-gray-500 mb-2">Message data received from another blockchain</p>
                <textarea
                  value={receiveForm.message}
                  onChange={(e) => setReceiveForm({...receiveForm, message: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
                  placeholder="Enter cross-chain message (JSON format recommended)"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mint Address</label>
                <p className="text-sm text-gray-500 mb-2">Public key of the SPL Token mint account to receive the NFT</p>
                <input
                  type="text"
                  value={receiveForm.mint}
                  onChange={(e) => setReceiveForm({...receiveForm, mint: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 11111111111111111111111111111111"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || !isConnected}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg disabled:cursor-not-allowed"
              >
                {loading ? 'Receiving...' : 'Receive Message'}
              </button>
            </form>
          </div>
        )

      case 'admin':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Program Control</h3>
              <div className="flex space-x-4">
                <button 
                  onClick={handlePause}
                  disabled={loading || !isConnected || frontendProgramState?.paused}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg disabled:cursor-not-allowed"
                >
                  {loading ? 'Pausing...' : 'Pause Program'}
                </button>
                <button 
                  onClick={handleUnpause}
                  disabled={loading || !isConnected || !frontendProgramState?.paused}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg disabled:cursor-not-allowed"
                >
                  {loading ? 'Unpausing...' : 'Unpause Program'}
                </button>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <div className="w-6 h-6 bg-blue-600 rounded"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-blue-600">Universal NFT</h1>
                <p className="text-xs text-green-600 font-medium">✅ ZetaChain Integration Ready</p>
              </div>
            </div>
            
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <nav className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div>
          {renderTabContent()}
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>Universal NFT - Cross-Chain NFT Platform</p>
            <p className="text-sm mt-2">Built with Solana, Anchor Framework & ZetaChain</p>
            <p className="text-xs mt-1 text-green-600">Contract: 0xfeC46bFEE779652CA9c2706F5cA12D92c81B4188</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

const App: React.FC = () => {
  return (
    <SolanaProvider>
      <AppContent />
    </SolanaProvider>
  )
}

export default App

