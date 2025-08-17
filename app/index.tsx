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
    createMint,
    mintNFT,
    createNFTOrigin,
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
  const [createOriginForm, setCreateOriginForm] = useState({
    tokenId: 1,
    originChain: 901, // Default to Solana Devnet
    metadataUri: '',
    mint: ''
  })
  const [transferForm, setTransferForm] = useState({
    tokenId: 1,
    destinationChain: 7001, // Default to ZetaChain Testnet
    destinationOwner: ''
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

  const handleMintNFT = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (!mintForm.uri.trim()) {
      alert('Please enter a metadata URI');
      return;
    }
    
    if (!mintForm.mint.trim()) {
      alert('Please enter a mint address');
      return;
    }
    
    try {
      await mintNFT(mintForm.uri, mintForm.mint)
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
    
    try {
      const result = await createMint(createMintForm.decimals)
      if (result?.mintAddress) {
        setCreatedMintAddress(result.mintAddress)
        // Automatically populate the mint form
        setMintForm(prev => ({ ...prev, mint: result.mintAddress }))
      }
    } catch (err) {
      // Error is already handled by the hook
    }
  }

  const handleCreateOrigin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (!createOriginForm.tokenId || isNaN(createOriginForm.tokenId)) {
      alert('Please enter a valid token ID');
      return;
    }
    
    if (!createOriginForm.originChain || isNaN(createOriginForm.originChain)) {
      alert('Please enter a valid origin chain');
      return;
    }
    
    if (!createOriginForm.metadataUri.trim()) {
      alert('Please enter a metadata URI');
      return;
    }
    
    if (!createOriginForm.mint.trim()) {
      alert('Please enter a valid mint address');
      return;
    }
    
    console.log('Creating NFT origin with form data:', createOriginForm);
    
    try {
      const result = await createNFTOrigin(
        createOriginForm.tokenId,
        createOriginForm.originChain,
        createOriginForm.tokenId,
        createOriginForm.metadataUri,
        createOriginForm.mint
      )
      console.log('NFT origin created successfully:', result);
    } catch (err) {
      console.error('Error in handleCreateOrigin:', err);
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
      
      // Clear form after successful transfer
      setTransferForm({
        tokenId: 1,
        destinationChain: 7001, // Default to ZetaChain Testnet
        destinationOwner: ''
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
    { id: 'create-mint', label: 'Create Mint' },
    { id: 'mint', label: 'Mint NFT' },
    { id: 'create-origin', label: 'Create Origin' },
    { id: 'transfer', label: 'Cross-Chain Transfer' },
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getChainOptions().map(option => (
                  <div key={option.value} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">{option.label}</span>
                    <span className="text-xs text-gray-500 font-mono">{option.value}</span>
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

      case 'create-mint':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Mint Account</h3>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ Before creating a mint:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Make sure the program is initialized</li>
                <li>• The program must not be paused</li>
                <li>• You need sufficient SOL for transaction fees</li>
                <li>• For NFTs, typically use 0 decimals</li>
              </ul>
            </div>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="text-sm font-medium text-green-800 mb-2">What happens when you create a mint?</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• A new SPL Token mint account is created with the specified decimals</li>
                <li>• You become the mint authority and freeze authority</li>
                <li>• An NFT origin record is automatically created</li>
                <li>• The mint address will be displayed after successful creation</li>
              </ul>
            </div>
            <form onSubmit={handleCreateMint} className="space-y-4">
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
                {loading ? 'Creating Mint...' : 'Create Mint Account'}
              </button>
            </form>
            
            {createdMintAddress && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="text-sm font-medium text-green-800 mb-2">✅ Mint Account Created Successfully!</h4>
                <div className="space-y-2">
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Mint Address:</span>
                  </p>
                  <p className="text-sm font-mono text-green-800 break-all bg-green-100 p-2 rounded">
                    {createdMintAddress}
                  </p>
                  <p className="text-xs text-green-600">
                    Save this address - you'll need it to mint NFTs or perform other operations.
                  </p>
                  <button
                    onClick={() => {
                      setCreatedMintAddress(null)
                      setCreateMintForm({ decimals: 0 })
                    }}
                    className="mt-3 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md transition-colors"
                  >
                    Create Another Mint
                  </button>
                </div>
              </div>
            )}
          </div>
        )

      case 'mint':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mint New NFT</h3>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ Before minting an NFT:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Make sure the program is initialized</li>
                <li>• Ensure you have a valid mint address</li>
                <li>• The program must not be paused</li>
                <li>• You need sufficient SOL for transaction fees</li>
              </ul>
            </div>
            <form onSubmit={handleMintNFT} className="space-y-4">
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
                <label className="block text-gray-700 mb-2">Mint Address</label>
                <p className="text-sm text-gray-500 mb-2">Public key of the SPL Token mint account to mint the NFT to</p>
                <input
                  type="text"
                  value={mintForm.mint}
                  onChange={(e) => setMintForm({...mintForm, mint: e.target.value})}
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
                {loading ? 'Minting...' : 'Mint NFT'}
              </button>
            </form>
          </div>
        )

      case 'create-origin':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create NFT Origin Record</h3>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ Before creating an NFT origin:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Make sure the program is initialized</li>
                <li>• Ensure you have a valid mint address</li>
                <li>• The program must not be paused</li>
                <li>• You need sufficient SOL for transaction fees</li>
              </ul>
            </div>
            <form onSubmit={handleCreateOrigin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Token ID</label>
                <p className="text-sm text-gray-500 mb-2">Unique identifier for the NFT (must be greater than 0)</p>
                <input
                  type="number"
                  value={createOriginForm.tokenId}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      setCreateOriginForm({...createOriginForm, tokenId: value});
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Origin Chain</label>
                <p className="text-sm text-gray-500 mb-2">Select the blockchain where the NFT originated</p>
                <select
                  value={createOriginForm.originChain}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      setCreateOriginForm({...createOriginForm, originChain: value});
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Metadata URI</label>
                <p className="text-sm text-gray-500 mb-2">URI pointing to the NFT metadata (JSON format)</p>
                <input
                  type="url"
                  value={createOriginForm.metadataUri}
                  onChange={(e) => setCreateOriginForm({...createOriginForm, metadataUri: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://arweave.net/your-metadata or ipfs://your-hash"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mint Address</label>
                <p className="text-sm text-gray-500 mb-2">Public key of the SPL Token mint account</p>
                <input
                  type="text"
                  value={createOriginForm.mint}
                  onChange={(e) => setCreateOriginForm({...createOriginForm, mint: e.target.value})}
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
                {loading ? 'Creating...' : 'Create NFT Origin'}
              </button>
            </form>
          </div>
        )

      case 'transfer':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Initiate Cross-Chain Transfer</h3>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ Before initiating a transfer:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Make sure the NFT origin exists</li>
                <li>• Ensure you own the NFT tokens</li>
                <li>• The program must not be paused</li>
                <li>• You need sufficient SOL for transaction fees</li>
              </ul>
            </div>
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Token ID</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination Owner</label>
                <p className="text-sm text-gray-500 mb-2">Address of the recipient on the destination chain</p>
                <input
                  type="text"
                  value={transferForm.destinationOwner}
                  onChange={(e) => setTransferForm({...transferForm, destinationOwner: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., destination_wallet_address"
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
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  Cross-Chain Transfer Logs
                </h4>
                <div className="bg-white border border-gray-200 rounded p-3 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {crossChainLogs.logs.join('\n')}
                  </pre>
                </div>
                <div className="mt-3 text-sm text-gray-600">
                  <p><strong>Status:</strong> {crossChainLogs.status}</p>
                  <p><strong>Destination Chain:</strong> {crossChainLogs.destinationChainName}</p>
                  <p><strong>Destination Owner:</strong> {crossChainLogs.destinationOwner}</p>
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
              <h1 className="text-xl font-bold text-blue-600">Universal NFT</h1>
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
            <p className="text-sm mt-2">Built with Solana and Anchor Framework</p>
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

