import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';

export async function run(provider: NetworkProvider) {
    // FOR JETTONS
    // const jettonWalletFrom = provider.open(JettonWallet.createFromAddress(Address.parse("EQAuEPbIhjYLNBoZbg6bnavSAnVea2vrtUOlz3q27nxxGdfB")));
    const jettonWalletTo = provider.open(JettonWallet.createFromAddress(Address.parse("EQC1VShF94mPWP5d0XCuK1q40-6RCIjrXX6236uuZMto1fzn")));

    // FOR TON
    // const vaultTo = provider.open(Vault.createFromAddress(Address.parse("kQDh1QL2kQ5UEHhgOeOuEvwGC8_GaxpRFsI2f0dGWsLUQSO8")));

    // await jettonWalletFrom.sendCreateOrder(
    //     provider.sender(),
    //     toNano(0.15 + 0.01 + 0.00206 + 0.007084 + 0.003278),
    //     {
    //         jettonAmount: toNano(2),
    //         vault: Address.parse("EQB-veAjqC2M0xajfPIywpKH6S8un37CzXay5rBqmofSzQ92"),
    //         owner: provider.sender().address!,
    //         priceRate: toNano(0.1),
    //         slippage: toNano(0.02),
    //         toJettonMinter: Address.parse("EQDv-yr41_CZ2urg2gfegVfa44PDPjIK9F-MilEDKDUIhlwZ"),
    //         forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
    //         providerFee: provider.sender().address!,
    //         feeNum: 1,
    //         feeDenom: 1000,
    //         matcherFeeNum: 1,
    //         matcherFeeDenom: 1000,
    //     }
    // )

    await jettonWalletTo.sendCreateOrder(
        provider.sender(),
        toNano(0.15 + 0.01 + 0.00206 + 0.007084 + 0.003278),
        {
            jettonAmount: toNano(0.2),
            vault: Address.parse("EQDnxXnLsOriHkllFh_vZCQ6wvTibWdHpTC7_waJdEVzGHbC"),
            owner: provider.sender().address!,
            priceRate: toNano(10),
            slippage: toNano(0.02),
            toJettonMinter: Address.parse("0:2f956143c461769579baef2e32cc2d7bc18283f40d20bb03e432cd603ac33ffc"),
            forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
            providerFee: provider.sender().address!,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
        }
    )

    // await vaultTo.sendCreateOrder(provider.sender(), toNano(1.1), {
    //     amount: toNano(1),
    //     priceRate: toNano(30),
    //     slippage: toNano(0.02),
    //     toJettonMinter: Address.parse("kQBz3lxXqAPk3kTkQGvK8LF3EJ9-cBlbZcbffdYBrECuJYxJ"),
    // })
}
