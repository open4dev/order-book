import "utils/generate_addresses.tolk";
import "utils/fees.tolk";

struct JettonInfo {
    jettonMinter: address
}

struct ExchangeInfo {
    from: Cell<JettonInfo>?
    to: Cell<JettonInfo>?
    amount: coins
    priceRate: coins
    slippage: uint30
}

struct Storage {
    owner: address
    vault: address
    exchangeInfo: Cell<ExchangeInfo>
    createdAt: uint32
}



// Returns -1 if actual < lower bound (> slippage below reference)
// Returns 1 if actual > upper bound (> slippage above reference)
// Returns 0 if within [reference*(1-slippage), reference*(1+slippage)] range
fun compareWithSlippage(actual: coins, reference: coins, slippage: uint30): int {
    var denom = 1000000000; // 1e9 = 100%
    actual = mulDivFloor(ton("1"), ton("1"), actual);
    var lower = mulDivFloor(reference, denom - slippage, denom);
    if (actual < lower) {
        return -1;
    }
    var upper = mulDivFloor(reference, denom + slippage, denom);
    if (actual > upper) {
        return 1;
    }
    return 0;
}


fun Storage.sendInternalMatchOrder(mutate self, anotherOrder: address, msgBody: cell, value: coins, sendMode: int) {
    var msg = createMessage({
        bounce: false,
        dest: anotherOrder,
        value: value,
        body: msgBody
    });
    msg.send(sendMode);
}

fun Storage.sendVaultTransferJetton(mutate self, value: coins, amount: coins, toJetton: cell?, closedFlag: bool, destination: address, matcher: address, sendMode: int) {
    var msg = createMessage({
        bounce: false,
        dest: self.vault,
        value: value,
        body: beginCell()
            .storeUint(0x12966c79, 32)
            .storeAddress(self.owner)
            .storeAddress(matcher)
            .storeMaybeRef(toJetton)
            .storeCoins(amount)
            .storeUint(self.createdAt, 32)
            .storeAddress(destination)
            .storeBool(closedFlag)
        .endCell()
    });
    msg.send(sendMode);
}







fun Storage.parse() {
    return Storage.fromCell(contract.getData());
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}


struct MatchExchangeInfo {
    amount: coins
    priceRate: coins
}


struct ( 0x47ff7e25 ) MatchOrder {
    anotherVault: address
    anotherOrderOwner: address
    anotherOrder: address
    createdAt: uint32
}

struct ( 0xdfe29f63 ) InternalMatchOrder {
    anotherVault: address
    anotherOrderOwner: address
    matcher: address
    matchExchangeInfo: Cell<MatchExchangeInfo>
    createdAt: uint32
    stage: uint2
}

struct ( 0x52e80bac ) CloseOrder {

}

struct ( 0x2d0e1e1b ) InitOrder {
    amount: coins
    priceRate: coins
    slippage: uint30
}

type AllowedMessage = MatchOrder | InternalMatchOrder | CloseOrder | InitOrder

