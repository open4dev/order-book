import { toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile } from '@ton/blueprint';
import { GAS_STORAGE, GAS_VAULT_FACTORY_INIT, GAS_EXCESS } from '../tests/Helper';

/**
 * Example script to deploy VaultFactory
 * 
 * This script deploys a new VaultFactory contract with:
 * - Vault3 as the vault implementation
 * - Order as the order implementation
 * - FeeCollector as the fee collector implementation
 * 
 * You can change the vault version (Vault, Vault2, Vault3) by modifying the compile call
 */
export async function run(provider: NetworkProvider) {
    // ============================================
    // EXAMPLE: Deploy VaultFactory
    // ============================================
    // Uncomment to deploy a new VaultFactory:
    
    // Compile contracts
    const vaultCode = await compile('Vault3'); // You can change to 'Vault' or 'Vault2'
    const orderCode = await compile('Order');
    const feeCollectorCode = await compile('FeeCollector');
    const vaultFactoryCode = await compile('VaultFactory');
    
    // Create and deploy VaultFactory
    const vaultFactory = provider.open(VaultFactory.createFromConfig({
        vaultCode: vaultCode,
        orderCode: orderCode,
        feeCollectorCode: feeCollectorCode,
    }, vaultFactoryCode));
    
    // Deploy with gas + excess (excess will be returned)
    await vaultFactory.sendDeploy(
        provider.sender(),
        GAS_VAULT_FACTORY_INIT + GAS_STORAGE + GAS_EXCESS
    );
    
    // Wait for deployment to complete
    await provider.waitForDeploy(vaultFactory.address);
    
    console.log('VaultFactory deployed at:', vaultFactory.address.toString());
    console.log('You can now use this address to create vaults');
}

