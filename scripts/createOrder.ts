import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';
import { VaultTon } from '../wrappers/VaultTon';
import { GAS_CREATE_ORDER_JETTON, GAS_CREATE_ORDER_TON } from '../tests/Helper';

export async function run(provider: NetworkProvider) {
    // FOR JETTONS
    // const jettonWallet = provider.open(JettonWallet.createFromAddress(Address.parse("ADDRESS_HERE")));
    // await jettonWallet.sendCreateOrder(
    //     provider.sender(),
    //     toNano(0.15 + 0.01 + 0.04 + 0.006884 + 0.003078),
    //     {
    //         jettonAmount: toNano(NUMBER),
    //         vault: Address.parse("ADDRESS_HERE"),
    //         owner: provider.sender().address!,
    //         priceRate: toNano(NUMBER),
    //         slippage: toNano(NUMBER), // default slippage is 2%
    //         toJettonMinter: Address.parse("ADDRESS_HERE"),
    //         forwardTonAmount: toNano(0.01 + 0.04 + 0.006884 + 0.003078),
    //         providerFee: provider.sender().address!,
    //         feeNum: NUMBER, // uint14
    //         feeDenom: NUMBER, // uint14
    //         matcherFeeNum: NUMBER, // uint14
    //         matcherFeeDenom: NUMBER, // uint14
    //     }
    // )


    // const jettonWalletNOT = provider.open(JettonWallet.createFromAddress(Address.parse("EQAuEPbIhjYLNBoZbg6bnavSAnVea2vrtUOlz3q27nxxGdfB")));
    // await jettonWalletNOT.sendCreateOrder(
    //     provider.sender(),
    //     toNano(0.1) + GAS_CREATE_ORDER_JETTON,
    //     {
    //         jettonAmount: toNano(0.2),
    //         vault: Address.parse("0:c68b949f23f40ef685bf3153524c5f9600bfd6cc64ba1b30cbf7f35db24a22de"),
    //         owner: provider.sender().address!,
    //         priceRate: toNano(0.1),
    //         slippage: toNano(0.02), // default slippage is 2%
    //         toJettonMinter: null,
    //         forwardTonAmount: GAS_CREATE_ORDER_JETTON,
    //         providerFee: provider.sender().address!,
    //         feeNum: 1, // uint14
    //         feeDenom: 1000, // uint14
    //         matcherFeeNum: 1, // uint14
    //         matcherFeeDenom: 1000, // uint14
    //         createdAt: Math.round(Number(new Date().getTime() / 1000)),
    //     }
    // )


    // const jettonWalletBUILD = provider.open(JettonWallet.createFromAddress(Address.parse("EQASOdIumhULjDuW74Q_7yFD6pWa5hAbSawQ1c1wV6l9Pwj9")));
    // await jettonWalletBUILD.sendCreateOrder(
    //     provider.sender(),
    //     toNano(0.15 + 0.01 + 0.04 + 0.006884 + 0.003078),
    //     {
    //         jettonAmount: toNano(0.05),
    //         vault: Address.parse("EQD45c5VAClGgnUJAiGzGcgnC6MpJ73wynLkUykgtp2QouJ6"),
    //         owner: provider.sender().address!,
    //         priceRate: toNano(10),
    //         slippage: toNano(0.02), // default slippage is 2%
    //         toJettonMinter: Address.parse("EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT"),
    //         forwardTonAmount: toNano(0.01 + 0.04 + 0.006884 + 0.003078),
    //         providerFee: provider.sender().address!,
    //         feeNum: 1, // uint14
    //         feeDenom: 1000, // uint14
    //         matcherFeeNum: 1, // uint14
    //         matcherFeeDenom: 1000, // uint14
    //     }
    // )


    // const jettonWalletNOT = provider.open(JettonWallet.createFromAddress(Address.parse("EQAA6dgNLns8qD9nwG6L1cz7YdZjxXhG_khoY3L0K65P4NQz")));
    // await jettonWalletNOT.sendCreateOrder(
    //     provider.sender(),
    //     toNano(0.15 + 0.01 + 0.04 + 0.006884 + 0.003078),
    //     {
    //         jettonAmount: toNano(0.5),
    //         vault: Address.parse("EQA8yOYAcTFc_PlaZqgVl8T0E3_493hzSgD2GXgQEj4bS_In"),
    //         owner: provider.sender().address!,
    //         priceRate: toNano(0.1),
    //         slippage: toNano(0.02), // default slippage is 2%
    //         toJettonMinter: Address.parse("EQBYnUrIlwBrWqp_rl-VxeSBvTR2VmTfC4ManQ657n_BUILD"),
    //         forwardTonAmount: toNano(0.01 + 0.04 + 0.006884 + 0.003078),
    //         providerFee: provider.sender().address!,
    //         feeNum: 1, // uint14
    //         feeDenom: 1000, // uint14
    //         matcherFeeNum: 1, // uint14
    //         matcherFeeDenom: 1000, // uint14
    //     }
    // )

    

    // FOR TON
    const vaultTo = provider.open(Vault.createFromAddress(Address.parse("0:f4010d8778a854e38e6f67c6a173a850c231b82a5d02df28ffe64039a3906b23")));
    await vaultTo.sendCreateOrder(provider.sender(), toNano(0.02) + GAS_CREATE_ORDER_TON, {
        amount: toNano(0.02),
        priceRate: toNano(10),
        slippage: toNano(0.02), // default slippage is 2%
        toJettonMinter: Address.parse("0:2f956143c461769579baef2e32cc2d7bc18283f40d20bb03e432cd603ac33ffc"),
        providerFee: provider.sender().address!,
        feeNum: 1, // uint14
        feeDenom: 1000, // uint14
        matcherFeeNum: 1, // uint14
        matcherFeeDenom: 1000, // uint14
        createdAt: Math.round(Number(new Date().getTime() / 1000)),
    })
}
