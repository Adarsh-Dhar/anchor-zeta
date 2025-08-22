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
    migrateProgramState,
    checkProgramStateMigration,
    clearMessages,
    isConnected,
    crossChainLogs,
    initiateTransferWithLogging,
    checkNFTExists
  } = useProgram()

  const [activeTab, setActiveTab] = useState('overview')

  // Form states
  const [initializeForm, setInitializeForm] = useState({
    gateway: '',
    evmContract: '0xfeC46bFEE779652CA9c2706F5cA12D92c81B4188',
    nextTokenId: 1,
    gasLimit: 1000000,
    uniswapRouter: '11111111111111111111111111111111' // System program as default
  })
  const [mintForm, setMintForm] = useState({
    uri: ''
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

  // NFT existence check state
  const [nftCheckResult, setNftCheckResult] = useState<{ exists: boolean; details?: any; error?: string } | null>(null)
  const [checkingNFT, setCheckingNFT] = useState(false)

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
    tokenId: safeBNToNumber(origin.token_id),
    originChain: origin.origin_chain,
    originTokenId: safeBNToNumber(origin.origin_token_id),
    metadataUri: origin.metadata_uri,
    mint: origin.mint.toString(),
    createdAt: safeBNToNumber(origin.created_at),
    bump: origin.bump
  }))

  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (!initializeForm.gateway.trim()) {
      alert('Please enter a gateway address');
      return;
    }
    if (!initializeForm.evmContract.trim()) {
      alert('Please enter destination EVM contract');
      return;
    }
    
    if (!initializeForm.nextTokenId || isNaN(initializeForm.nextTokenId)) {
      alert('Please enter a valid next token ID');
      return;
    }
    
    try {
      await initialize(
        initializeForm.gateway, 
        initializeForm.nextTokenId, 
        initializeForm.evmContract,
        initializeForm.gasLimit,
        initializeForm.uniswapRouter
      )
    } catch (err) {
      // Error is already handled by the hook
    }
  }

  const handleCreateMint = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (!mintForm.uri.trim()) {
      alert('Please enter a metadata URI');
      return;
    }
    
    try {
      const result = await createMintAndNFT(mintForm.uri, createMintForm.decimals)
      
      // Set the created mint address and token ID
      setCreatedMintAddress(result.mintAddress)
      setCreatedTokenId(result.tokenId)
      
      // Auto-populate the transfer form with the created token ID
      setTransferForm({
        ...transferForm,
        tokenId: result.tokenId
      })
      
      // Clear the mint form
      setMintForm({
        uri: ''
      })
      
      // Show success message
      alert(`NFT created successfully!\nMint Address: ${result.mintAddress}\nToken ID: ${result.tokenId}\n\nYou can now use this Token ID for cross-chain transfer.`)
    } catch (err: any) {
      // Error is already handled by the hook
      // Additional guidance for deserialization errors
      if (err.message && err.message.includes('Failed to deserialize')) {
        console.log('Deserialization error detected - user should migrate program state');
      }
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (!transferForm.tokenId || isNaN(transferForm.tokenId)) {
      alert('Please enter a valid token ID');
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

  const handleCheckNFT = async () => {
    if (!transferForm.tokenId || isNaN(transferForm.tokenId)) {
      alert('Please enter a valid token ID');
      return;
    }
    
    try {
      setCheckingNFT(true);
      setNftCheckResult(null);
      
      // Use the checkNFTExists method from the hook
      const result = await checkNFTExists(transferForm.tokenId);
      setNftCheckResult(result);
    } catch (err: any) {
      setNftCheckResult({
        exists: false,
        error: err.message || 'Failed to check NFT existence'
      });
    } finally {
      setCheckingNFT(false);
    }
  }

  const handleAutoFillNFT = () => {
    if (frontendNFTOrigins.length > 0) {
      // Use the first available NFT
      const firstNFT = frontendNFTOrigins[0];
      setTransferForm({
        ...transferForm,
        tokenId: typeof firstNFT.tokenId === 'number' ? firstNFT.tokenId : 1
      });
      setNftCheckResult(null); // Clear previous check result
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
                <div className="mt-3 space-y-2">
                  {error.includes('Failed to deserialize') && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800 font-medium">🔄 Program State Migration Required</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        The program was updated but the existing program state has the old structure. 
                        This is a common issue when programs are upgraded.
                      </p>
                      <div className="mt-2 space-x-2">
                        <button
                          onClick={async () => {
                            try {
                              await migrateProgramState();
                            } catch (err) {
                              // Error is already handled by the hook
                            }
                          }}
                          disabled={loading}
                          className="text-xs bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-3 py-1 rounded-md transition-colors"
                        >
                          {loading ? 'Migrating...' : 'Migrate Program State'}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const result = await checkProgramStateMigration();
                              if (result.needsMigration) {
                                alert(`Migration Status: ${result.error || 'Program state needs migration'}`);
                              } else {
                                alert('Program state is up to date!');
                              }
                            } catch (err) {
                              // Error is already handled by the hook
                            }
                          }}
                          disabled={loading}
                          className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-2 py-1 rounded-md transition-colors"
                        >
                          Check Status
                        </button>
                      </div>
                    </div>
                  )}
                  <button 
                    onClick={clearMessages}
                    className="text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Dismiss Error
                  </button>
                </div>
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
            
            {/* User's NFTs Section */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your NFTs</h3>
              {frontendNFTOrigins.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-6xl mb-4">🎨</div>
                  <p className="text-gray-600 mb-2">No NFTs created yet</p>
                  <p className="text-sm text-gray-500">
                    Go to the "Create Mint & NFT" tab to create your first NFT
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">
                    You have {frontendNFTOrigins.length} NFT{frontendNFTOrigins.length !== 1 ? 's' : ''} available for cross-chain transfer:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {frontendNFTOrigins.map((nft, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900">Token ID {nft.tokenId}</h4>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            Available
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><strong>Mint:</strong> {nft.mint.slice(0, 8)}...{nft.mint.slice(-8)}</p>
                          <p><strong>Origin Chain:</strong> {nft.originChain}</p>
                          <p><strong>Metadata:</strong> {nft.metadataUri}</p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            💡 Use this Token ID in the "Cross-Chain Transfer" tab
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
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
                <li>• Gas limit and Uniswap router can be updated later by admin</li>
              </ul>
            </div>
            <form onSubmit={handleInitialize} className="space-y-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination EVM Contract (Zeta)</label>
                <p className="text-sm text-gray-500 mb-2">20-byte hex address, e.g., your UniversalNFT contract on ZetaChain</p>
                <input
                  type="text"
                  value={initializeForm.evmContract}
                  onChange={(e) => setInitializeForm({...initializeForm, evmContract: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0x..."
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gas Limit</label>
                <p className="text-sm text-gray-500 mb-2">Gas limit for cross-chain operations (default: 1,000,000)</p>
                <input
                  type="number"
                  value={initializeForm.gasLimit}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      setInitializeForm({...initializeForm, gasLimit: value});
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="100000"
                  step="100000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Uniswap Router Address</label>
                <p className="text-sm text-gray-500 mb-2">Public key for Uniswap router (default: System Program)</p>
                <input
                  type="text"
                  value={initializeForm.uniswapRouter}
                  onChange={(e) => setInitializeForm({...initializeForm, uniswapRouter: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="11111111111111111111111111111111"
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
                        setMintForm({ uri: '' })
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
            
           
           
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Token ID</label>
                {createdTokenId && (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700">
                      <strong>✅ NFT Created Successfully!</strong>
                    </p>
                    <div className="text-sm text-green-600 mt-1 space-y-1">
                      <p><strong>Token ID:</strong> {createdTokenId}</p>
                      <p><strong>Mint Address:</strong> {createdMintAddress?.slice(0, 8)}...{createdMintAddress?.slice(-8)}</p>
                    </div>
                    <p className="text-xs text-green-600 mt-2">
                      💡 <strong>This Token ID is automatically filled below and ready for transfer!</strong>
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={transferForm.tokenId}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value)) {
                        setTransferForm({...transferForm, tokenId: value});
                        setNftCheckResult(null); // Clear previous check result
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleCheckNFT}
                    disabled={checkingNFT || !isConnected}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium rounded-lg disabled:cursor-not-allowed"
                  >
                    {checkingNFT ? 'Checking...' : 'Check NFT'}
                  </button>
                  {frontendNFTOrigins.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAutoFillNFT}
                      disabled={!isConnected}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg disabled:cursor-not-allowed"
                      title="Auto-fill with first available NFT"
                    >
                      Auto-fill
                    </button>
                  )}
                </div>
                
                {/* Button explanations */}
                {frontendNFTOrigins.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    <p>💡 <strong>Auto-fill:</strong> Automatically fills the token ID with your first available NFT</p>
                    <p>💡 <strong>Check NFT:</strong> Verifies if a specific token ID exists and shows details</p>
                  </div>
                )}
                
                {/* NFT Check Results */}
                {nftCheckResult && (
                  <div className={`mt-3 p-3 rounded-lg border ${
                    nftCheckResult.exists ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    {nftCheckResult.exists ? (
                      <div>
                        <p className="text-sm font-medium text-green-700 mb-2">✅ NFT Found</p>
                        <div className="text-sm text-green-600 space-y-1">
                          <p><strong>Token ID:</strong> {nftCheckResult.details.tokenId}</p>
                          <p><strong>Mint Address:</strong> {nftCheckResult.details.mint}</p>
                          <p><strong>Token Balance:</strong> {nftCheckResult.details.tokenBalance}</p>
                          <p><strong>Metadata URI:</strong> {nftCheckResult.details.metadataUri}</p>
                        </div>
                        {nftCheckResult.details.tokenBalance < 1 && (
                          <p className="text-sm text-red-600 mt-2">
                            ⚠️ You don't have any tokens to transfer. Please mint an NFT first.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-red-700 mb-2">❌ NFT Not Found</p>
                        <p className="text-sm text-red-600">{nftCheckResult.error}</p>
                        <p className="text-sm text-red-600 mt-2">
                          💡 <strong>Solution:</strong> Create an NFT first using the "Create Mint & NFT" tab above.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {!createdTokenId && !nftCheckResult && (
                  <p className="mt-1 text-sm text-gray-500">
                    You need to create an NFT first before you can transfer it. Use the "Check NFT" button to verify what's available.
                  </p>
                )}
                
                {/* Helpful guidance for finding NFT token IDs */}
                {frontendNFTOrigins.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700 mb-2">
                      💡 <strong>Available NFTs Found:</strong> You have {frontendNFTOrigins.length} NFT{frontendNFTOrigins.length !== 1 ? 's' : ''} available
                    </p>
                    <div className="text-xs text-blue-600 space-y-1">
                      {frontendNFTOrigins.slice(0, 3).map((nft, index) => (
                        <p key={index}>
                          • Token ID {nft.tokenId}: {nft.mint.slice(0, 8)}...{nft.mint.slice(-8)}
                        </p>
                      ))}
                      {frontendNFTOrigins.length > 3 && (
                        <p>• ... and {frontendNFTOrigins.length - 3} more</p>
                      )}
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      💡 <strong>Tip:</strong> Use the "Check NFT" button above to verify any token ID before transfer
                    </p>
                  </div>
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
            <p className="text-xs mt-1 text-green-600">ZetaChain Contract: 0xfeC46bFEE779652CA9c2706F5cA12D92c81B4188</p>
            <p className="text-xs mt-1 text-blue-600">Solana Program: 7uVLXw3wQoGjFD1KVGdhFpiWHSwzQKEDASfKiQ8GrAWR</p>
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

