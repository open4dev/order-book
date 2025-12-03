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

struct FeeInfo {
    provider: address
    feeNum: uint14
    feeDenom: uint14
    matcherFeeNum: uint14
    matcherFeeDenom: uint14
}


struct Storage {
    owner: address
    vault: address
    feeInfo: Cell<FeeInfo>?
    exchangeInfo: Cell<ExchangeInfo>
    createdAt: uint32
}

struct VaultJettonTransferAddresses {
    ownerOrder: address
    matcher: address
    anotherOwnerOrder: address
}

struct ( 0x12966c79 ) VaultTransferJetton {
    addresses: Cell<VaultJettonTransferAddresses>
    toJetton: Cell<JettonInfo>?
    amountTransfer: coins
    createdAtOrder: uint32
    closedFlag: bool
    feeInfo: Cell<FeeInfo>
}

fun simpleMessage(dest: address, value: coins, body: cell, sendMode: int) {
    var msg = createMessage({
        bounce: false,
        dest: dest,
        value: value,
        body: body
    });
    msg.send(sendMode);
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
        bounce: BounceMode.RichBounce,
        dest: anotherOrder,
        value: value,
        body: msgBody
    });
    msg.send(sendMode);
}

fun Storage.sendVaultTransferJetton(mutate self, value: coins, amount: coins, toJetton: Cell<JettonInfo>?, closedFlag: bool, destination: address, matcher: address, sendMode: int) {
    var addresses = VaultJettonTransferAddresses {
        ownerOrder: self.owner,
        matcher: matcher,
        anotherOwnerOrder: destination,
    };
    var transferJetton = VaultTransferJetton {
        addresses: addresses.toCell(),
        toJetton: toJetton,
        amountTransfer: amount,
        createdAtOrder: self.createdAt,
        closedFlag: closedFlag,
        feeInfo: self.feeInfo!
    };
    var msg = createMessage({
        bounce: false,
        dest: self.vault,
        value: value,
        body: transferJetton
    });
    msg.send(sendMode);
}


fun Storage.sendSuccessMatch(mutate self, value: coins, anotherOrder: address, startAmount: coins, amount: coins, matcher: address, sendMode: int) {
    var successInfo = SuccessInfo {
        startAmount: startAmount,
        amount: amount
    };
    var successInfoCell = successInfo.toCell();
    var msg = createMessage({
        bounce: false,
        dest: anotherOrder,
        value: value,
        body: beginCell()
            .storeUint(0x55feb42a, 32)
            .storeAddress(self.vault)
            .storeAddress(self.owner)
            .storeUint(self.createdAt, 32)
            .storeAddress(matcher)
            .storeRef(successInfoCell)
        .endCell()
    });
    msg.send(sendMode);
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}


struct MatchExchangeInfo {
    amount: coins
    priceRate: coins
    slippage: uint30
}

struct ( 0x47ff7e25 ) MatchOrder {
    anotherVault: address
    anotherOrderOwner: address
    anotherOrder: address
    createdAt: uint32
    amount: coins
}

struct ( 0xdfe29f63 ) InternalMatchOrder {
    anotherVault: address
    anotherOrderOwner: address
    matcher: address
    matchExchangeInfo: Cell<MatchExchangeInfo>
    createdAt: uint32
}

struct ( 0x52e80bac ) CloseOrder {

}

struct ( 0x2d0e1e1b ) InitOrder {
    amount: coins
    priceRate: coins
    slippage: uint30
    feeInfo: Cell<FeeInfo>
}

struct SuccessInfo {
    startAmount: coins
    amount: coins
}

struct ( 0x55feb42a ) SuccessMatch {
    anotherVault: address
    anotherOrderOwner: address
    anotherOrderCreatedAt: uint32
    matcher: address
    matchExchangeInfo: Cell<SuccessInfo>
}

type AllowedMessage = MatchOrder | InternalMatchOrder | CloseOrder | InitOrder | SuccessMatch

