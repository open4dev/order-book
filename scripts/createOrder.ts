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
    const jettonWalletFrom = provider.open(JettonWallet.createFromAddress(Address.parse("EQAuEPbIhjYLNBoZbg6bnavSAnVea2vrtUOlz3q27nxxGdfB")));

    // const jettonWalletTo = provider.open(JettonWallet.createFromAddress(Address.parse("kQAj82m-kX_I8c0BKHOXW_FxM_qY55mALmSQ3eLRhyRX00Ws")));

    // const vaultTo = provider.open(Vault.createFromAddress(Address.parse("kQDh1QL2kQ5UEHhgOeOuEvwGC8_GaxpRFsI2f0dGWsLUQSO8")));

    await jettonWalletFrom.sendCreateOrder(
        provider.sender(),
        toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
        {
            jettonAmount: toNano(12),
            vault: Address.parse("0:4e6205887195257dc8c2822051f8ef26f5f2113bb111e37e6452ebb01c98472f"),
            owner: provider.sender().address!,
            priceRate: toNano(0.0833),
            slippage: toNano(0.02),
            toJettonMinter: Address.parse("0:589d4ac897006b5aaa7fae5f95c5e481bd34765664df0b831a9d0eb9ee7fc150"),
            forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005)
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
