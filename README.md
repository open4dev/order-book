# order-book

A decentralized order book system for TON blockchain that enables peer-to-peer token exchanges (jetton-jetton, TON-jetton, jetton-TON) with slippage protection, fee management, and order matching capabilities.

## Project structure

-   `contracts` - source code of all the smart contracts of the project and their dependencies.
    -   `contracts/utils` - shared utilities and helper functions used across contracts
-   `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
-   `tests` - tests for the contracts.
-   `scripts` - scripts used by the project, mainly the deployment scripts.

## Architecture

The order book system consists of several key smart contracts with a modular, utility-based architecture:

### Core Contracts

- **Order** (`order.tolk`) - Represents a single trading order with exchange parameters (amount, price rate, slippage). Handles order matching, validation, and closing. Uses utility functions from `messages.tolk` and `fee_calc.tolk` for simplified message handling and fee calculations.

- **Vault** (`vault.tolk`, `vault2.tolk`, `vault3.tolk`, `vault_ton.tolk`) - Token storage contract that holds user funds for orders. Supports both TON and jetton deposits. Different versions handle jetton wallet address calculation differently:
  - `vault.tolk` - Standard jetton vault (version 1)
  - `vault2.tolk` - Alternative jetton wallet calculation (version 2)
  - `vault3.tolk` - Alternative jetton wallet calculation (version 3)
  - `vault_ton.tolk` - TON-native vault for TON/jetton exchanges

- **VaultFactory** (`vault_factory.tolk`) - Factory contract for creating and managing vault instances. Handles vault deployment with different versions.

- **FeeCollector** (`fee_collector.tolk`) - Collects and manages matcher fees from successful order matches. Uses utility functions from `messages.tolk` for simplified message handling.

### Utility Modules

The project uses a modular utility system for code reusability and maintainability:

- **`utils/messages.tolk`** - Centralized message sending utilities:
  - `sendSimpleMessage` - Simple messages without bounce
  - `sendBouncedMessage` - Messages with rich bounce for recoverable operations
  - `sendJettonTransfer` - Jetton transfer helper
  - `sendFeeToCollector` - Send fees to fee collector
  - `sendFeeToProvider` - Send fees to provider

- **`utils/fee_calc.tolk`** - Fee calculation utilities:
  - `calculateFees` - Calculate provider and matcher fees from amount
  - `addFeesToRate` - Add fees to price rate for slippage validation

- **`utils/types.tolk`** - Shared type definitions:
  - `JettonInfo` - Jetton information structure
  - `FeeInfo` - Fee configuration structure
  - `TransferAddresses` - Address structure for transfers

- **`utils/fees.tolk`** - Gas constants for all contract operations

- **`utils/errors.tolk`** - Error code constants

- **`utils/op_codes.tolk`** - Operation code constants

- **`utils/generate_addresses.tolk`** - Address generation utilities for orders and fee collectors

### Key Features

- **Multi-token Support**: Exchange between jettons (jetton-jetton), TON and jettons (TON-jetton, jetton-TON)
- **Slippage Protection**: Built-in slippage validation to protect users from unfavorable price movements
- **Fee System**: Dual fee structure with provider fees and matcher fees, calculated using centralized utilities
- **Order Matching**: Automatic matching of compatible orders with price validation
- **Partial Fills**: Support for partial order execution
- **Order Management**: Create, match, and close orders with proper state management
- **Modular Architecture**: Clean separation of concerns with reusable utility modules

### Exchange Flow

1. User creates a vault for their token (via VaultFactory)
2. User deposits tokens to vault (via JettonTransferNotification or TonTransfer)
3. Vault creates an Order contract with exchange parameters
4. Matcher finds compatible orders and initiates matching
5. Orders validate price compatibility (with slippage and fees using `fee_calc.tolk` utilities)
6. Tokens are transferred through vaults with fee deductions (using `messages.tolk` utilities)
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

The Order contract manages individual trading orders using utility functions for message handling and fee calculations:

- **InitOrder**: Initialize an order with amount, price rate, slippage, and fee info
- **MatchOrder**: Initiate matching with another order (called by matcher)
- **InternalMatchOrder**: Internal matching logic with slippage and fee validation (uses `fee_calc.tolk` for fee calculations)
- **SuccessMatch**: Confirm successful match and update order state
- **CloseOrder**: Close an order and return remaining funds to owner

**Key utilities used:**
- `sendBouncedMessage` from `messages.tolk` for internal order matching
- `sendSimpleMessage` from `messages.tolk` for vault communication
- `addFeesToRate` from `fee_calc.tolk` for slippage validation
- `isWithinSlippage` for price validation

### Vault Contract

The Vault contract stores tokens and manages transfers using centralized message utilities:

- **InitVault**: Initialize vault with factory reference and token info
- **JettonTransferNotification**: Receive jetton deposits and create orders
- **TonTransfer** (VaultTon only): Receive TON deposits and create orders
- **VaultJettonTransfer**: Transfer tokens to matched orders with fee calculation (uses `calculateFees` from `fee_calc.tolk`)
- **CloseOrder**: Close an order and return remaining funds to owner
- **WithDraw**: Withdraw accumulated fees (called by FeeCollector)

**Key utilities used:**
- `sendJettonTransfer` from `messages.tolk` for token transfers
- `sendFeeToCollector` and `sendFeeToProvider` from `messages.tolk` for fee distribution
- `calculateFees` from `fee_calc.tolk` for fee calculations
- `calculateJettonWallet` - vault-specific function for jetton wallet address calculation

**Note:** Different vault versions (`vault.tolk`, `vault2.tolk`, `vault3.tolk`) implement different `calculateJettonWallet` functions to support various jetton wallet implementations.

### VaultFactory Contract

The VaultFactory manages vault creation using utility functions:

- **CreateVault**: Create a new vault instance for a specific token
- **InitVaultFactory**: Initialize the factory contract

**Key utilities used:**
- `sendSimpleMessage` from `messages.tolk` for vault initialization

### FeeCollector Contract

The FeeCollector accumulates matcher fees using message utilities:

- **AddFee**: Add matcher fee from vault (called by vault)
- **WithDraw**: Withdraw accumulated fees to the owner (called by owner)

**Key utilities used:**
- `sendSimpleMessage` from `messages.tolk` for vault communication

## Fee Structure

The system uses a dual fee model with centralized fee calculation:

- **Provider Fee**: Charged by the vault provider (specified as feeNum/feeDenom ratio)
- **Matcher Fee**: Charged by the order matcher (specified as matcherFeeNum/matcherFeeDenom ratio)

Fees are calculated using the `calculateFees` function from `fee_calc.tolk`, which:
- Calculates both provider and matcher fees from the transfer amount
- Returns the net transfer amount after fee deductions
- Handles zero fees gracefully

Fees are deducted during order matching, with matcher fees collected in FeeCollector contracts. Fee rates are set by users when creating orders and are not validated by smart contracts.

## Slippage Protection

Orders include slippage tolerance parameters. During matching:

1. Price rates are adjusted to include fees using `addFeesToRate` from `fee_calc.tolk`
2. Adjusted rates are compared against original rates with slippage tolerance using `isWithinSlippage`
3. Matches only proceed if prices are within acceptable ranges (both orders must validate each other's rates)

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


## Deployed Contracts

### Mainnet

#### VaultFactory

The VaultFactory contract is deployed with support for multiple vault versions:

| Vault Version | Mainnet Address |
|---------------|-----------------|
| VaultFactory with Vault1 | `` |
| VaultFactory with Vault2 | `` |
| VaultFactory with Vault3 | `EQDjePE-do4Dn-ydes9s4UdK28EW3vVD6PVrlN59wNB3lwTX` |
| VaultFactory with VaultTon(0) | `EQAX8remy7sQLsWYv9ChULQz4GYqPHaqrgqA1Y-SqTLM6aQ1` |

#### Supported Tokens

##### TON (Native)

| Property | Value |
|----------|-------|
| **Vault Address** | `EQD-fT3BFC3EBpzq7I0awO4pShsd1rlhGiHNbGYPBxOYOUSe` |
| **Vault Version** | 1 |

##### Popular Jettons

###### 1. NOT

| Property | Value |
|----------|-------|
| **Jetton Address** | `EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT` |
| **Vault Address** | `EQBCg_3o5JK6Zf0aQjGTC3MQGEHYlCaqBMqQl2-xqfHtJrIS` |
| **Vault Version** | 3 |

###### 2. BUILD

| Property | Value |
|----------|-------|
| **Jetton Address** | `EQBYnUrIlwBrWqp_rl-VxeSBvTR2VmTfC4ManQ657n_BUILD` |
| **Vault Address** | `EQBcViopEOVaVLmD2O26ANM12GyfFBUNpZUMTnMd8SP6heUr` |
| **Vault Version** | 3 |

###### 3. USDT

| Property | Value |
|----------|-------|
| **Jetton Address** | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` |
| **Vault Address** | `EQBF5UcxBqvNdN_D2roBj3ICvHxRL5cVCwNu8flt9coki4K6` |
| **Vault Version** | 3 |

