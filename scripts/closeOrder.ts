import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { Order } from '../wrappers/Order';
import { GAS_ORDER_CLOSE_ORDER, GAS_EXCESS } from '../tests/Helper';

/**
 * Example script to close an order
 * 
 * Replace ORDER_ADDRESS with your actual order address
 */
export async function run(provider: NetworkProvider) {
    // Replace with your actual order address
    // const ORDER_ADDRESS = Address.parse("YOUR_ORDER_ADDRESS_HERE");
    // 
    // const order = provider.open(Order.createFromAddress(ORDER_ADDRESS));
    
    // Close the order - excess gas will be returned
    // Uncomment to execute:
    // await order.sendCloseOrder(
    //     provider.sender(),
    //     GAS_ORDER_CLOSE_ORDER + GAS_EXCESS
    // );
}
