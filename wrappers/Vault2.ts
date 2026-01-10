import { Address, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import {
    VaultConfig,
    CreateOrderParams,
    vaultConfigToCell,
    buildTonTransferBody,
    buildInitVaultBody,
} from './common';

// Re-export types for backwards compatibility
export { VaultConfig, CodesInfo, JettonInfo } from './common';

export class Vault2 implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Vault2(address);
    }

    static createFromConfig(config: VaultConfig, code: Cell, workchain = 0) {
        const data = vaultConfigToCell(config);
        const init = { code, data };
        return new Vault2(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: buildInitVaultBody(),
        });
    }

    async sendCreateOrder(provider: ContractProvider, via: Sender, value: bigint, params: CreateOrderParams) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: buildTonTransferBody(params),
        });
    }

    async sendInitVault(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: buildInitVaultBody(),
        });
    }

    async getData(provider: ContractProvider) {
        const { stack } = await provider.get('getData', []);
        return {
            jettonMaster: stack.readCellOpt(),
            randomHash_hex: stack.readBigNumber().toString(16),
            vaultFactory: stack.readAddress(),
            amount: stack.readBigNumber(),
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
