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
    const ORDER_ADDRESS = Address.parse("0:5a605f9272ea76369bdf98c767302236c5e5a7d233fdbcb470e10cfd1c263a18");
    
    const order = provider.open(Order.createFromAddress(ORDER_ADDRESS));
    
    // Close the order - excess gas will be returned
    // Uncomment to execute:
    await order.sendCloseOrder(
        provider.sender(),
        GAS_ORDER_CLOSE_ORDER
    );
}
