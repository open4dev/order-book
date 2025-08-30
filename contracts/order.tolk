import "utils/generate_addresses.tolk";

struct ExchangeInfo {
    fromJettonMinter: address
    toJettonMinter: address
    amount: coins
    priceRate: coins
}


fun Storage.sendInternalMatchOrder(mutate self, anotherOrder: address, msgBody: cell, value: coins) {
    var msg = createMessage({
        bounce: false,
        dest: anotherOrder,
        value: value,
        body: msgBody
    });
    msg.send(SEND_MODE_REGULAR);
}

fun Storage.sendVaultTransferJetton(mutate self, amount: coins, jettonMinter: address, sendMode: int) {
    var msg = createMessage({
        bounce: false,
        dest: self.vault,
        value: ton("0.1"),
        body: beginCell()
            .storeUint(0x12966c79, 32)
            .storeAddress(self.owner)
            .storeAddress(jettonMinter)
            .storeCoins(amount)
            .storeUint(self.createdAt, 32)
        .endCell()
    });
    msg.send(sendMode);
}



struct Storage {
    owner: address
    vault: address
    exchangeInfo: Cell<ExchangeInfo>
    createdAt: uint32
}




fun Storage.parse() {
    return Storage.fromCell(contract.getData());
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}

@inline_ref
fun Storage.serialize(self): cell {
    return self.toCell();
}


struct MatchExchangeInfo {
    amount: coins
    priceRate: coins
}


struct ( 0x47ff7e25 ) MatchOrder {
    anotherVault: address
    anotherOrderOwner: address
    anotherOrder: address
    // matchExchangeInfo: Cell<MatchExchangeInfo>
    createdAt: uint32
}

struct ( 0xdfe29f63 ) InternalMatchOrder {
    anotherVault: address
    anotherOrderOwner: address
    anotherOrder: address
    matchExchangeInfo: Cell<MatchExchangeInfo>
    createdAt: uint32
    matchFlag: bool
}

struct ( 0x16424e8a ) SuccessVerifyOrder {
    anotherVault: address
    anotherOrderOwner: address
    anotherOrder: address
    matchExchangeInfo: Cell<MatchExchangeInfo>
    createdAt: uint32
}

struct ( 0x52e80bac ) CloseOrder {

}

struct ( 0x2d0e1e1b ) InitOrder {
    amount: coins
    priceRate: coins
}

struct (0xd2aabe32) JettonTransferNotificationPayloadClose {
}

struct ( 0x7362d09c ) JettonTransferNotification {
    query_id: uint64
    amount: coins
    sender: address
    forward_payload: cell?
}

type AllowedMessage = MatchOrder | InternalMatchOrder | SuccessVerifyOrder | CloseOrder | InitOrder // | JettonTransferNotification

// type AllowedTransferNotificationMessage = JettonTransferNotificationPayloadClose


