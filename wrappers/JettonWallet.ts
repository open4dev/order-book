import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, Slice, toNano } from '@ton/core';
import { Op } from './JettonConstants';
import {endParse} from "./JettonMinter";

export type JettonWalletConfig = {
    ownerAddress: Address,
    jettonMasterAddress: Address
};

export const jettonWalletCodeCell = Cell.fromHex("b5ee9c7241020f01000380000114ff00f4a413f4bcf2c80b01020162050202012004030021bc508f6a2686981fd007d207d2068af81c0027bfd8176a2686981fd007d207d206899fc152098402f8d001d0d3030171b08e48135f038020d721ed44d0d303fa00fa40fa40d104d31f01840f218210178d4519ba0282107bdd97deba12b1f2f48040d721fa003012a0401303c8cb0358fa0201cf1601cf16c9ed54e0fa40fa4031fa0031f401fa0031fa00013170f83a02d31f012082100f8a7ea5ba8e85303459db3ce0330c06025c228210178d4519ba8e84325adb3ce034218210595f07bcba8e843101db3ce0135f038210d372158cbadc840ff2f0080701f2ed44d0d303fa00fa40fa40d106d33f0101fa00fa40f401d15141a15238c705f2e04926c2fff2afc882107bdd97de01cb1f5801cb3f01fa0221cf1658cf16c9c8801801cb0526cf1670fa02017158cb6accc903f839206e9430811703de718102f270f8380170f836a0811a6570f836a0bcf2b0028050fb00030903e8ed44d0d303fa00fa40fa40d107d33f0101fa00fa40fa4053bac705f82a5464e070546004131503c8cb0358fa0201cf1601cf16c921c8cb0113f40012f400cb00c9f9007074c8cb02ca07cbffc9d0500cc7051bb1f2e04a5152a009fa0021925f04e30d22d70b01c000b3953010246c31e30d50030b0a09002003c8cb0358fa0201cf1601cf16c9ed5400785054a1f82fa07381040982100966018070f837b60972fb02c8801001cb0501cf1670fa027001cb6a8210d53276db01cb1f5801cb3fc9810082fb00010060c882107362d09c01cb1f2501cb3f5004fa0258cf1658cf16c9c8801001cb0524cf1658fa02017158cb6accc98011fb0001f603d33f0101fa00fa4021fa4430c000f2e14ded44d0d303fa00fa40fa40d1521ac705f2e0495115a120c2fff2aff82a54259070546004131503c8cb0358fa0201cf1601cf16c921c8cb0113f40012f400cb00c920f9007074c8cb02ca07cbffc9d004fa40f401fa002020d70b009ad74bc00101c001b0f2b19130e20d01fec88210178d451901cb1f500a01cb3f5008fa0223cf1601cf1626fa025007cf16c9c8801801cb055004cf1670fa024063775003cb6bccccc945372191729171e2f839206e938127519120e2216e94318128c39101e25023a813a0738103a370f83ca00270f83612a00170f836a07381040982100966018070f837a0bcf2b0040e002a8050fb005803c8cb0358fa0201cf1601cf16c9ed54d28ef7c1")

export function jettonWalletConfigToCell(config: JettonWalletConfig): Cell {
    return beginCell()
        .storeUint(0, 4) // status
        .storeCoins(0) // jetton balance
        .storeAddress(config.ownerAddress)
        .storeAddress(config.jettonMasterAddress)
        .endCell();
}

export function parseJettonWalletData(data: Cell) {
    const sc = data.beginParse()
    const parsed = {
        status: sc.loadUint(4),
        balance: sc.loadCoins(),
        ownerAddress: sc.loadAddress(),
        jettonMasterAddress: sc.loadAddress(),
    };
    endParse(sc);
    return parsed;
}

