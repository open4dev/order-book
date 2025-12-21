# order-book

## Project structure

-   `contracts` - source code of all the smart contracts of the project and their dependencies.
-   `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
-   `tests` - tests for the contracts.
-   `scripts` - scripts used by the project, mainly the deployment scripts.

## How to use

### Build

`npx blueprint build` or `yarn blueprint build`

### Test

`npx blueprint test` or `yarn blueprint test`

### Deploy or run another script

`npx blueprint run` or `yarn blueprint run`

### Add a new contract

`npx blueprint create ContractName` or `yarn blueprint create ContractName`



## Max Gas Contract V1.0 

### VaultFactory

CreateVault = 0.007053
ChangeOwner = 0.00068
InitVaultFactory = 0.000426

### Vault

VaultJettonTransfer = 0.00873
JettonTransferNotification = 0.04024
InitVault = 0.000438
TonTransfer = 0.004647
WithDraw = 0.002191(ton)-0.004054(jetton)

### Order

MatchOrder = 0.003517
InternalMatchOrder = 0.00753
CloseOrder = 0.002568
InitOrder = 0.00176
SuccessMatch = 0.004212

### FeeCollector

WithDraw = 0.001595
AddFee = 0.000753