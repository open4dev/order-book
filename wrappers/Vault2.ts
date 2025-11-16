import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type Vault2Config = {};

export function vault2ConfigToCell(config: Vault2Config): Cell {
    return beginCell().endCell();
}

export class Vault2 implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Vault2(address);
    }

    static createFromConfig(config: Vault2Config, code: Cell, workchain = 0) {
        const data = vault2ConfigToCell(config);
        const init = { code, data };
        return new Vault2(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
