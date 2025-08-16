import React, { useState, useEffect } from 'react'

interface ProgramState {
  owner: string
  gateway: string
  nextTokenId: number
  paused: boolean
  bump: number
}

interface NFTOrigin {
  tokenId: number
  originChain: number
  originTokenId: number
  metadataUri: string
  mint: string
  createdAt: number
  bump: number
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview')
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [programState, setProgramState] = useState<ProgramState | null>(null)
  const [nftOrigins, setNftOrigins] = useState<NFTOrigin[]>([])

  useEffect(() => {
    setProgramState({
      owner: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
      gateway: 'Gateway111111111111111111111111111111111111111',
      nextTokenId: 1001,
      paused: false,
      bump: 1
    })
    
    setNftOrigins([
      {
        tokenId: 1000,
        originChain: 0,
        originTokenId: 1000,
        metadataUri: 'https://arweave.net/example-metadata-1',
        mint: 'Mint111111111111111111111111111111111111111111',
        createdAt: Date.now() / 1000,
        bump: 1
      }
    ])
  }, [])

  const connectWallet = () => {
    setWalletConnected(true)
    setWalletAddress('5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1')
  }

  const disconnectWallet = () => {
    setWalletConnected(false)
    setWalletAddress('')
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'initialize', label: 'Initialize' },
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900">Total NFTs</h3>
                <p className="text-3xl font-bold text-blue-600">{nftOrigins.length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900">Program Status</h3>
                <p className={`text-3xl font-bold ${programState?.paused ? 'text-red-600' : 'text-green-600'}`}>
                  {programState?.paused ? 'Paused' : 'Active'}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900">Next Token ID</h3>
                <p className="text-3xl font-bold text-purple-600">{programState?.nextTokenId || 0}</p>
              </div>
            </div>
          </div>
        )

      case 'initialize':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Initialize Program</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Owner Address</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter owner public key"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gateway Address</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter gateway public key"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Initial Token ID</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue="1"
                  min="1"
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg">
                Initialize Program
              </button>
            </form>
          </div>
        )

      case 'mint':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mint New NFT</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Metadata URI</label>
                <input
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://arweave.net/your-metadata"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mint Address</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter mint public key"
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg">
                Mint NFT
              </button>
            </form>
          </div>
        )

      case 'create-origin':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create NFT Origin Record</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Token ID</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue="1"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Origin Chain</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Metadata URI</label>
                <input
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://arweave.net/your-metadata"
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg">
                Create NFT Origin
              </button>
            </form>
          </div>
        )

      case 'transfer':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Initiate Cross-Chain Transfer</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Token ID</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue="1"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination Chain</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue="1"
                  min="1"
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg">
                Initiate Transfer
              </button>
            </form>
          </div>
        )

      case 'receive':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Receive Cross-Chain Message</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Token ID</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue="1"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cross-Chain Message</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
                  placeholder="Enter cross-chain message"
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg">
                Receive Message
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
                <button className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg">
                  Pause Program
                </button>
                <button className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg">
                  Unpause Program
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
            
            <div className="flex items-center space-x-4">
              {walletConnected ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 px-3 py-2 bg-green-100 rounded-lg">
                    <div className="w-4 h-4 bg-green-600 rounded-full"></div>
                    <span className="text-sm text-green-800 font-medium">Connected</span>
                  </div>
                  <span className="text-sm text-gray-600 font-mono">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </span>
                  <button
                    onClick={disconnectWallet}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
                >
                  Connect Wallet
                </button>
              )}
            </div>
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

export default App
