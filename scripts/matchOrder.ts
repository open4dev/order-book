import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { Order } from '../wrappers/Order';
import { GAS_ORDER_FULL_MATCH, GAS_EXCESS } from '../tests/Helper';

/**
 * Example script to match two orders
 * 
 * Replace addresses with your actual order addresses
 */
export async function run(provider: NetworkProvider) {
    // Replace with your actual order address (the order that will initiate the match)
    // const ORDER_ADDRESS = Address.parse("YOUR_ORDER_ADDRESS_HERE");
    // 
    // // Replace with the address of the vault for the other order
    // const ANOTHER_VAULT_ADDRESS = Address.parse("YOUR_ANOTHER_VAULT_ADDRESS_HERE");
    // 
    // // Replace with the address of the owner of the other order
    // const ANOTHER_ORDER_OWNER_ADDRESS = Address.parse("YOUR_ANOTHER_ORDER_OWNER_ADDRESS_HERE");
    // 
    // // Replace with the creation timestamp of the other order (Unix timestamp in seconds)
    // // You can get this from the order's getData() method
    // const ANOTHER_ORDER_CREATED_AT = 0; // Replace with actual timestamp
    // 
    // // Amount to match (in nano units)
    // const MATCH_AMOUNT = toNano("0.025"); // Example: 0.025 TON or jettons
    // 
    // const order = provider.open(Order.createFromAddress(ORDER_ADDRESS));

    // Uncomment to execute:
    // await order.sendMatchOrder(
    //     provider.sender(),
    //     GAS_ORDER_FULL_MATCH + GAS_EXCESS, // Gas for matching + excess(optional)
    //     {
    //         anotherVault: ANOTHER_VAULT_ADDRESS,
    //         anotherOrderOwner: ANOTHER_ORDER_OWNER_ADDRESS,
    //         createdAt: ANOTHER_ORDER_CREATED_AT, // Unix timestamp in seconds
    //         amount: MATCH_AMOUNT,
    //     }
    // );
}
