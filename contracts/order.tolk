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

            var generatedOrderAddress = generateOrderAddress(msg.anotherVault, msg.anotherOrderOwner, exchangeInfo);

            assert(generatedOrderAddress == msg.anotherOrder) throw 403;

            


            debug.printString("Success match order");
            return;
        }
        InternalMatchOrder => {
            return;
        }
        SuccessVerifyOrder => {
            return;
        }
        CloseOrder => {
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


fun generateOrderAddress(anotherVault: address, anotherOrderOwner: address, exchangeInfo: ExchangeInfo) {
    var anotherOrderInitDataExchangeInfo: cell = beginCell()
        .storeAddress(exchangeInfo.toJettonMinter)
        .storeAddress(exchangeInfo.fromJettonMinter)
        .storeCoins(exchangeInfo.toAmount)
        .storeCoins(exchangeInfo.fromAmount)
    .endCell();
    
    var anotherOrderInitData = beginCell()
        .storeAddress(anotherOrderOwner)
        .storeAddress(anotherVault)
        .storeRef(anotherOrderInitDataExchangeInfo)
    .endCell();

    var anotherOrderStateInitCell = beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(contract.getCode())
        .storeMaybeRef(anotherOrderInitData)
        .storeUint(0, 1)
    .endCell();

    var anotherOrderAddress = beginCell()
        .storeUint(4, 3)
        .storeInt(BASECHAIN, 8)
        .storeUint(anotherOrderStateInitCell.hash(), 256)
    .endCell()
    .beginParse()
    .loadAddress();

    return anotherOrderAddress;
}

get fun getData(): (address, address, cell) {
    var storage = Storage.parse();


    return (storage.owner, storage.vault, storage.exchangeInfo);
}