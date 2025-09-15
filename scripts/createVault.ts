import { Address, Cell, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { jettonWalletCodeCell } from '../wrappers/JettonWallet';
// import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';

// jetton minter from kQBz3lxXqAPk3kTkQGvK8LF3EJ9-cBlbZcbffdYBrECuJYxJ
// vault from 0QCcamEepPcBnfczp0I2oUO214_5DuRm4ilWvgo7GmNYgq7p

// jetton minter to kQDegHRHZdro9SYipDnQ41pji9HSJteoYBRS8lfpMzHGUjhg
// vault to 0QASeOhar42-kOaN9ir6EaOJaobHq47OfgyHDKUpGDASig9e

export async function run(provider: NetworkProvider) {
    const vaultFactory = provider.open(VaultFactory.createFromAddress(Address.parse("kQANiTyC9GqReYiDIXbF5FvgbebMzMDUXHLM9mVSjBZYDTzp")));

    // await vaultFactory.sendCreateVault(
    //     provider.sender(),
    //     toNano(0.0065 + 0.0019 + 0.01),
    //     jettonWalletCodeCell,
    //     Address.parse("kQBz3lxXqAPk3kTkQGvK8LF3EJ9-cBlbZcbffdYBrECuJYxJ")
    // );

    // sleep(10000);

    await vaultFactory.sendCreateVault(
        provider.sender(),
        toNano(0.0065 + 0.0019 + 0.01),
        null,
        null,
    );

    
    // run methods on `vaultFactory`
}