fun onInternalMessage(in: InMessage) {
    var storage = lazy Storage.fromCell(contract.getData());

    var msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        MatchOrder => {
            assert(in.valueCoins >= GAS_ORDER_FULL_MATCH) throw 422;
            var exchangeInfo = storage.exchangeInfo.load();
            assert(exchangeInfo.amount > 0) throw 406;
            assert(msg.amount <= exchangeInfo.amount) throw 407;
            var generatedOrder = generateOrder(
                msg.anotherVault,
                msg.anotherOrderOwner,
                exchangeInfo.to,
                exchangeInfo.from,
                contract.getCode(),
                msg.createdAt
            );

            var generatedOrderAddress = generatedOrder.calculateAddress();

            assert(generatedOrderAddress == msg.anotherOrder) throw 403;

            var matchInternalExchangeInfo = MatchExchangeInfo {
                amount: msg.amount,
                priceRate: exchangeInfo.priceRate,
                slippage: exchangeInfo.slippage
            };

            var bodyInternalMatchOrder = InternalMatchOrder {
                anotherVault: storage.vault,
                anotherOrderOwner: storage.owner,
                matcher: in.senderAddress,
                matchExchangeInfo: matchInternalExchangeInfo.toCell(),
                createdAt: storage.createdAt,
            };

            storage.sendInternalMatchOrder(
                msg.anotherOrder,
                bodyInternalMatchOrder.toCell(),
                0,
                SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE
            );
            exchangeInfo.amount -= msg.amount;
            storage.exchangeInfo = exchangeInfo.toCell();
            storage.save();
            return;
        }
        InternalMatchOrder => {
            var exchangeInfo = storage.exchangeInfo.load();
            var matchExchangeInfo = msg.matchExchangeInfo.load();
            val compareSlippage = compareWithSlippage(matchExchangeInfo.priceRate, exchangeInfo.priceRate, exchangeInfo.slippage);
            val anotherCompareSlippage: int = compareWithSlippage(matchExchangeInfo.priceRate, exchangeInfo.priceRate, matchExchangeInfo.slippage);
            debug.print(exchangeInfo.amount);
            debug.print(compareSlippage);
            debug.print(anotherCompareSlippage);
            assert ((exchangeInfo.amount > 0) && (compareSlippage == 0) && (anotherCompareSlippage == 0)) throw 407;
            reserveToncoinsOnBalance(GAS_STORAGE, 0);
            storage.verifySender(in.senderAddress, exchangeInfo, msg.anotherVault, msg.anotherOrderOwner, msg.createdAt, 0);
            

            var anotherGetAmount = mulDivFloor(matchExchangeInfo.amount, matchExchangeInfo.priceRate, ton("1"));
            if (anotherGetAmount > exchangeInfo.amount) {
                anotherGetAmount = exchangeInfo.amount;
            }

            // send success match to order
            var getAmount = mulDivFloor(anotherGetAmount, ton("1"), matchExchangeInfo.priceRate);
            storage.sendSuccessMatch(
                in.valueCoins / 2,
                in.senderAddress,
                matchExchangeInfo.amount,
                getAmount,
                msg.matcher,
                0,
            );

            // send vault transfer jetton
            storage.sendVaultTransferJetton(
                0,
                anotherGetAmount,
                exchangeInfo.to,
                false,
                msg.anotherOrderOwner,
                msg.matcher,
                SEND_MODE_CARRY_ALL_BALANCE,
            );


            exchangeInfo.amount -= anotherGetAmount;
            storage.exchangeInfo = exchangeInfo.toCell();
            storage.save();
            return;
        }
        SuccessMatch => {
            var exchangeInfo = storage.exchangeInfo.load();
            // verify sender
            storage.verifySender(in.senderAddress, exchangeInfo, msg.anotherVault, msg.anotherOrderOwner, msg.anotherOrderCreatedAt, 0);

            reserveToncoinsOnBalance(GAS_STORAGE, 0);

            var matchExchangeInfo = msg.matchExchangeInfo.load();

            storage.sendVaultTransferJetton(
                0,
                matchExchangeInfo.amount,
                exchangeInfo.to,
                false,
                msg.anotherOrderOwner,
                msg.matcher,
                SEND_MODE_CARRY_ALL_BALANCE,
            );
            // change storage
            val increaseAmount = matchExchangeInfo.startAmount - matchExchangeInfo.amount;
            exchangeInfo.amount += increaseAmount;
            storage.exchangeInfo = exchangeInfo.toCell();
            storage.save();
            return;
        }
        CloseOrder => {
            storage.verifySender(in.senderAddress, null, null, null, null, 2);
            // assert(in.senderAddress == storage.owner) throw 403;
            assert(in.valueCoins >= GAS_ORDER_CLOSE + GAS_VAULT_JETTON_TRANSFER + GAS_JETTON_WALLET_TRANSFER) throw 422;
            var exchangeInfo = storage.exchangeInfo.load();
            storage.sendVaultTransferJetton(
                0,
                exchangeInfo.amount,
                exchangeInfo.to,
                true,
                storage.owner,
                storage.owner,
                SEND_MODE_CARRY_ALL_BALANCE
            );
            return;
        }
        InitOrder => {
            storage.verifySender(in.senderAddress, null, null, null, null, 1);
            // assert(in.senderAddress == storage.vault) throw 403;
            assert(in.valueCoins >= GAS_STORAGE) throw 422;
            var exchangeInfo = storage.exchangeInfo.load();
            assert(exchangeInfo.amount == 0) throw 403;
            exchangeInfo.amount = msg.amount;
            exchangeInfo.priceRate = msg.priceRate;
            exchangeInfo.slippage = msg.slippage;
            storage.exchangeInfo = exchangeInfo.toCell();
            storage.feeInfo = msg.feeInfo;
            storage.save();
            return; 
        }
    }
}

