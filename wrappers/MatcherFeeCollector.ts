import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type MatcherFeeCollectorConfig = {
    vault: Address;
    owner: Address;
    amount: bigint;
};

export function matcherFeeCollectorConfigToCell(config: MatcherFeeCollectorConfig): Cell {
    return beginCell()
    .storeAddress(config.vault)
    .storeAddress(config.owner)
    .storeCoins(config.amount)
    .endCell();
}

export class MatcherFeeCollector implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new MatcherFeeCollector(address);
    }

    static createFromConfig(config: MatcherFeeCollectorConfig, code: Cell, workchain = 0) {
        const data = matcherFeeCollectorConfigToCell(config);
        const init = { code, data };
        return new MatcherFeeCollector(contractAddress(workchain, init), init);
    }

    async sendWithDraw(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0xec9a92f6, 32).endCell(),
        });
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendAddFee(provider: ContractProvider, via: Sender, value: bigint, feeAmount: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0xfc7532f4, 32).storeCoins(feeAmount).endCell(),
        });
    }

    async getData(provider: ContractProvider) {
        const { stack } = await provider.get('getData', []);
        return {
            vault: stack.readAddress(),
            owner: stack.readAddress(),
            amount: stack.readBigNumber(),
        };
    }
}
