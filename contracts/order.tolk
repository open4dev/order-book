import "utils/generate_addresses.tolk";

struct ExchangeInfo {
    fromJettonMinter: address
    toJettonMinter: address
    fromAmount: coins
    toAmount: coins
}

fun ExchangeInfo.parse(c: cell) {
    return ExchangeInfo.fromCell(c);
}


struct Storage {
    owner: address
    vault: address
    exchangeInfo: Cell<ExchangeInfo>
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
    fromAmount: coins
    toAmount: coins
}

fun MatchExchangeInfo.parse(c: cell) {
    return MatchExchangeInfo.fromCell(c);
}


struct ( 0x47ff7e25 ) MatchOrder {
    anotherVault: address
    anotherOrderOwner: address
    anotherOrder: address
    matchExchangeInfo: Cell<MatchExchangeInfo>
}

struct ( 0xdfe29f63 ) InternalMatchOrder {
    anotherVault: address
    anotherOrderOwner: address
    matchExchangeInfo: Cell<MatchExchangeInfo>
}

struct ( 0x16424e8a ) SuccessVerifyOrder {

}

struct ( 0x52e80bac ) CloseOrder {

}

struct ( 0x2d0e1e1b ) InitOrder {
}

type AllowedMessage = MatchOrder | InternalMatchOrder | SuccessVerifyOrder | CloseOrder | InitOrder



fun onInternalMessage(in: InMessage) {
    var storage = Storage.parse();

    var msg = AllowedMessage.fromSlice(in.body);

    match (msg) {
        MatchOrder => {
            var exchangeInfo = ExchangeInfo.parse(storage.exchangeInfo);
            var matchExchangeInfo = MatchExchangeInfo.parse(msg.matchExchangeInfo);
            assert(matchExchangeInfo.fromAmount <= exchangeInfo.fromAmount) throw 47;
            assert(matchExchangeInfo.toAmount <= exchangeInfo.toAmount) throw 47;

            var generatedOrderAddress = generateOrderAddress(
                msg.anotherVault,
                msg.anotherOrderOwner,
                exchangeInfo.toJettonMinter,
                exchangeInfo.fromJettonMinter,
                matchExchangeInfo.toAmount,
                matchExchangeInfo.fromAmount,
                contract.getCode()
            );

            assert(generatedOrderAddress == msg.anotherOrder) throw 403;
            debug.printString("Success match order");
            return;
        }
        InternalMatchOrder => {
            var exchangeInfo = ExchangeInfo.parse(storage.exchangeInfo);
            var matchExchangeInfo = MatchExchangeInfo.parse(msg.matchExchangeInfo);
            assert(matchExchangeInfo.fromAmount <= exchangeInfo.fromAmount) throw 47;
            assert(matchExchangeInfo.toAmount <= exchangeInfo.toAmount) throw 47;

            var generatedOrderAddress = generateOrderAddress(
                msg.anotherVault,
                msg.anotherOrderOwner,
                exchangeInfo.toJettonMinter,
                exchangeInfo.fromJettonMinter,
                matchExchangeInfo.toAmount,
                matchExchangeInfo.fromAmount,
                contract.getCode()
            );

            assert(generatedOrderAddress == in.senderAddress) throw 403;
            debug.printString("Success match order");
            return;
        }
        SuccessVerifyOrder => {
            return;
        }
        CloseOrder => {
            assert(in.senderAddress == storage.owner) throw 403;
            var exchangeInfo = ExchangeInfo.parse(storage.exchangeInfo);
            var msgCloseOrder = createMessage({
                bounce: false,
                dest: storage.vault,
                value: ton("0.1"),
                body: beginCell()
                    .storeUint(0xcaf5eaea, 32)
                    .storeAddress(storage.owner)
                    .storeAddress(exchangeInfo.toJettonMinter)
                    .storeCoins(exchangeInfo.toAmount)
                    .storeCoins(exchangeInfo.fromAmount)
                .endCell()
            });
            msgCloseOrder.send(SEND_MODE_CARRY_ALL_BALANCE + SEND_MODE_DESTROY);
            return;
        }
        InitOrder => {
            return; 
        }
    }
}


// fun Storage.Init(mutate self, msg: InitOrder)  {
//     self.init = true;
//     // self.owner = msg.owner;
//     // self.fromAmount = msg.fromAmount;
//     // self.toAmount = msg.toAmount;
//     // self.vault = msg.vault;
//     return contract.setData(self.toCell())
// }


get fun getData(): (address, address, cell) {
    var storage = Storage.parse();


    return (storage.owner, storage.vault, storage.exchangeInfo);
}