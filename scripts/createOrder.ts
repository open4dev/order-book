import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';

export async function run(provider: NetworkProvider) {
    // FOR JETTONS
    const jettonWalletFrom = provider.open(JettonWallet.createFromAddress(Address.parse("UQAA6dgNLns8qD9nwG6L1cz7YdZjxXhG_khoY3L0K65P4In2")));
    // const jettonWalletTo = provider.open(JettonWallet.createFromAddress(Address.parse("EQASOdIumhULjDuW74Q_7yFD6pWa5hAbSawQ1c1wV6l9Pwj9")));

    // FOR TON
    // const vaultTo = provider.open(Vault.createFromAddress(Address.parse("kQDh1QL2kQ5UEHhgOeOuEvwGC8_GaxpRFsI2f0dGWsLUQSO8")));

    await jettonWalletFrom.sendCreateOrder(
        provider.sender(),
        toNano(0.15 + 0.01 + 0.00206 + 0.007084 + 0.003278),
        {
            jettonAmount: toNano(2),
            vault: Address.parse("EQBFOVZf2xDm9B-8TSjIjaCZWXFmyzP7UkNq9GaoRS_FARpA"),
            owner: provider.sender().address!,
            priceRate: toNano(0.1),
            slippage: toNano(0.02),
            toJettonMinter: Address.parse("EQBYnUrIlwBrWqp_rl-VxeSBvTR2VmTfC4ManQ657n_BUILD"),
            forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
            providerFee: provider.sender().address!,
            feeNum: 1,
            feeDenom: 1000,
            matcherFeeNum: 1,
            matcherFeeDenom: 1000,
        }
    )

    // await jettonWalletTo.sendCreateOrder(
    //     provider.sender(),
    //     toNano(0.15 + 0.01 + 0.00206 + 0.007084 + 0.003278),
    //     {
    //         jettonAmount: toNano(0.2),
    //         vault: Address.parse("EQBikBaA97NugW6Cnmxnkl3cIKMAo2cHmkm1e5-3t5XtKb6Z"),
    //         owner: provider.sender().address!,
    //         priceRate: toNano(10),
    //         slippage: toNano(0.02),
    //         toJettonMinter: Address.parse("EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT"),
    //         forwardTonAmount: toNano(0.01 + 0.00206 + 0.007084 + 0.003278),
    //         providerFee: provider.sender().address!,
    //         feeNum: 1,
    //         feeDenom: 1000,
    //         matcherFeeNum: 1,
    //         matcherFeeDenom: 1000,
    //     }
    // )

    // await vaultTo.sendCreateOrder(provider.sender(), toNano(1.1), {
    //     amount: toNano(1),
    //     priceRate: toNano(30),
    //     slippage: toNano(0.02),
    //     toJettonMinter: Address.parse("kQBz3lxXqAPk3kTkQGvK8LF3EJ9-cBlbZcbffdYBrECuJYxJ"),
    // })
}