###### 4. ANON

| Property | Value |
|----------|-------|
| **Jetton Address** | _To be added_ |
| **Vault Address** | _To be added_ |
| **Vault Version** | 2 |

---

### Testnet

#### VaultFactory

The VaultFactory contract is deployed with support for multiple vault versions:

| Vault Version | Testnet Address |
|---------------|-----------------|
| VaultFactory with Vault1 | _To be added_ |
| VaultFactory with Vault2 | _To be added_ |
| VaultFactory with Vault3 | _To be added_ |

#### Supported Tokens

##### TON (Native)

| Property | Value |
|----------|-------|
| **Vault Address** | _To be added_ |
| **Vault Version** | 1 |

##### Popular Jettons

###### 1. NOT

| Property | Value |
|----------|-------|
| **Jetton Address** | _To be added_ |
| **Vault Address** | _To be added_ |
| **Vault Version** | 3 |

###### 2. BUILD

| Property | Value |
|----------|-------|
| **Jetton Address** | _To be added_ |
| **Vault Address** | _To be added_ |
| **Vault Version** | 3 |

###### 3. USDT

| Property | Value |
|----------|-------|
| **Jetton Address** | _To be added_ |
| **Vault Address** | _To be added_ |
| **Vault Version** | 3 |

###### 4. ANON

