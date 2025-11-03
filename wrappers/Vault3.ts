import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type Vault3Config = {};

export function vault3ConfigToCell(config: Vault3Config): Cell {
    return beginCell().endCell();
}

export class Vault3 implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Vault3(address);
    }

    static createFromConfig(config: Vault3Config, code: Cell, workchain = 0) {
        const data = vault3ConfigToCell(config);
        const init = { code, data };
        return new Vault3(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
