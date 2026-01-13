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
    const VAULT_FACTORY_ADDRESS = Address.parse("YOUR_VAULT_FACTORY_ADDRESS_HERE");
    
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
    // const CUSTOM_JETTON_WALLET_CODE = Cell.fromHex("YOUR_CUSTOM_JETTON_WALLET_CODE_HEX_HERE");
    // const JETTON_MINTER_ADDRESS = Address.parse("YOUR_JETTON_MINTER_ADDRESS_HERE");
    // 
    // await vaultFactory.sendCreateVault(
    //     provider.sender(),
    //     GAS_VAULT_FACTORY_CREATE_VAULT + GAS_STORAGE + GAS_EXCESS,
    //     CUSTOM_JETTON_WALLET_CODE,
    //     JETTON_MINTER_ADDRESS,
    // );
}
