import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type VaultFactoryConfig = {
    owner: Address;
    vaultCode: Cell;
    orderCode: Cell;
    commission: number;
};

export function vaultFactoryConfigToCell(config: VaultFactoryConfig): Cell {
    return beginCell()
    .storeAddress(config.owner)
    .storeRef(config.vaultCode)
    .storeRef(config.orderCode)
    .storeUint(config.commission, 14)
    .endCell();
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
            body: beginCell()
            .storeUint(0x81e36595, 32)
            .endCell(),
        });
    }

    async sendCreateVault(provider: ContractProvider, via: Sender, value: bigint, jettonWalletCode: Cell, jettonMaster: Address, version: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0x64e90480, 32)
            .storeRef(jettonWalletCode)
            .storeAddress(jettonMaster)
            .storeUint(version, 2)
            .endCell(),
        });
    }

    async sendChangeOwner(provider: ContractProvider, via: Sender, value: bigint, newOwner: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0xb6cf7f0f, 32)
            .storeAddress(newOwner)
            .endCell(),
        });
    }

    async sendChangeCommission(provider: ContractProvider, via: Sender, value: bigint, newCommission: number) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0x4e86ed8b, 32)
            .storeUint(newCommission, 14)
            .endCell(),
        });
    }

    async getOwner(provider: ContractProvider) {
        const { stack } = await provider.get('getOwner', []);
        return stack.readAddress();
    }

    async getCommission(provider: ContractProvider) {
        const { stack } = await provider.get('getCommission', []);
        return stack.readNumber();
    }
}