| Property | Value |
|----------|-------|
| **Jetton Address** | _To be added_ |
| **Vault Address** | _To be added_ |
| **Vault Version** | 2 |

---

## Code Architecture

The project follows a modular architecture with clear separation of concerns:

### Utility-Based Design

All contracts use centralized utility modules to avoid code duplication:

- **Message Handling**: All message sending is done through `messages.tolk` utilities (`sendSimpleMessage`, `sendBouncedMessage`, `sendJettonTransfer`, `sendFeeToCollector`, `sendFeeToProvider`)
- **Fee Calculations**: All fee calculations use `fee_calc.tolk` functions (`calculateFees`, `addFeesToRate`)
- **Type Definitions**: Shared types are defined in `types.tolk` (`JettonInfo`, `FeeInfo`, `TransferAddresses`)
- **Constants**: Gas and operation codes are centralized in `fees.tolk` and `op_codes.tolk`

This architecture makes the codebase:
- **More maintainable**: Changes to message handling or fee logic only need to be made in one place
- **More readable**: Contracts focus on business logic, not implementation details
- **More testable**: Utilities can be tested independently
- **Less error-prone**: Reduced code duplication means fewer places for bugs

### Contract Structure

Each contract follows a consistent structure:
1. Import utility modules
2. Define contract-specific structures
3. Implement business logic using utilities
4. Handle messages with proper validation

## Contributing

### Adding New Jetton Support

If your jetton is not supported in these vaults, you can submit a pull request. 

**Important:** You can **only** modify the `calculateJettonWallet` function in the appropriate vault file (`vault.tolk`, `vault2.tolk`, or `vault3.tolk`). Pull requests that modify other parts of the code (especially utility modules) will not be accepted unless there's a clear architectural reason.

### ⚠️ Warning

If you create an order where the `calculateJettonWallet` function in the Vault doesn't match your jetton wallet smart contract, the vault **will not create the order**.