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

- **VaultFactory** (`vault_factory.tolk`) - Factory contract for creating and managing vault instances. Handles vault deployment.

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
- **CloseOrder**: Close an order and return remaining funds to owner
- **WithDraw**: Withdraw accumulated fees (called by FeeCollector)

### VaultFactory Contract

The VaultFactory manages vault creation:

- **CreateVault**: Create a new vault instance for a specific token
- **InitVaultFactory**: Initialize the factory contract

### FeeCollector Contract

The FeeCollector accumulates matcher fees:

- **AddFee**: Add matcher fee from vault (called by vault)
- **WithDraw**: Withdraw accumulated fees to the owner (called by owner)

## Fee Structure

The system uses a dual fee model:

- **Provider Fee**: Charged by the vault provider (specified as feeNum/feeDenom ratio)
- **Matcher Fee**: Charged by the order matcher (specified as matcherFeeNum/matcherFeeDenom ratio)

Fees are calculated and deducted during order matching, with matcher fees collected in FeeCollector contracts. Fee rates are set by users when creating orders and are not validated by smart contracts.

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


## Deployed Contracts

### Mainnet

#### VaultFactory

The VaultFactory contract is deployed with support for multiple vault versions:

| Vault Version | Mainnet Address |
|---------------|-----------------|
| VaultFactory with Vault1 | `EQB5xR__XIv9NcKoTBvgEQ2-3oTsuaWyxbPkdFiChhCzBIoC` |
| VaultFactory with Vault2 | `EQBRd1-3qzORVjva65etFNKFsCXqTkON8oskXGxgIqRHJePP` |
| VaultFactory with Vault3 | `EQBpSaQ_O01PaQ2upvTZdjyJiisZqbDBSQQ5J6I3GLD-pwMv` |

#### Supported Tokens

##### TON (Native)

| Property | Value |
|----------|-------|
| **Vault Address** | `EQC5x_lgkWNW3G3A3bh3pz9fkFXF0VZLqkx-gGOgwRm9LBoX` |
| **Vault Version** | 1 |

##### Popular Jettons

###### 1. NOT

| Property | Value |
|----------|-------|
| **Jetton Address** | `EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT` |
| **Vault Address** | `EQA8yOYAcTFc_PlaZqgVl8T0E3_493hzSgD2GXgQEj4bS_In` |
| **Vault Version** | 3 |

###### 2. BUILD

| Property | Value |
|----------|-------|
| **Jetton Address** | `EQBYnUrIlwBrWqp_rl-VxeSBvTR2VmTfC4ManQ657n_BUILD` |
| **Vault Address** | `EQD45c5VAClGgnUJAiGzGcgnC6MpJ73wynLkUykgtp2QouJ6` |
| **Vault Version** | 3 |

###### 3. USDT

| Property | Value |
|----------|-------|
| **Jetton Address** | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` |
| **Vault Address** | `EQBhQUL8m7xWdas74NF1NUTbEYS3RRS0G7-wuRcUuI3yg-wV` |
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

## Contributing

### Adding New Jetton Support

If your jetton is not supported in these vaults, you can submit a pull request. 

**Important:** You can **only** modify the `calculateJettonWallet` function. Pull requests that modify other parts of the code will not be accepted.

### ⚠️ Warning

If you create an order where the `calculateJettonWallet` function in the Vault doesn't match your jetton wallet smart contract, the vault **will not create the order**.