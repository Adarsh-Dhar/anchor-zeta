#!/bin/bash

# Universal NFT Test Runner
# This script provides different options for running tests

set -e

echo "🚀 Universal NFT Test Runner"
echo "=============================="

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  all           Run all tests (default)"
    echo "  unit          Run only unit tests"
    echo "  integration   Run only integration tests"
    echo "  quick         Run quick smoke tests"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0              # Run all tests"
    echo "  $0 unit         # Run unit tests only"
    echo "  $0 integration # Run integration tests only"
}

# Function to run tests
run_tests() {
    local test_type=$1
    
    case $test_type in
        "all")
            echo "🧪 Running all tests..."
            anchor test
            ;;
        "unit")
            echo "🧪 Running unit tests..."
            anchor test -- --grep "Program Initialization|NFT Minting|Admin Functions|Error Handling"
            ;;
        "integration")
            echo "🧪 Running integration tests..."
            anchor test -- --grep "Cross-Chain|Integration Tests"
            ;;
        "quick")
            echo "🧪 Running quick smoke tests..."
            anchor test -- --grep "Program Initialization|Should initialize the program"
            ;;
        "help"|"-h"|"--help")
            show_usage
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $test_type"
            show_usage
            exit 1
            ;;
    esac
}

# Check if Anchor is installed
if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI is not installed. Please install it first:"
    echo "   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "Anchor.toml" ]; then
    echo "❌ Please run this script from the project root directory (where Anchor.toml is located)"
    exit 1
fi

# Build the program first
echo "🔨 Building program..."
anchor build

# Run tests based on argument
if [ $# -eq 0 ]; then
    run_tests "all"
else
    run_tests "$1"
fi

echo ""
echo "✅ Tests completed!"
