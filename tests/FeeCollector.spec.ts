import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { FeeCollector } from '../wrappers/MatcherFeeCollector';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('FeeCollector', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('FeeCollector');
    });

    let blockchain: Blockchain;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let deployer: SandboxContract<TreasuryContract>;
    let feeCollector: SandboxContract<FeeCollector>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');

        feeCollector = blockchain.openContract(FeeCollector.createFromConfig({
            vault: deployer.address,
            owner: user1.address,
            amount: toNano(0),
        }, code));


        const deployResult = await feeCollector.sendAddFee(deployer.getSender(), toNano('0.05'), toNano(0));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: feeCollector.address,
            deploy: true,
            success: true,
        });
    });

    it('Success AddFee', async () => {
        const dataBefore = await feeCollector.getData();
        expect(dataBefore.amount).toEqual(toNano(0));
        const resAddFee = await feeCollector.sendAddFee(deployer.getSender(), toNano(0.1), toNano(100));
        expect(resAddFee.transactions).toHaveTransaction({
            from: deployer.address,
            to: feeCollector.address,
            success: true,
        });
        const dataAfter = await feeCollector.getData();
        expect(dataAfter.amount).toEqual(toNano(100));
    });

    it("Error AddFee not from vault", async () => {
        const resAddFee = await feeCollector.sendAddFee(user1.getSender(), toNano(0.1), toNano(100));
        expect(resAddFee.transactions).toHaveTransaction({
            from: user1.address,
            to: feeCollector.address,
            success: false,
            exitCode: 403,
        });
    });

    it('Success multiple AddFee', async () => {
        const dataBefore = await feeCollector.getData();
        expect(dataBefore.amount).toEqual(toNano(0));
        const resAddFee = await feeCollector.sendAddFee(deployer.getSender(), toNano(0.1), toNano(100));
        expect(resAddFee.transactions).toHaveTransaction({
            from: deployer.address,
            to: feeCollector.address,
            success: true,
        });
        const dataAfter = await feeCollector.getData();
        expect(dataAfter.amount).toEqual(toNano(100));
        const resAddFee2 = await feeCollector.sendAddFee(deployer.getSender(), toNano(0.1), toNano(200));
        printTransactionFees(resAddFee2.transactions)
        expect(resAddFee2.transactions).toHaveTransaction({
            from: deployer.address,
            to: feeCollector.address,
            success: true,
        });
        const dataAfter2 = await feeCollector.getData();
        expect(dataAfter2.amount).toEqual(toNano(300));
    });

    it("Error AddFee not enough gas", async () => {
        const resAddFee = await feeCollector.sendAddFee(deployer.getSender(), toNano(0.0009), toNano(100));
        expect(resAddFee.transactions).toHaveTransaction({
            from: deployer.address,
            to: feeCollector.address,
            success: false,
            exitCode: 422,
        });
        const dataAfter = await feeCollector.getData();
        expect(dataAfter.amount).toEqual(toNano(0));
    });

    it("Success WithDraw", async () => {
        const dataBefore = await feeCollector.getData();
        expect(dataBefore.amount).toEqual(toNano(0));
        const resAddFee = await feeCollector.sendAddFee(deployer.getSender(), toNano(0.1), toNano(100));
        expect(resAddFee.transactions).toHaveTransaction({
            from: deployer.address,
            to: feeCollector.address,
            success: true,
        });
        const resWithDraw = await feeCollector.sendWithDraw(user1.getSender(), toNano(0.1));
        expect(resWithDraw.transactions).toHaveTransaction({
            from: user1.address,
            to: feeCollector.address,
            success: true,
        });
        const dataAfter = await feeCollector.getData();
        expect(dataAfter.amount).toEqual(toNano(0));
    });

    it("Error WithDraw not from owner", async () => {
        const resWithDraw = await feeCollector.sendWithDraw(user2.getSender(), toNano(0.1));
        expect(resWithDraw.transactions).toHaveTransaction({
            from: user2.address,
            to: feeCollector.address,
            success: false,
            exitCode: 403,
        });
    });

    it("Error WithDraw not enough gas", async () => {
        const resWithDraw = await feeCollector.sendWithDraw(user1.getSender(), toNano(0.0009));
        expect(resWithDraw.transactions).toHaveTransaction({
            from: user1.address,
            to: feeCollector.address,
            success: false,
            exitCode: 422,
        });
    });

    it("Success WithDraw partial amount", async () => {
        const dataBefore = await feeCollector.getData();
        expect(dataBefore.amount).toEqual(toNano(0));
        const resAddFee = await feeCollector.sendAddFee(deployer.getSender(), toNano(0.1), toNano(100));
        expect(resAddFee.transactions).toHaveTransaction({
            from: deployer.address,
            to: feeCollector.address,
            success: true,
        });
        const resAddFee2 = await feeCollector.sendAddFee(deployer.getSender(), toNano(0.1), toNano(200));
        expect(resAddFee2.transactions).toHaveTransaction({
            from: deployer.address,
            to: feeCollector.address,
            success: true,
        });
        const dataAfter = await feeCollector.getData();
        expect(dataAfter.amount).toEqual(toNano(300));
        const resWithDraw = await feeCollector.sendWithDraw(user1.getSender(), toNano(0.1));
        expect(resWithDraw.transactions).toHaveTransaction({
            from: user1.address,
            to: feeCollector.address,
            success: true,   
        });
        const dataAfter2 = await feeCollector.getData();
        expect(dataAfter2.amount).toEqual(toNano(0));
    });
});
