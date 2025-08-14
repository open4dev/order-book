

struct Storage {
    vault_factory: address
    version: uint2
    jettonWalletCode: cell
    jettonMaster: address
    randomHash: uint256
    amount: uint128
    orderCode: cell
}

struct ( 0x6ef0de39 ) CreateOrder {
}

struct ( 0x12966c79 ) VaultJettonTransfer {

}


struct JettonTransferNotificationPayload {
    toAmount: coins
    toJettonMinter: address
}

fun JettonTransferNotificationPayload.parse(c: cell): JettonTransferNotificationPayload {
    return JettonTransferNotificationPayload.fromCell(c);
}

struct ( 0x7362d09c ) JettonTransferNotification {
    query_id: uint64
    amount: coins
    sender: address
    forward_payload: Cell<JettonTransferNotificationPayload>?
}

struct ( 0x7d36e7d6 ) NotifyCloseOrder {

}

struct ( 0x2717c4a2 ) InitVault {
}

type AllowedMessage = CreateOrder | VaultJettonTransfer | JettonTransferNotification | NotifyCloseOrder | InitVault

fun Storage.load() {
    return Storage.fromCell(contract.getData());
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}

@inline_ref
fun Storage.serialize(self): cell {
    return self.toCell();
}

@inline
fun Storage.parse(c: cell): Storage {
    return Storage.fromCell(c);
}




fun onInternalMessage(in: InMessage) {
    var storage = Storage.parse(contract.getData());

    var msg = AllowedMessage.fromSlice(in.body);

    match (msg) {
        CreateOrder => {
            return;
        }
        VaultJettonTransfer => {
            return;
        }
        JettonTransferNotification => {
            var generatedJettonWalletAddress: address = calculateJettonWalletAddress(storage.jettonWalletCode, storage.jettonMaster);
            assert(generatedJettonWalletAddress == in.senderAddress) throw 403;
            storage.amount += msg.amount;

            var orderAddress: AutoDeployAddress = prepareOrder(msg, storage.orderCode, storage.jettonMaster);

            var msgCreateOrder = createMessage({
                bounce: false,
                dest: orderAddress,
                value: ton("0.1"),
                body: beginCell()
                    .storeUint(0x2d0e1e1b, 32)
                .endCell()
            });

            msgCreateOrder.send(SEND_MODE_REGULAR);

            return;
        }
        NotifyCloseOrder => {
            return;
        }
        InitVault => {
            assert (in.senderAddress == storage.vault_factory) throw 422;
            return;
        }
    }
}



fun prepareOrder(msg: JettonTransferNotification, orderCode: cell, jettonMaster: address): AutoDeployAddress {
    var forwardPayload = JettonTransferNotificationPayload.parse(msg.forward_payload!);
    var orderInitDataExchangeInfo: cell = beginCell()
        .storeAddress(jettonMaster)
        .storeAddress(forwardPayload.toJettonMinter)
        .storeCoins(msg.amount)
        .storeCoins(forwardPayload.toAmount)
    .endCell();

    var orderInitData = beginCell()
        .storeAddress(msg.sender)
        .storeAddress(contract.getAddress())
        .storeRef(orderInitDataExchangeInfo)
    .endCell();

    return AutoDeployAddress{
        stateInit: {
            code: orderCode,
            data: orderInitData
        }
    };
}

fun calculateJettonWalletAddress(jettonWalletCode: cell, jettonMaster: address): address {
    // pack_jetton_wallet_data:
    // begin_cell()
    //     .store_uint(status, STATUS_SIZE)
    //     .store_coins(balance)
    //     .store_slice(owner_address)
    //     .store_slice(jetton_master_address)
    //     .end_cell();
    // return begin_cell()
    //     .store_uint(0, 2) ;; 0b00 - No split_depth; No special
    //     .store_maybe_ref(jetton_wallet_code)
    //     .store_maybe_ref(
    //         pack_jetton_wallet_data(
    //             0, ;; status
    //             0, ;; balance
    //             owner_address,
    //             jetton_master_address)
    //     )
    //     .store_uint(0, 1) ;; Empty libraries
    //     .end_cell();

    var jettonWalletData: cell = beginCell()
        .storeUint(0, 4)
        .storeCoins(0)
        .storeAddress(contract.getAddress())
        .storeAddress(jettonMaster)
    .endCell();

    var stateInitCell = beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(jettonWalletData)
        .storeUint(0, 1)
    .endCell();

    var jettonWalletAddress: address = beginCell()
    .storeUint(4, 3)
    .storeInt(BASECHAIN, 8)
    .storeUint(stateInitCell.hash(), 256)
    .endCell()
    .beginParse()
    .loadAddress();

    return jettonWalletAddress
}