type BouncedMessage = InternalMatchOrder

fun onBouncedMessage(in: InMessageBounced) {
    var storage = lazy Storage.fromCell(contract.getData());

    val rich = lazy RichBounceBody.fromSlice(in.bouncedBody);

    var msg = lazy BouncedMessage.fromCell(rich.originalBody);
    match (msg) {
        InternalMatchOrder => {
            var msgExchangeInfo = msg.matchExchangeInfo.load();
            var storageExchangeInfo = storage.exchangeInfo.load();
            storageExchangeInfo.amount += msgExchangeInfo.amount;
            storage.exchangeInfo = storageExchangeInfo.toCell();
            storage.save();
            simpleMessage(msg.matcher, 0, beginCell().storeUint(0xecd3ad8e, 32).endCell(), SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
            return;   
        }
    }
    return;
}

fun Storage.verifySender(mutate self, senderAddress: address, exchangeInfo: ExchangeInfo | null, anotherVault: address | null, anotherOrderOwner: address | null, createdAt: uint32 | null, typeVerify: int) {
    match (typeVerify) {
        0 => {
            var anotherOrder = generateOrder(
                anotherVault!,
                anotherOrderOwner!,
                exchangeInfo!.to,
                exchangeInfo!.from,
                contract.getCode(),
                createdAt!
            );
            var generatedAnotherOrderAddress = anotherOrder.calculateAddress();
            assert(senderAddress == generatedAnotherOrderAddress) throw 403;
        }
        1 => {
            assert(senderAddress == self.vault) throw 403;
        }
        2 => {
            assert(senderAddress == self.owner) throw 403;
        }
    }

}


get fun getData(): (address, address, cell, uint32) {
    var storage = lazy Storage.fromCell(contract.getData());



    return (storage.owner, storage.vault, storage.exchangeInfo, storage.createdAt);
}