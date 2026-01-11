import { Address, Cell } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { VaultFactory } from '../wrappers/VaultFactory';
import { Gas, JettonWalletCodes, JettonMinters } from './config';

export async function run(provider: NetworkProvider) {
    // VaultFactory address (update for your deployment)
    const vaultFactoryAddress = Address.parse("EQB5xR__XIv9NcKoTBvgEQ2-3oTsuaWyxbPkdFiChhCzBIoC");
    const vaultFactory = provider.open(VaultFactory.createFromAddress(vaultFactoryAddress));

    // ==================== TON VAULT ====================
    // Create vault for TON (no jetton wallet code needed)

    await vaultFactory.sendCreateVault(
        provider.sender(),
        Gas.CREATE_VAULT,
        null,
        null,
    );

    // ==================== JETTON VAULT ====================
    // Uncomment and configure for specific jetton

    // NOT vault
    // await vaultFactory.sendCreateVault(
    //     provider.sender(),
    //     Gas.CREATE_VAULT,
    //     JettonWalletCodes.NOT,
    //     JettonMinters.NOT,
    // );

    // BUILD vault
    // await vaultFactory.sendCreateVault(
    //     provider.sender(),
    //     Gas.CREATE_VAULT,
    //     JettonWalletCodes.BUILD,
    //     JettonMinters.BUILD,
    // );

    // USDT vault
    // await vaultFactory.sendCreateVault(
    //     provider.sender(),
    //     Gas.CREATE_VAULT,
    //     JettonWalletCodes.USDT,
    //     JettonMinters.USDT,
    // );

    // ANON vault
    // await vaultFactory.sendCreateVault(
    //     provider.sender(),
    //     Gas.CREATE_VAULT,
    //     JettonWalletCodes.ANON,
    //     JettonMinters.ANON,
    // );
}
