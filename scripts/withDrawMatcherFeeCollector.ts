import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { FeeCollector } from '../wrappers/MatcherFeeCollector';
import { GAS_FEE_COLLECTOR_WITHDRAW, GAS_JETTON_WALLET_TRANSFER, GAS_EXCESS } from '../tests/Helper';

/**
 * Example script to withdraw fees from FeeCollector
 * 
 * Replace FEE_COLLECTOR_ADDRESS with your actual FeeCollector address
 * Note: Only the owner can withdraw fees
 */
export async function run(provider: NetworkProvider) {
    // Replace with your actual FeeCollector address
    // const FEE_COLLECTOR_ADDRESS = Address.parse("YOUR_FEE_COLLECTOR_ADDRESS_HERE");
    // 
    // const feeCollector = provider.open(FeeCollector.createFromAddress(FEE_COLLECTOR_ADDRESS));

    // Withdraw fees - excess gas will be returned
    // For jetton fees, add GAS_JETTON_WALLET_TRANSFER for the jetton transfer
    // Uncomment to execute:
    // await feeCollector.sendWithDraw(
    //     provider.sender(),
    //     GAS_FEE_COLLECTOR_WITHDRAW + GAS_JETTON_WALLET_TRANSFER + GAS_EXCESS // Add GAS_JETTON_WALLET_TRANSFER if withdrawing jetton fees
    // );
}
