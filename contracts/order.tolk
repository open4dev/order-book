struct ExchangeInfo {
    fromJettonMinter: address?
    toJettonMinter: address?
    fromAmount: coins
    toAmount: coins
}


struct Storage {
    owner: address
    vault: address
    exchangeInfo: Cell<ExchangeInfo>
}




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



struct ( 0x47ff7e25 ) MatchOrder {
    anotherOrder: address
    fromAmount: coins
    toAmount: coins
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
    var storage = Storage.parse(contract.getData());

    var msg = AllowedMessage.fromSlice(in.body);

    match (msg) {
        MatchOrder => {
            // assert(msg.fromAmount <= storage.fr)
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