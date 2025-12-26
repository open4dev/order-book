# order-book

A decentralized order book system for TON blockchain that enables peer-to-peer token exchanges (jetton-jetton, TON-jetton, jetton-TON) with slippage protection, fee management, and order matching capabilities.

## Project structure

-   `contracts` - source code of all the smart contracts of the project and their dependencies.
-   `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
-   `tests` - tests for the contracts.
-   `scripts` - scripts used by the project, mainly the deployment scripts.

## Architecture

The order book system consists of several key smart contracts:

### Core Contracts

- **Order** (`order.tolk`) - Represents a single trading order with exchange parameters (amount, price rate, slippage). Handles order matching, validation, and closing.

- **Vault** (`vault.tolk`, `vault2.tolk`, `vault3.tolk`) - Token storage contract that holds user funds for orders. Supports both TON and jetton deposits. Different versions handle jetton wallet address calculation differently.

- **VaultFactory** (`vault_factory.tolk`) - Factory contract for creating and managing vault instances. Handles commission settings and vault deployment.

- **FeeCollector** (`fee_collector.tolk`) - Collects and manages matcher fees from successful order matches.

### Key Features

- **Multi-token Support**: Exchange between jettons (jetton-jetton), TON and jettons (TON-jetton, jetton-TON)
- **Slippage Protection**: Built-in slippage validation to protect users from unfavorable price movements
- **Fee System**: Dual fee structure with provider fees and matcher fees
- **Order Matching**: Automatic matching of compatible orders with price validation
- **Partial Fills**: Support for partial order execution
- **Order Management**: Create, match, and close orders with proper state management

### Exchange Flow

1. User creates a vault for their token (via VaultFactory)
2. User deposits tokens to vault (via JettonTransferNotification or TonTransfer)
3. Vault creates an Order contract with exchange parameters
4. Matcher finds compatible orders and initiates matching
5. Orders validate price compatibility (with slippage and fees)
6. Tokens are transferred through vaults with fee deductions
7. Matcher receives fees via FeeCollector

## How to use

### Build

`npx blueprint build` or `yarn blueprint build`

### Test

`npx blueprint test` or `yarn blueprint test`

### Deploy or run another script

`npx blueprint run` or `yarn blueprint run`

### Add a new contract

`npx blueprint create ContractName` or `yarn blueprint create ContractName`

## Contract Details

### Order Contract

The Order contract manages individual trading orders:

- **InitOrder**: Initialize an order with amount, price rate, slippage, and fee info
- **MatchOrder**: Initiate matching with another order (called by matcher)
- **InternalMatchOrder**: Internal matching logic with slippage and fee validation
- **SuccessMatch**: Confirm successful match and update order state
- **CloseOrder**: Close an order and return remaining funds to owner

### Vault Contract

The Vault contract stores tokens and manages transfers:

- **InitVault**: Initialize vault with factory reference and token info
- **JettonTransferNotification**: Receive jetton deposits and create orders
- **TonTransfer**: Receive TON deposits and create orders
- **VaultJettonTransfer**: Transfer tokens to matched orders with fee calculation
- **WithDraw**: Withdraw accumulated fees (called by FeeCollector)

### VaultFactory Contract

The VaultFactory manages vault creation and settings:

- **CreateVault**: Create a new vault instance for a specific token
- **ChangeOwner**: Change factory owner
- **ChangeCommission**: Update provider commission rates (max 20%)
- **ChangeCommissionMatcher**: Update matcher commission rates (max 5%)
- **WithDraw**: Withdraw fees from vaults

### FeeCollector Contract

The FeeCollector accumulates matcher fees:

- **AddFee**: Add matcher fee from vault (called by vault)
- **WithDraw**: Withdraw accumulated fees to matcher

## Fee Structure

The system uses a dual fee model:

- **Provider Fee**: Charged by the vault provider (max 20%)
- **Matcher Fee**: Charged by the order matcher (max 5%)

Fees are calculated and deducted during order matching, with matcher fees collected in FeeCollector contracts.

## Slippage Protection

Orders include slippage tolerance parameters. During matching:

1. Price rates are adjusted to include fees
2. Adjusted rates are compared against original rates with slippage tolerance
3. Matches only proceed if prices are within acceptable ranges

## Development

### Prerequisites

- Node.js
- TON development tools (Blueprint, Tolk compiler)

### Scripts

Available deployment and interaction scripts in `scripts/`:

- `deployVaultFactory.ts` - Deploy the vault factory
- `createVault.ts` - Create a new vault
- `createOrder.ts` - Create a new order
- `matchOrder.ts` - Match two orders
- `closeOrder.ts` - Close an order

### Testing

Comprehensive test suite covers:

- Order creation and matching
- Slippage validation
- Fee calculations
- Edge cases and error handling
- Integration tests for full exchange flows


VaultFactory With Vault1

VaultFactory With Vault2

VaultFactory With Vault3
EQD06imrDSVaHRMTqE33vTtWg7yolwNjRpuaJCbEUWExV7sC


Info about TON
Vault's Address: 
Vault's Number: 1
----
Info about popular Jettons
1) 
Jetton's Name: NOT
Jetton's Address: EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT
Vault's Address: EQBFOVZf2xDm9B-8TSjIjaCZWXFmyzP7UkNq9GaoRS_FARpA
Vault's Number: 3

2) 
Jetton's Name: BUILD
Jetton's Address: EQBYnUrIlwBrWqp_rl-VxeSBvTR2VmTfC4ManQ657n_BUILD
Vault's Address: EQBikBaA97NugW6Cnmxnkl3cIKMAo2cHmkm1e5-3t5XtKb6Z
Vault's Number: 3

3) 
Jetton's Name: USDT
Jetton's Address: 
Vault's Address: 
Vault's Number: 3

4)
Jetton's Name: ANON
Jetton's Address: 
Vault's Address: 
Vault's Number: 2


If your jetton not supported in these vaults, you can make pull requests. You can change only calculateJettonWallet function. If you change other lines, we can't take your pull requests:(



Warning!!!:
if you create order where calculateJettonWallet in Vault doesn't match with your jetton wallet smart contract than vault doesn't create order