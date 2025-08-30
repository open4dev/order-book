import "utils/generate_addresses"


struct ComissionInfo {
    comissionNum: uint14
    comissionDenom: uint14
    feeAmount: coins
}

struct Storage {
    vault_factory: address
    jettonWalletCode: cell
    jettonMaster: address
    randomHash: uint256
    amount: uint128
    orderCode: cell
    comissionInfo: Cell<ComissionInfo>?
}

struct ( 0x6ef0de39 ) CreateOrder {
}

struct ( 0x12966c79 ) VaultJettonTransfer {
    orderOwner: address
    toJettonMinter: address
    amount: coins
    createdAt: uint32
}


struct JettonTransferNotificationPayload {
    amount: coins
    toJettonMinter: address
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
    comissionInfo: Cell<ComissionInfo>
}

struct ( 0x2717c4a2 ) WithDraw {
    amount: coins
}

// struct ( 0xcaf5eaea ) InternalCloseOrder { // "InternalCloseOrder"c
//     orderOwner: address
//     toJettonMinter: address
//     amount: coins
//     createdAt: uint32
// }

type AllowedMessage = CreateOrder | VaultJettonTransfer | JettonTransferNotification | NotifyCloseOrder | InitVault | WithDraw

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
        WithDraw => {
            var comissionInfo = storage.comissionInfo!.load();

            var jettonWallet = calculateJettonWallet(
                storage.jettonWalletCode,
                storage.jettonMaster
            );

            var msgSendTokens = createMessage({
                bounce: false,
                dest: jettonWallet,
                value: ton("0.1"),
                body: beginCell()
                    .storeUint(0xf8a7ea5, 32).storeUint(0, 64) // 0xf8a7ea5 op: transfer
                    .storeCoins(msg.amount)
                    .storeAddress(in.senderAddress)
                    .storeAddress(in.senderAddress)
                    .storeUint(0, 2)
                    .storeCoins(0)
                    .storeUint(0, 1)
            });

            msgSendTokens.send(SEND_MODE_REGULAR);
            return;
        }
        VaultJettonTransfer => {
            var generatedOrder = generateOrder(
                contract.getAddress(),
                msg.orderOwner,
                storage.jettonMaster,
                msg.toJettonMinter,
                storage.orderCode,
                msg.createdAt
            );
            var generatedOrderAddress = address.fromValidBuilder(generatedOrder.buildAddress());
            assert(generatedOrderAddress == in.senderAddress) throw 403;

            var jettonWallet = calculateJettonWallet(
                storage.jettonWalletCode,
                storage.jettonMaster
            );

            var comissionInfo = storage.comissionInfo!.load();

            var feeAmount = mulDivFloor(msg.amount, comissionInfo.comissionNum, comissionInfo.comissionDenom);

            msg.amount -= feeAmount;

            comissionInfo.feeAmount += feeAmount;

            var msgSendTokens = createMessage({
                bounce: false,
                dest: jettonWallet,
                value: ton("0.1"),
                body: beginCell()
                    .storeUint(0xf8a7ea5, 32).storeUint(0, 64) // 0xf8a7ea5 op: transfer
                    .storeCoins(msg.amount)
                    .storeAddress(msg.orderOwner)
                    .storeAddress(msg.orderOwner)
                    .storeUint(0, 2)
                    .storeCoins(0)
                    .storeUint(0, 1)
            });

            msgSendTokens.send(SEND_MODE_REGULAR);

            debug.printString("Success close order");

            storage.amount -= msg.amount;
            storage.save();
            return;
        }
        JettonTransferNotification => {
            var generatedJettonWallet = calculateJettonWallet(storage.jettonWalletCode, storage.jettonMaster);
            var generatedJettonWalletAddress = address.fromValidBuilder(generatedJettonWallet.buildAddress());
            assert(generatedJettonWalletAddress == in.senderAddress) throw 403;
            storage.amount += msg.amount;

            var forwardPayload = msg.forward_payload!.load();
            var order: AutoDeployAddress = generateOrder(
                contract.getAddress(),
                msg.sender,
                storage.jettonMaster,
                forwardPayload.toJettonMinter,
                storage.orderCode,
                blockchain.now()
            );


            var msgCreateOrder = createMessage({
                bounce: false,
                dest: order,
                value: ton("0.05"),
                body: beginCell()
                    .storeUint(0x2d0e1e1b, 32)
                    .storeCoins(msg.amount)
                    .storeCoins(forwardPayload.amount)
                .endCell()
            });

            msgCreateOrder.send(SEND_MODE_REGULAR);

            storage.save();

            return;
        }
        NotifyCloseOrder => {
            return;
        }
        InitVault => {
            assert(in.senderAddress == storage.vault_factory) throw 422;
            storage.comissionInfo = msg.comissionInfo;
            storage.save();
            return;
        }
    }
}



// fun prepareOrder(msg: JettonTransferNotification, orderCode: cell, jettonMaster: address): AutoDeployAddress {
//     var forwardPayload = JettonTransferNotificationPayload.parse(msg.forward_payload!);
//     var orderInitDataExchangeInfo: cell = beginCell()
//         .storeAddress(jettonMaster)
//         .storeAddress(forwardPayload.toJettonMinter)
//         .storeCoins(0)
//         .storeCoins(0)
//     .endCell();

//     var orderInitData = beginCell()
//         .storeBool(false)
//         .storeAddress(msg.sender)
//         .storeAddress(contract.getAddress())
//         .storeRef(orderInitDataExchangeInfo)
//     .endCell();

//     return AutoDeployAddress{
//         stateInit: {
//             code: orderCode,
//             data: orderInitData
//         }
//     };
// }

fun calculateJettonWallet(jettonWalletCode: cell, jettonMaster: address): AutoDeployAddress {
    var jettonWalletData: cell = beginCell()
        .storeUint(0, 4)
        .storeCoins(0)
        .storeAddress(contract.getAddress())
        .storeAddress(jettonMaster)
    .endCell();

    var jettonWallet = AutoDeployAddress {
        stateInit: {
            code: jettonWalletCode,
            data: jettonWalletData
        }
    };

    return jettonWallet;
}


get fun getData() {
    var storage = Storage.parse(contract.getData());

    return (storage.amount, storage.jettonMaster, storage.randomHash, storage.vault_factory)
}


get fun getCodes() {
    var storage = Storage.parse(contract.getData());

    return (storage.jettonWalletCode, storage.orderCode)
}