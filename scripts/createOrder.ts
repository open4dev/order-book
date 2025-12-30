import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';

export async function run(provider: NetworkProvider) {
    // FOR JETTONS
    // const jettonWallet = provider.open(JettonWallet.createFromAddress(Address.parse("ADDRESS_HERE")));
    // await jettonWallet.sendCreateOrder(
    //     provider.sender(),
    //     toNano(0.15 + 0.01 + 0.00206 + 0.007084 + 0.003278),
    //     {
    //         jettonAmount: toNano(NUMBER),
    //         vault: Address.parse("ADDRESS_HERE"),
    //         owner: provider.sender().address!,
    //         priceRate: toNano(NUMBER),
    //         slippage: toNano(NUMBER), // default slippage is 2%
    //         toJettonMinter: Address.parse("ADDRESS_HERE"),
    //         forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
    //         providerFee: provider.sender().address!,
    //         feeNum: NUMBER, // uint14
    //         feeDenom: NUMBER, // uint14
    //         matcherFeeNum: NUMBER, // uint14
    //         matcherFeeDenom: NUMBER, // uint14
    //     }
    // )


    // const jettonWalletNOT = provider.open(JettonWallet.createFromAddress(Address.parse("EQAA6dgNLns8qD9nwG6L1cz7YdZjxXhG_khoY3L0K65P4NQz")));
    // await jettonWalletNOT.sendCreateOrder(
    //     provider.sender(),
    //     toNano(0.15 + 0.01 + 0.00206 + 0.007084 + 0.003278),
    //     {
    //         jettonAmount: toNano(1),
    //         vault: Address.parse("EQA8yOYAcTFc_PlaZqgVl8T0E3_493hzSgD2GXgQEj4bS_In"),
    //         owner: provider.sender().address!,
    //         priceRate: toNano(0.1),
    //         slippage: toNano(0.02), // default slippage is 2%
    //         toJettonMinter: Address.parse("EQBYnUrIlwBrWqp_rl-VxeSBvTR2VmTfC4ManQ657n_BUILD"),
    //         forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
    //         providerFee: provider.sender().address!,
    //         feeNum: 1, // uint14
    //         feeDenom: 1000, // uint14
    //         matcherFeeNum: 1, // uint14
    //         matcherFeeDenom: 1000, // uint14
    //     }
    // )


    // const jettonWalletBUILD = provider.open(JettonWallet.createFromAddress(Address.parse("EQASOdIumhULjDuW74Q_7yFD6pWa5hAbSawQ1c1wV6l9Pwj9")));
    // await jettonWalletBUILD.sendCreateOrder(
    //     provider.sender(),
    //     toNano(0.15 + 0.01 + 0.00206 + 0.007084 + 0.003278),
    //     {
    //         jettonAmount: toNano(0.05),
    //         vault: Address.parse("EQD45c5VAClGgnUJAiGzGcgnC6MpJ73wynLkUykgtp2QouJ6"),
    //         owner: provider.sender().address!,
    //         priceRate: toNano(10),
    //         slippage: toNano(0.02), // default slippage is 2%
    //         toJettonMinter: Address.parse("EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT"),
    //         forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
    //         providerFee: provider.sender().address!,
    //         feeNum: 1, // uint14
    //         feeDenom: 1000, // uint14
    //         matcherFeeNum: 1, // uint14
    //         matcherFeeDenom: 1000, // uint14
    //     }
    // )


    const jettonWalletNOT = provider.open(JettonWallet.createFromAddress(Address.parse("EQAA6dgNLns8qD9nwG6L1cz7YdZjxXhG_khoY3L0K65P4NQz")));
    await jettonWalletNOT.sendCreateOrder(
        provider.sender(),
        toNano(0.15 + 0.01 + 0.00206 + 0.007084 + 0.003278),
        {
            jettonAmount: toNano(0.5),
            vault: Address.parse("EQA8yOYAcTFc_PlaZqgVl8T0E3_493hzSgD2GXgQEj4bS_In"),
            owner: provider.sender().address!,
            priceRate: toNano(0.1),
            slippage: toNano(0.02), // default slippage is 2%
            toJettonMinter: Address.parse("EQBYnUrIlwBrWqp_rl-VxeSBvTR2VmTfC4ManQ657n_BUILD"),
            forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
            providerFee: provider.sender().address!,
            feeNum: 1, // uint14
            feeDenom: 1000, // uint14
            matcherFeeNum: 1, // uint14
            matcherFeeDenom: 1000, // uint14
        }
    )

    

    // FOR TON
    // const vaultTo = provider.open(Vault.createFromAddress(Address.parse("ADDRESS_HERE")));
    // await vaultTo.sendCreateOrder(provider.sender(), toNano(amount + ), {
    //     amount: toNano(NUMBER),
    //     priceRate: toNano(NUMBER),
    //     slippage: toNano(NUMBER), // default slippage is 2%
    //     toJettonMinter: Address.parse("ADDRESS_HERE"),
    // })


    // const vaultTo = provider.open(Vault.createFromAddress(Address.parse("EQC5x_lgkWNW3G3A3bh3pz9fkFXF0VZLqkx-gGOgwRm9LBoX")));
    // await vaultTo.sendCreateOrder(provider.sender(), toNano(0.05 + 0.01 + 0.00186 + 0.006886), {
    //     amount: toNano(0.05),
    //     priceRate: toNano(10),
    //     slippage: toNano(0.02), // default slippage is 2%
    //     toJettonMinter: Address.parse("EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT"),
    //     providerFee: provider.sender().address!,
    //     feeNum: 1, // uint14
    //     feeDenom: 1000, // uint14
    //     matcherFeeNum: 1, // uint14
    //     matcherFeeDenom: 1000, // uint14
    // })
}
