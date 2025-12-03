import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet.old';
import { Vault } from '../wrappers/Vault';

// jetton minter from kQBz3lxXqAPk3kTkQGvK8LF3EJ9-cBlbZcbffdYBrECuJYxJ
// jetton wallet from kQDC3gHQEgdmIdxXgJWAwRRTmcIwS0DWvvosPFu9c6_KH0ql
// vault from kQBFpDbB6EcDQXe9tQikpMQccuruAGAeg_1vEDjaUy-gqQ-D

// jetton minter to 
// jetton wallet to 
// vault to kQDh1QL2kQ5UEHhgOeOuEvwGC8_GaxpRFsI2f0dGWsLUQSO8

export async function run(provider: NetworkProvider) {
    const jettonWalletFrom = provider.open(JettonWallet.createFromAddress(Address.parse("EQCDO7X7VSahgvc6Mz8kRECeNh59mxvBYE2h9F2kphNwPjE4")));

    // const jettonWalletTo = provider.open(JettonWallet.createFromAddress(Address.parse("EQAuEPbIhjYLNBoZbg6bnavSAnVea2vrtUOlz3q27nxxGdfB")));

    // const vaultTo = provider.open(Vault.createFromAddress(Address.parse("kQDh1QL2kQ5UEHhgOeOuEvwGC8_GaxpRFsI2f0dGWsLUQSO8")));

    await jettonWalletFrom.sendCreateOrder(
        provider.sender(),
        toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
        {
            jettonAmount: toNano(0.01),
            vault: Address.parse("0:d81c73f731f3df114d73eb20aee0f0197b4dc52019daf9cfb1102b1a89d91cac"),
            owner: provider.sender().address!,
            priceRate: toNano(10),
            slippage: toNano(0),
            toJettonMinter: Address.parse("0:2f956143c461769579baef2e32cc2d7bc18283f40d20bb03e432cd603ac33ffc"),
            forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005)
        }
    )

    // await jettonWalletTo.sendCreateOrder(
    //     provider.sender(),
    //     toNano(0.02 + 0.002 + 0.01 + 0.007 + 0.005),
    //     {
    //         jettonAmount: toNano(0.1),
    //         vault: Address.parse("0:4e6205887195257dc8c2822051f8ef26f5f2113bb111e37e6452ebb01c98472f"),
    //         owner: provider.sender().address!,
    //         priceRate: toNano(0.1),
    //         slippage: toNano(0),
    //         toJettonMinter: Address.parse("0:589d4ac897006b5aaa7fae5f95c5e481bd34765664df0b831a9d0eb9ee7fc150"),
    //         forwardTonAmount: toNano(0.002 + 0.01 + 0.007 + 0.005)
    //     }
    // )

    // await vaultTo.sendCreateOrder(provider.sender(), toNano(1.1), {
    //     amount: toNano(1),
    //     priceRate: toNano(30),
    //     slippage: toNano(0.02),
    //     toJettonMinter: Address.parse("kQBz3lxXqAPk3kTkQGvK8LF3EJ9-cBlbZcbffdYBrECuJYxJ"),
    // })
}