fun onInternalMessage(in: InMessage) {
    var storage = Storage.parse();

    var msg = AllowedMessage.fromSlice(in.body);

    match (msg) {
        MatchOrder => {
            assert(in.valueCoins >= GAS_ORDER_FULL_MATCH) throw 422;
            var exchangeInfo = storage.exchangeInfo.load();
            var generatedOrder = generateOrder(
                msg.anotherVault,
                msg.anotherOrderOwner,
                exchangeInfo.to,
                exchangeInfo.from,
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
                matcher: in.senderAddress,
                matchExchangeInfo: matchInternalExchangeInfo.toCell(),
                createdAt: storage.createdAt,
                stage: 0,
            };

            storage.sendInternalMatchOrder(
                msg.anotherOrder,
                bodyInternalMatchOrder.toCell(),
                0,
                SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE
            );

            return;
        }
        InternalMatchOrder => {
            var exchangeInfo = storage.exchangeInfo.load();
            var anotherOrder = generateOrder(
                msg.anotherVault,
                msg.anotherOrderOwner,
                exchangeInfo.to,
                exchangeInfo.from,
                contract.getCode(),
                msg.createdAt
            );
            var generatedAnotherOrderAddress = address.fromValidBuilder(anotherOrder.buildAddress());
            assert(generatedAnotherOrderAddress == in.senderAddress) throw 403;
            

            var matchExchangeInfo = msg.matchExchangeInfo.load();
            var anotherGetAmount = mulDivFloor(matchExchangeInfo.amount, matchExchangeInfo.priceRate, ton("1"));

            assert(compareWithSlippage(matchExchangeInfo.priceRate, exchangeInfo.priceRate, exchangeInfo.slippage) == 0) throw 405;

            var sendModeTransfer = SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE;
            var sendModeMatch = SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE;
            var valueMatch = 0;
            if (msg.stage == 1) {
                sendModeMatch = SEND_MODE_REGULAR;
                sendModeTransfer = SEND_MODE_CARRY_ALL_BALANCE;
                valueMatch = in.valueCoins / 2;
            }


            if (anotherGetAmount >= exchangeInfo.amount) {
                anotherGetAmount = exchangeInfo.amount;
                sendModeTransfer = SEND_MODE_CARRY_ALL_BALANCE + SEND_MODE_DESTROY;
            } else {
                reserveToncoinsOnBalance(0, 4);
            }

            var matchInternalExchangeInfo = MatchExchangeInfo {
                amount: exchangeInfo.amount,
                priceRate: exchangeInfo.priceRate
            };

            var bodyInternalMatchOrder = InternalMatchOrder {
                anotherVault: storage.vault,
                anotherOrderOwner: storage.owner,
                matcher: msg.matcher,
                matchExchangeInfo: matchInternalExchangeInfo.toCell(),
                createdAt: storage.createdAt,
                stage: msg.stage + 1,
            };

            if ((msg.stage == 0) || (msg.stage == 1)) {
                storage.sendInternalMatchOrder(
                    in.senderAddress,
                    bodyInternalMatchOrder.toCell(),
                    valueMatch,
                    sendModeMatch,
                );
            };
            if ((msg.stage == 2) || (msg.stage == 1)) {
                storage.sendVaultTransferJetton(
                    0,
                    anotherGetAmount,
                    exchangeInfo.to,
                    false,
                    msg.anotherOrderOwner,
                    msg.matcher,
                    sendModeTransfer,
                );
                exchangeInfo.amount -= anotherGetAmount;
                storage.exchangeInfo = exchangeInfo.toCell();
                storage.save();
            }


            return;
        }
        CloseOrder => {
            assert(in.senderAddress == storage.owner) throw 403;
            assert(in.valueCoins >= GAS_ORDER_CLOSE + GAS_VAULT_JETTON_TRANSFER + GAS_JETTON_WALLET_TRANSFER) throw 422;
            var exchangeInfo = storage.exchangeInfo.load();
            storage.sendVaultTransferJetton(
                0,
                exchangeInfo.amount,
                exchangeInfo.to,
                true,
                storage.owner,
                storage.owner,
                SEND_MODE_CARRY_ALL_BALANCE | SEND_MODE_DESTROY
            );
            return;
        }
        InitOrder => {
            assert(in.senderAddress == storage.vault) throw 403;
            assert(in.valueCoins >= GAS_STORAGE + GAS_ORDER_INIT) throw 422;
            var exchangeInfo = storage.exchangeInfo.load();
            assert(exchangeInfo.amount == 0) throw 403;
            exchangeInfo.amount = msg.amount;
            exchangeInfo.priceRate = msg.priceRate;
            exchangeInfo.slippage = msg.slippage;
            storage.exchangeInfo = exchangeInfo.toCell();
            storage.save();
            return; 
        }
    }
}


get fun getData(): (address, address, cell, uint32) {
    var storage = Storage.parse();


    return (storage.owner, storage.vault, storage.exchangeInfo, storage.createdAt);
}