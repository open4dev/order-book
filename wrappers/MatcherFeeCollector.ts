import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type MatcherFeeCollectorConfig = {};

export function matcherFeeCollectorConfigToCell(config: MatcherFeeCollectorConfig): Cell {
    return beginCell().endCell();
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
}