export class JettonWallet implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new JettonWallet(address);
    }

    static createFromConfig(config: JettonWalletConfig, code: Cell, workchain = 0) {
        const data = jettonWalletConfigToCell(config);
        const init = { code, data };
        return new JettonWallet(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getWalletData(provider: ContractProvider) {
        let { stack } = await provider.get('get_wallet_data', []);
        return {
            balance: stack.readBigNumber(),
            owner: stack.readAddress(),
            minter: stack.readAddress(),
            wallet_code: stack.readCell()
        }
    }
    async getJettonBalance(provider: ContractProvider) {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            return 0n;
        }
        let res = await provider.get('get_wallet_data', []);
        return res.stack.readBigNumber();
    }
    async getWalletStatus(provider: ContractProvider) {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            return 0;
        }
        let res = await provider.get('get_status', []);
        return res.stack.readNumber();
    }
    static transferMessage(jetton_amount: bigint, to: Address,
                           responseAddress:Address | null,
                           customPayload: Cell | null,
                           forward_ton_amount: bigint,
                           forwardPayload?: Cell | Slice | null) {

        const byRef   = forwardPayload instanceof Cell;
        const transferBody = beginCell().storeUint(Op.transfer, 32).storeUint(0, 64) // op, queryId
                          .storeCoins(jetton_amount)
                          .storeAddress(to)
                          .storeAddress(responseAddress)
                          .storeMaybeRef(customPayload)
                          .storeCoins(forward_ton_amount)
                          .storeBit(byRef);

        if(byRef) {
            transferBody.storeRef(forwardPayload);
        }
        else if(forwardPayload) {
            transferBody.storeSlice(forwardPayload);
        }
        return transferBody.endCell();
    }

    async sendTransfer(provider: ContractProvider, via: Sender,
                              value: bigint,
                              jetton_amount: bigint, to: Address,
                              responseAddress:Address,
                              customPayload: Cell | null,
                              forward_ton_amount: bigint,
                              forwardPayload?: Cell | Slice | null) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.transferMessage(jetton_amount, to, responseAddress, customPayload, forward_ton_amount, forwardPayload),
            value:value
        });

    }
    
    async sendCreateOrder(provider: ContractProvider, via: Sender, value: bigint, params: {
        jettonAmount: bigint,
        vault: Address,
        owner: Address,
        toAmount: bigint,
        toJettonMinter: Address,
        customPayload?: Cell | null,
        forwardTonAmount: bigint,
    }) {
        const forwardPayload = beginCell()
            .storeCoins(params.toAmount)
            .storeAddress(params.toJettonMinter)
            .endCell();

        await this.sendTransfer(
            provider,
            via,
            value,
            params.jettonAmount,
            params.vault,
            params.owner,
            params.customPayload ?? null,
            params.forwardTonAmount,
            forwardPayload
        );
    }
    /*
      burn#595f07bc query_id:uint64 amount:(VarUInteger 16)
                    response_destination:MsgAddress custom_payload:(Maybe ^Cell)
                    = InternalMsgBody;
    */
    static burnMessage(jetton_amount: bigint,
                       responseAddress:Address | null,
                       customPayload: Cell | null) {
        return beginCell().storeUint(Op.burn, 32).storeUint(0, 64) // op, queryId
                          .storeCoins(jetton_amount).storeAddress(responseAddress)
                          .storeMaybeRef(customPayload)
               .endCell();
    }

    async sendBurn(provider: ContractProvider, via: Sender, value: bigint,
                          jetton_amount: bigint,
                          responseAddress:Address | null,
                          customPayload: Cell | null) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.burnMessage(jetton_amount, responseAddress, customPayload),
            value:value
        });

    }
    /*
      withdraw_tons#107c49ef query_id:uint64 = InternalMsgBody;
    */
    static withdrawTonsMessage() {
        return beginCell().storeUint(0x6d8e5e3c, 32).storeUint(0, 64) // op, queryId
               .endCell();
    }

    async sendWithdrawTons(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.withdrawTonsMessage(),
            value:toNano('0.1')
        });

    }
    /*
      withdraw_jettons#10 query_id:uint64 wallet:MsgAddressInt amount:Coins = InternalMsgBody;
    */
    static withdrawJettonsMessage(from:Address, amount:bigint) {
        return beginCell().storeUint(0x768a50b2, 32).storeUint(0, 64) // op, queryId
                          .storeAddress(from)
                          .storeCoins(amount)
                          .storeMaybeRef(null)
               .endCell();
    }

    async sendWithdrawJettons(provider: ContractProvider, via: Sender, from:Address, amount:bigint) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.withdrawJettonsMessage(from, amount),
            value:toNano('0.1')
        });

    }
}
