import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { JettonWallet } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';
import { Gas, DefaultFees, getDefaultSlippage, calculateCreateOrderGas } from './config';

export async function run(provider: NetworkProvider) {
    const senderAddress = provider.sender().address!;

    // ==================== JETTON ORDER ====================
    // Uncomment and configure to create order from jetton wallet

    // const jettonWallet = provider.open(
    //     JettonWallet.createFromAddress(Address.parse("YOUR_JETTON_WALLET_ADDRESS"))
    // );
    // await jettonWallet.sendCreateOrder(provider.sender(), Gas.CREATE_ORDER_JETTON, {
    //     jettonAmount: toNano(1),
    //     vault: Address.parse("YOUR_VAULT_ADDRESS"),
    //     owner: senderAddress,
    //     priceRate: toNano(2),
    //     slippage: getDefaultSlippage(),
    //     toJettonMinter: Address.parse("TARGET_JETTON_MINTER"),
    //     forwardTonAmount: Gas.FORWARD_TON_AMOUNT,
    //     providerFee: senderAddress,
    //     ...DefaultFees,
    // });

    // ==================== TON ORDER ====================
    // Uncomment and configure to create order from TON vault

    // const vault = provider.open(
    //     Vault.createFromAddress(Address.parse("YOUR_TON_VAULT_ADDRESS"))
    // );
    // const amount = toNano(1);
    // await vault.sendCreateOrder(provider.sender(), calculateCreateOrderGas(amount), {
    //     amount,
    //     priceRate: toNano(2),
    //     slippage: getDefaultSlippage(),
    //     toJettonMinter: Address.parse("TARGET_JETTON_MINTER"),
    //     providerFee: senderAddress,
    //     ...DefaultFees,
    // });
}
