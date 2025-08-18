import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type VaultConfig = {};

export function vaultConfigToCell(config: VaultConfig): Cell {
    return beginCell().endCell();
}

export class Vault implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Vault(address);
    }

    static createFromConfig(config: VaultConfig, code: Cell, workchain = 0) {
        const data = vaultConfigToCell(config);
        const init = { code, data };
        return new Vault(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getData(provider: ContractProvider) {
        const { stack } = await provider.get('getData', []);
        return {
            amount: stack.readBigNumber(),
            jettonMaster: stack.readAddress(),
            randomHash_hex: stack.readBigNumber().toString(16),
            vaultFactory: stack.readAddress(),
            version: stack.readNumber()
        };
    }

    async getCodes(provider: ContractProvider) {
        const { stack } = await provider.get('getCodes', []);
        return {
            jettonWalletCode: stack.readCell(),
            orderCode: stack.readCell()
        };
    }
}
