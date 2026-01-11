import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';


// struct JettonInfo {
//     jettonMinter: address
// }

// struct CodesInfo {
//     jettonWalletCode: cell?
//     orderCode: cell
//     feeCollectorCode: cell
// }

// struct Storage {
//     vault_factory: address
//     codesInfo: Cell<CodesInfo>
//     fromJetton: Cell<JettonInfo>?
//     randomHash: uint256
//     amount: uint128
// }
export type CodesInfo = {
    jettonWalletCode: Cell;
    orderCode: Cell;
    feeCollectorCode: Cell;
}

export type JettonInfo = {
    jettonMinter: Address;
}

export type VaultConfig = {
    vaultFactory: Address;
    codesInfo: CodesInfo;
    fromJetton: JettonInfo;
    randomHash: bigint;
    amount: bigint;
};

export function vaultConfigToCell(config: VaultConfig): Cell {
    return beginCell()
        .storeAddress(config.vaultFactory)
        .storeRef(
            beginCell()
                .storeMaybeRef(config.codesInfo.jettonWalletCode)
                .storeRef(config.codesInfo.orderCode)
                .storeRef(config.codesInfo.feeCollectorCode)
            .endCell()
            )
        .storeMaybeRef(beginCell().storeAddress(config.fromJetton.jettonMinter).endCell())
        .storeUint(config.randomHash, 256)
        .storeCoins(config.amount)
        .endCell();
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
        const comissionInfo = beginCell().store
        
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0x2717c4a2, 32)

            .endCell(),
        });
    }

    async sendCreateOrder(provider: ContractProvider, via: Sender, value: bigint, params: {
        amount: bigint,
        priceRate: bigint,
        slippage: bigint, // uint30
        toJettonMinter: Address,
        providerFee: Address,
        feeNum: number, // uint14
        feeDenom: number, // uint14
        matcherFeeNum: number, // uint14
        matcherFeeDenom: number, // uint14
        createdAt: number,
    }) {
        // struct ( 0xcbcd047e ) TonTransfer {
        //     amount: coins,
        //     toJetton: Cell<ToJettonInfo>
        //     slippage: uint30
        // }
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0xcbcd047e, 32)
            .storeCoins(params.amount)
            .storeRef(
                beginCell()
                    .storeAddress(params.toJettonMinter)
                .endCell()
            )
            .storeCoins(params.priceRate)
            .storeUint(params.slippage, 30)
            .storeRef(
                beginCell()
                    .storeAddress(params.providerFee)
                    .storeUint(params.feeNum, 14)
                    .storeUint(params.feeDenom, 14)
                    .storeUint(params.matcherFeeNum, 14)
                    .storeUint(params.matcherFeeDenom, 14)
                .endCell()
            )
            .storeUint(params.createdAt, 32)
            .endCell(),
        });
    }

    async sendInitVault(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
            .storeUint(0x2717c4a2, 32)
            .endCell(),
        });
    }

    // Only for testing
    async sendVaultJettonTransfer(provider: ContractProvider, via: Sender, value: bigint, params: {
        feeInfo: {
            provider: Address,
            feeNum: number,
            feeDenom: number,
            matcherFeeNum: number,
            matcherFeeDenom: number,
        },
        orderOwner: Address,
        matcher: Address,
        anotherOwnerOrder: Address,
        toJettonMinter: Address | null,
        amountTransfer: bigint,
        createdAtOrder: number,
    }) {

        
        // struct ( 0x12966c79 ) VaultJettonTransfer {
        //     addresses: Cell<VaultJettonTransferAddresses>
        //     toJetton: Cell<ToJettonInfo>?
        //     amountTransfer: coins
        //     createdAtOrder: uint32
        //     feeInfo: Cell<FeeInfo>
        // }
        // struct FeeInfo {
        //     provider: address
        //     feeNum: uint14
        //     feeDenom: uint14
        //     matcherFeeNum: uint14
        //     matcherFeeDenom: uint14
        // }
        // struct ToJettonInfo {
        //     jettonMinter: address
        // }
        // struct VaultJettonTransferAddresses {
        //     orderOwner: address
        //     matcher: address
        //     anotherOwnerOrder: address
        // }

        const feeInfoCell = beginCell()
            .storeAddress(params.feeInfo.provider)
            .storeUint(params.feeInfo.feeNum, 14)
            .storeUint(params.feeInfo.feeDenom, 14)
            .storeUint(params.feeInfo.matcherFeeNum, 14)
            .storeUint(params.feeInfo.matcherFeeDenom, 14)
        .endCell();
        const addressesCell = beginCell()
            .storeAddress(params.orderOwner)
            .storeAddress(params.matcher)
            .storeAddress(params.anotherOwnerOrder)
        .endCell();
        let toJettonCell: Cell | null = null;
        if (params.toJettonMinter) {
            toJettonCell = beginCell()
                .storeAddress(params.toJettonMinter)
            .endCell();
        }

        const bodyVaultJettonTransfer = beginCell()
            .storeUint(0x12966c79, 32)
            .storeRef(addressesCell)
            .storeMaybeRef(toJettonCell)
            .storeCoins(params.amountTransfer)
            .storeUint(params.createdAtOrder, 32)
            .storeRef(feeInfoCell)
        .endCell();
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: bodyVaultJettonTransfer,
        }); 
    }

    // Only for testing
    async sendCloseOrder(provider: ContractProvider, via: Sender, value: bigint, params: {
        orderOwner: Address,
        toJetton: {
            jettonMinter: Address | null,
        },
        amountTransfer: bigint,
        createdAtOrder: number,
    }) {
        
        // struct ( 0xa597947e ) CloseOrder {
        //     orderOwner: address
        //     toJetton: Cell<ToJettonInfo>?
        //     amountTransfer: coins
        //     createdAtOrder: uint32
        // }

        // struct ToJettonInfo {
        //     jettonMinter: address
        // }

        let toJettonCell: Cell | null = null;
        if (params.toJetton.jettonMinter) {
            toJettonCell = beginCell()
                .storeAddress(params.toJetton.jettonMinter)
            .endCell();
        }

        const bodyCloseOrder = beginCell()
            .storeUint(0xa597947e, 32)
            .storeAddress(params.orderOwner)
            .storeMaybeRef(toJettonCell)
            .storeCoins(params.amountTransfer)
            .storeUint(params.createdAtOrder, 32)
        .endCell();
        
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: bodyCloseOrder,
        });
    }

    // Only for testing
    async sendWithDraw(provider: ContractProvider, via: Sender, value: bigint, params: {
        feeAddress: Address,
        amount: bigint,
    }) {
        
        // struct (0xee83652a) WithDraw {
        //     feeAddress: address
        //     amount: coins
        // }

        const bodyWithDraw = beginCell()
            .storeUint(0xee83652a, 32)
            .storeAddress(params.feeAddress)
            .storeCoins(params.amount)
        .endCell();

        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: bodyWithDraw,
        });
    }

    async getData(provider: ContractProvider) {
        const { stack } = await provider.get('getData', []);
        return {
            jettonMaster: stack.readCell(),
            randomHash_hex: stack.readBigNumber().toString(16),
            vaultFactory: stack.readAddress(),
            amount: stack.readBigNumber(),
        };
    }

    async getCodes(provider: ContractProvider) {
        const { stack } = await provider.get('getCodes', []);
        return {
            jettonWalletCode: stack.readCell(),
            orderCode: stack.readCell(),
            feeCollectorCode: stack.readCell(),
        };
    }
}
