import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type VaultFactoryConfig = {};

export function vaultFactoryConfigToCell(config: VaultFactoryConfig): Cell {
    return beginCell().endCell();
}

export class VaultFactory implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new VaultFactory(address);
    }

    static createFromConfig(config: VaultFactoryConfig, code: Cell, workchain = 0) {
        const data = vaultFactoryConfigToCell(config);
        const init = { code, data };
        return new VaultFactory(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