fun onInternalMessage(in: InMessage) {
    var storage = Storage.parse();

    var msg = AllowedMessage.fromSlice(in.body);

    match (msg) {
        MatchOrder => {
            var exchangeInfo = storage.exchangeInfo.load();
            // var matchExchangeInfo = msg.matchExchangeInfo.load();
            // var getAmount = mulDivFloor(matchExchangeInfo.amount, matchExchangeInfo.priceRate, ton("1"));
            // assert(getAmount <= exchangeInfo.amount) throw 403;

            var generatedOrder = generateOrder(
                msg.anotherVault,
                msg.anotherOrderOwner,
                exchangeInfo.toJettonMinter,
                exchangeInfo.fromJettonMinter,
                contract.getCode(),
                msg.createdAt
            );

            var generatedOrderAddress = address.fromValidBuilder(generatedOrder.buildAddress());

            assert(generatedOrderAddress == msg.anotherOrder) throw 403;

            var matchInternalExchangeInfo = MatchExchangeInfo {
                amount: exchangeInfo.amount,
                priceRate: exchangeInfo.priceRate
            };

            var bodyInternalMatchOrder = InternalMatchOrder {
                anotherVault: storage.vault,
                anotherOrderOwner: storage.owner,
                anotherOrder: contract.getAddress(),
                matchExchangeInfo: matchInternalExchangeInfo.toCell(),
                createdAt: storage.createdAt,
                matchFlag: true,
            };

            storage.sendInternalMatchOrder(
                msg.anotherOrder,
                bodyInternalMatchOrder.toCell(),
                ton("0.3")
            );

            return;
        }
        InternalMatchOrder => {
            debug.printString("InternalMatchOrder");
            // check fake order
            var exchangeInfo = storage.exchangeInfo.load();
            var anotherOrder = generateOrder(
                msg.anotherVault,
                msg.anotherOrderOwner,
                exchangeInfo.toJettonMinter,
                exchangeInfo.fromJettonMinter,
                contract.getCode(),
                msg.createdAt
            );
            var generatedAnotherOrderAddress = address.fromValidBuilder(anotherOrder.buildAddress());
            assert(generatedAnotherOrderAddress == in.senderAddress) throw 403;

            var matchExchangeInfo = msg.matchExchangeInfo.load();
            var getAmount = mulDivFloor(matchExchangeInfo.amount, matchExchangeInfo.priceRate, ton("1"));
            var sendMode = SEND_MODE_REGULAR;
            if (getAmount > exchangeInfo.amount) {
                getAmount = exchangeInfo.amount;
                sendMode = SEND_MODE_CARRY_ALL_BALANCE + SEND_MODE_DESTROY;
            }
            debug.printString("getAmount: ");
            debug.print(getAmount);

            var matchInternalExchangeInfo = MatchExchangeInfo {
                amount: getAmount,
                priceRate: exchangeInfo.priceRate
            };

            var bodyInternalMatchOrder = InternalMatchOrder {
                anotherVault: storage.vault,
                anotherOrderOwner: storage.owner,
                anotherOrder: contract.getAddress(),
                matchExchangeInfo: matchInternalExchangeInfo.toCell(),
                createdAt: storage.createdAt,
                matchFlag: false,
            };

            if (msg.matchFlag) {
                storage.sendInternalMatchOrder(
                    in.senderAddress,
                    bodyInternalMatchOrder.toCell(),
                    ton("0.15"),
                );
            };
            // TODO: send msg with transfer jetton to user
            storage.sendVaultTransferJetton(
                getAmount,
                exchangeInfo.toJettonMinter,
                sendMode
            );
            exchangeInfo.amount -= getAmount;
            storage.exchangeInfo = exchangeInfo.toCell();
            storage.save();

            return;
        }
        SuccessVerifyOrder => {
            return;
        }
        CloseOrder => {
            assert(in.senderAddress == storage.owner) throw 403;
            var exchangeInfo = storage.exchangeInfo.load();
            var msgCloseOrder = createMessage({
                bounce: false,
                dest: storage.vault,
                value: ton("0.1"),
                body: beginCell()
                    .storeUint(0x12966c79, 32)
                    .storeAddress(storage.owner)
                    .storeAddress(exchangeInfo.toJettonMinter)
                    .storeCoins(exchangeInfo.amount)
                    .storeUint(storage.createdAt, 32)
                .endCell()
            });
            msgCloseOrder.send(SEND_MODE_CARRY_ALL_BALANCE + SEND_MODE_DESTROY);
            return;
        }
        InitOrder => {
            debug.printString("Init order");
            var exchangeInfo = storage.exchangeInfo.load();
            assert(exchangeInfo.amount == 0) throw 403;
            assert(in.senderAddress == storage.vault) throw 403;
            exchangeInfo.amount = msg.amount;
            exchangeInfo.priceRate = msg.priceRate;
            storage.exchangeInfo = exchangeInfo.toCell();
            storage.save();
            return; 
        }
        // JettonTransferNotification => {
        //     // generateJ
        //     // TODO
        //     if (msg.forward_payload == null) {
        //         return;
        //     }
        //     var msgPayload = AllowedTransferNotificationMessage.fromCell(msg.forward_payload!);
        //     match (msgPayload) {
        //         JettonTransferNotificationPayloadClose => {
        //             var msgDeleteOrder = createMessage({
        //                 bounce: false,
        //                 dest: storage.owner,
        //                 value: ton("0.02"),
        //             });
        //             msgDeleteOrder.send(SEND_MODE_CARRY_ALL_BALANCE + SEND_MODE_DESTROY);
        //             return;
        //         }
        //     }
        // }
    }
}


fun Storage.sendVaultTransfer(mutate self, amount: coins) {
}

get fun getData(): (address, address, cell, uint32) {
    var storage = Storage.parse();


    return (storage.owner, storage.vault, storage.exchangeInfo, storage.createdAt);
}