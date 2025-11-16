import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';

// jetton minter from kQBz3lxXqAPk3kTkQGvK8LF3EJ9-cBlbZcbffdYBrECuJYxJ
// jetton wallet from kQDC3gHQEgdmIdxXgJWAwRRTmcIwS0DWvvosPFu9c6_KH0ql
// vault from kQBFpDbB6EcDQXe9tQikpMQccuruAGAeg_1vEDjaUy-gqQ-D

// jetton minter to 
// jetton wallet to 
// vault to kQDh1QL2kQ5UEHhgOeOuEvwGC8_GaxpRFsI2f0dGWsLUQSO8

export async function run(provider: NetworkProvider) {
    const jettonWalletFrom = provider.open(JettonWallet.createFromAddress(Address.parse("EQD-Wa7yrUuozviItJPl_2zUK-Gfn81f8udP5AsZ__jdU3eg")));

    // const jettonWalletTo = provider.open(JettonWallet.createFromAddress(Address.parse("kQAj82m-kX_I8c0BKHOXW_FxM_qY55mALmSQ3eLRhyRX00Ws")));

    // const vaultTo = provider.open(Vault.createFromAddress(Address.parse("kQDh1QL2kQ5UEHhgOeOuEvwGC8_GaxpRFsI2f0dGWsLUQSO8")));

    await jettonWalletFrom.sendCreateOrder(
        provider.sender(),
        toNano(0.14),
        {
            jettonAmount: toNano(0.001),
            vault: Address.parse("EQDRbM3iuAXWuEsMeTbzBrytQ9PlGb_5_3BWPLntMQ125rTh"),
            owner: provider.sender().address!,
            priceRate: toNano(0.3003003003),
            slippage: toNano(0.02),
            toJettonMinter: null,
            forwardTonAmount: toNano(0.002 + 0.01 + 0.007)
        }
    )

    // await jettonWalletTo.sendCreateOrder(
    //     provider.sender(),
    //     toNano(0.14),
    //     {
    //         jettonAmount: toNano(15000),
    //         vault: Address.parse("0QASeOhar42-kOaN9ir6EaOJaobHq47OfgyHDKUpGDASig9e"),
    //         owner: provider.sender().address!,
    //         priceRate: toNano(0.0000300003),
    //         slippage: toNano(0.02),
    //         toJettonMinter: Address.parse("kQBz3lxXqAPk3kTkQGvK8LF3EJ9-cBlbZcbffdYBrECuJYxJ"),
    //         forwardTonAmount: toNano(0.09)
    //     }
    // )

    // await vaultTo.sendCreateOrder(provider.sender(), toNano(1.1), {
    //     amount: toNano(1),
    //     priceRate: toNano(30),
    //     slippage: toNano(0.02),
    //     toJettonMinter: Address.parse("kQBz3lxXqAPk3kTkQGvK8LF3EJ9-cBlbZcbffdYBrECuJYxJ"),
    // })
}
