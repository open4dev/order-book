import { Address, Cell, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { VaultFactory } from '../wrappers/VaultFactory';
import { jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { GAS_STORAGE, GAS_VAULT_FACTORY_CREATE_VAULT, GAS_EXCESS } from '../tests/Helper';

/**
 * Example script to create a vault from VaultFactory
 * 
 * Replace VAULT_FACTORY_ADDRESS with your actual VaultFactory address
 * For jetton vault: provide JETTON_WALLET_CODE and JETTON_MINTER_ADDRESS
 * For TON vault: set both to null
 */
export async function run(provider: NetworkProvider) {
    // Replace with your actual VaultFactory address
    const VAULT_FACTORY_ADDRESS = Address.parse("0:9fbdf148110edc19602ae7ff0cf8ef6c9f454e07255b4a3fbeba93d72345a955");
    
    const vaultFactory = provider.open(VaultFactory.createFromAddress(VAULT_FACTORY_ADDRESS));
    // ============================================
    // EXAMPLE 1: Create TON Vault
    // ============================================
    // Uncomment and use this example to create a TON vault:
    // For TON vault, set jettonWalletCode and jettonMinter to null
    // await vaultFactory.sendCreateVault(
    //     provider.sender(),
    //     GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE + GAS_EXCESS,
    //     null, // jettonWalletCode - null for TON vault
    //     null, // jettonMinter - null for TON vault
    // );
    
    // ============================================
    // EXAMPLE 2: Create Jetton Vault
    // ============================================
    // Uncomment and replace with your values:
    // const JETTON_MINTER_ADDRESS = Address.parse("YOUR_JETTON_MINTER_ADDRESS_HERE");
    
    // await vaultFactory.sendCreateVault(
    //     provider.sender(),
    //     GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE + GAS_EXCESS,
    //     jettonWalletCodeCell, // Use standard jetton wallet code, or provide custom code as Cell
    //     JETTON_MINTER_ADDRESS, // Address of the jetton minter
    // );
    
    // ============================================
    // EXAMPLE 3: Create Jetton Vault with Custom Wallet Code
    // ============================================
    // If you need to use a custom jetton wallet code:
    const CUSTOM_JETTON_WALLET_CODE = Cell.fromHex("b5ee9c7201010101002300084202ba2918c8947e9b25af9ac1b883357754173e5812f807a3d6e642a14709595395");
    const JETTON_MINTER_ADDRESS = Address.parse("EQBYnUrIlwBrWqp_rl-VxeSBvTR2VmTfC4ManQ657n_BUILD");
    
    await vaultFactory.sendCreateVault(
        provider.sender(),
        GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE + GAS_EXCESS,
        CUSTOM_JETTON_WALLET_CODE,
        JETTON_MINTER_ADDRESS,
    );
}
