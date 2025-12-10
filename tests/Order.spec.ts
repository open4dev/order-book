import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Order } from '../wrappers/Order';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Order', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Order');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let fakeVault: SandboxContract<TreasuryContract>;
    let order: SandboxContract<Order>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        fakeVault = await blockchain.treasury('fakeVault');

        order = blockchain.openContract(Order.createFromConfig({
            owner: deployer.address,
            vault: fakeVault.address,
            feeInfo: null,
            exchangeInfo: {
                from: null,
                to: null,
                amount: toNano(0),
                priceRate: toNano(0),
                slippage: toNano(0),
            },
            createdAt: BigInt(0),
        }, code));


        const deployResult = await order.sendInit(fakeVault.getSender(), toNano('0.05'), {
            amount: toNano(0),
            priceRate: toNano(0),
            slippage: toNano(0),
            feeInfo: {
                provider: deployer.address,
                feeNum: BigInt(0),
                feeDenom: BigInt(0),
                matcherFeeNum: BigInt(0),
                matcherFeeDenom: BigInt(0),
            },
        });

        expect(deployResult.transactions).toHaveTransaction({
            from: fakeVault.address,
            to: order.address,
            deploy: true,
            success: true,
        });
    });

    it('Init Order -> Failed from not vault', async () => {
        // the check is done inside beforeEach
        // blockchain and order are ready to use
        const initResult = await order.sendInit(deployer.getSender(), toNano('0.05'), {
            amount: toNano(0),
            priceRate: toNano(0),
            slippage: toNano(0),
            feeInfo: {
                provider: deployer.address,
                feeNum: BigInt(0),
                feeDenom: BigInt(0),
                matcherFeeNum: BigInt(0),
                matcherFeeDenom: BigInt(0),
            },
        });

        expect(initResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: order.address,
            success: false,
            exitCode: 403,
        });
    });

    it('Init Order -> Failed with not enough value', async () => {
        const initResult = await order.sendInit(fakeVault.getSender(), toNano('0.005'), {
            amount: toNano(0),
            priceRate: toNano(0),
            slippage: toNano(0),
            feeInfo: {
                provider: deployer.address,
                feeNum: BigInt(0),
                feeDenom: BigInt(0),
                matcherFeeNum: BigInt(0),
                matcherFeeDenom: BigInt(0),
            },
        });

        expect(initResult.transactions).toHaveTransaction({
            from: fakeVault.address,
            to: order.address,
            success: false,
            exitCode: 422,
        });
    });

    it('Init Order -> Failed with already initialized', async () => {
        const initResult = await order.sendInit(fakeVault.getSender(), toNano('0.05'), {
            amount: toNano(1),
            priceRate: toNano(0),
            slippage: toNano(0),
            feeInfo: {
                provider: deployer.address,
                feeNum: BigInt(0),
                feeDenom: BigInt(0),
                matcherFeeNum: BigInt(0),
                matcherFeeDenom: BigInt(0),
            },
        });

        const failedInitResult = await order.sendInit(fakeVault.getSender(), toNano('0.05'), {
            amount: toNano(1),
            priceRate: toNano(0),
            slippage: toNano(0),
            feeInfo: {
                provider: deployer.address,
                feeNum: BigInt(0),
                feeDenom: BigInt(0),
                matcherFeeNum: BigInt(0),
                matcherFeeDenom: BigInt(0),
            },
        });

        expect(failedInitResult.transactions).toHaveTransaction({
            from: fakeVault.address,
            to: order.address,
            success: false,
            exitCode: 403,
        });
    });
});
