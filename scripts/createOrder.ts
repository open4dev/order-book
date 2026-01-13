import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { JettonWallet } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';
import { VaultTon } from '../wrappers/VaultTon';
import { GAS_CREATE_ORDER_JETTON, GAS_CREATE_ORDER_TON, GAS_EXCESS } from '../tests/Helper';

export async function run(provider: NetworkProvider) {
    // ============================================
    // EXAMPLE 1: Create Order from Jetton Wallet
    // ============================================
    // Uncomment and replace these addresses with your actual addresses:
    // const JETTON_WALLET_ADDRESS = Address.parse("YOUR_JETTON_WALLET_ADDRESS_HERE");
    // const VAULT_ADDRESS = Address.parse("YOUR_VAULT_ADDRESS_HERE");
    // const TO_JETTON_MINTER_ADDRESS = Address.parse("YOUR_TO_JETTON_MINTER_ADDRESS_HERE"); // or null for TON
    // 
    // // Example values - adjust as needed:
    // const JETTON_AMOUNT = toNano("1"); // Amount of jettons to sell
    // const PRICE_RATE = toNano("2"); // Price rate (e.g., 2 means 1 jetton = 2 TON)
    // const SLIPPAGE = toNano("0.02"); // 2% slippage tolerance
    // const PROVIDER_FEE_NUM = 5; // Provider fee numerator (e.g., 5 = 0.5%)
    // const PROVIDER_FEE_DENOM = 1000; // Provider fee denominator
    // const MATCHER_FEE_NUM = 1; // Matcher fee numerator (e.g., 1 = 0.1%)
    // const MATCHER_FEE_DENOM = 1000; // Matcher fee denominator
    // 
    // const jettonWallet = provider.open(JettonWallet.createFromAddress(JETTON_WALLET_ADDRESS));
    // 
    // await jettonWallet.sendCreateOrder(
    //     provider.sender(),
    //     toNano("0.15") + GAS_CREATE_ORDER_JETTON + GAS_EXCESS, // Extra 0.15 TON for jetton transfer + gas + excess
    //     {
    //         jettonAmount: JETTON_AMOUNT,
    //         vault: VAULT_ADDRESS,
    //         owner: provider.sender().address!,
    //         priceRate: PRICE_RATE,
    //         slippage: SLIPPAGE,
    //         toJettonMinter: TO_JETTON_MINTER_ADDRESS, // null for TON
    //         forwardTonAmount: GAS_CREATE_ORDER_JETTON, // Gas for order creation
    //         providerFee: provider.sender().address!,
    //         feeNum: PROVIDER_FEE_NUM,
    //         feeDenom: PROVIDER_FEE_DENOM,
    //         matcherFeeNum: MATCHER_FEE_NUM,
    //         matcherFeeDenom: MATCHER_FEE_DENOM,
    //         createdAt: Math.round(Number(new Date().getTime() / 1000)),
    //     }
    // );

    // ============================================
    // EXAMPLE 2: Create Order from TON Vault
    // ============================================
    // Uncomment and replace this address with your actual TON vault address:
    // const VAULT_TON_ADDRESS = Address.parse("YOUR_VAULT_TON_ADDRESS_HERE");
    // const TO_JETTON_MINTER_ADDRESS = Address.parse("YOUR_TO_JETTON_MINTER_ADDRESS_HERE");
    // 
    // // Example values - adjust as needed:
    // const TON_AMOUNT = toNano("1"); // Amount of TON to sell
    // const PRICE_RATE = toNano("10"); // Price rate (e.g., 10 means 1 TON = 10 jettons)
    // const SLIPPAGE = toNano("0.02"); // 2% slippage tolerance
    // const PROVIDER_FEE_NUM = 1;
    // const PROVIDER_FEE_DENOM = 1000;
    // const MATCHER_FEE_NUM = 1;
    // const MATCHER_FEE_DENOM = 1000;
    // 
    // const vaultTon = provider.open(VaultTon.createFromAddress(VAULT_TON_ADDRESS));
    // 
    // await vaultTon.sendCreateOrder(
    //     provider.sender(),
    //     TON_AMOUNT + GAS_CREATE_ORDER_TON + GAS_EXCESS, // TON amount + gas + excess
    //     {
    //         amount: TON_AMOUNT,
    //         priceRate: PRICE_RATE,
    //         slippage: SLIPPAGE,
    //         toJettonMinter: TO_JETTON_MINTER_ADDRESS,
    //         providerFee: provider.sender().address!,
    //         feeNum: PROVIDER_FEE_NUM,
    //         feeDenom: PROVIDER_FEE_DENOM,
    //         matcherFeeNum: MATCHER_FEE_NUM,
    //         matcherFeeDenom: MATCHER_FEE_DENOM,
    //         createdAt: Math.round(Number(new Date().getTime() / 1000)),
    //     }
    // );
}
