import "utils/types.tolk"
import "utils/errors.tolk"
import "utils/op_codes.tolk"
import "utils/fees.tolk"
import "utils/fee_calc.tolk"
import "utils/messages.tolk"
import "utils/generate_addresses.tolk"

const SLIPPAGE_PRECISION = 1000000000; // 1e9 = 100%

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
    feeInfo: Cell<FeeInfo>?
    exchangeInfo: Cell<ExchangeInfo>
    createdAt: uint32
}

// Message structs with opcodes
struct ( 0x52e80bac ) CloseOrder {}

struct ( 0xa597947e ) CloseOrderMessageToVault {
    orderOwner: address
    toJetton: Cell<JettonInfo>?
    amountTransfer: coins
    createdAtOrder: uint32
}

struct ( 0x12966c79 ) VaultTransferJetton {
    addresses: Cell<TransferAddresses>
    toJetton: Cell<JettonInfo>?
    amountTransfer: coins
    createdAtOrder: uint32
    feeInfo: Cell<FeeInfo>
}

struct MatchExchangeInfo {
    amount: coins
    priceRate: coins
    slippage: uint30
    feeInfo: Cell<FeeInfo>
}

struct ( 0x47ff7e25 ) MatchOrder {
    anotherVault: address
    anotherOrderOwner: address
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
    feeInfo: Cell<FeeInfo>
    matchExchangeInfo: Cell<SuccessInfo>
}

type AllowedMessage = MatchOrder | InternalMatchOrder | CloseOrder | InitOrder | SuccessMatch

// Simplified slippage check - returns true if within acceptable range
fun isWithinSlippage(actual: coins, reference: coins, slippage: uint30): bool {
    val invActual = mulDivFloor(ton("1"), ton("1"), actual);
    val lower = mulDivFloor(reference, SLIPPAGE_PRECISION - slippage, SLIPPAGE_PRECISION);
    val upper = mulDivFloor(reference, SLIPPAGE_PRECISION + slippage, SLIPPAGE_PRECISION);
    return (invActual >= lower) && (invActual <= upper);
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}

fun Storage.sendInternalMatchOrder(mutate self, anotherOrder: address, msgBody: cell, value: coins, sendMode: int) {
    sendBouncedMessage(anotherOrder, value, msgBody, sendMode);
}

fun Storage.sendVaultTransferJetton(mutate self, value: coins, amount: coins, toJetton: Cell<JettonInfo>?, destination: address, feeInfo: Cell<FeeInfo>, matcher: address, sendMode: int) {
    var addresses = TransferAddresses {
        orderOwner: self.owner,
        matcher: matcher,
        counterparty: destination,
    };
    var transferJetton = VaultTransferJetton {
        addresses: addresses.toCell(),
        toJetton: toJetton,
        amountTransfer: amount,
        createdAtOrder: self.createdAt,
        feeInfo: feeInfo
    };
    sendSimpleMessage(self.vault, value, transferJetton.toCell(), sendMode);
}

fun Storage.sendVaultCloseOrder(self, amountTransfer: coins, value: coins, toJetton: Cell<JettonInfo>?, sendMode: int) {
    var closeOrder = CloseOrderMessageToVault {
        orderOwner: self.owner,
        toJetton: toJetton,
        amountTransfer: amountTransfer,
        createdAtOrder: self.createdAt
    };
    sendSimpleMessage(self.vault, value, closeOrder.toCell(), sendMode);
}

fun Storage.sendSuccessMatch(mutate self, value: coins, anotherOrder: address, startAmount: coins, amount: coins, matcher: address, sendMode: int) {
    var successInfo = SuccessInfo {
        startAmount: startAmount,
        amount: amount
    };
    var body = beginCell()
        .storeUint(OP_CODE_SUCCESS_MATCH, 32)
        .storeAddress(self.vault)
        .storeAddress(self.owner)
        .storeUint(self.createdAt, 32)
        .storeAddress(matcher)
        .storeRef(self.feeInfo!)
        .storeRef(successInfo.toCell())
    .endCell();
    sendSimpleMessage(anotherOrder, value, body, sendMode);
}

fun onInternalMessage(in: InMessage) {
    var storage = lazy Storage.fromCell(contract.getData());
    var msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        MatchOrder => {
            assert(in.valueCoins >= GAS_ORDER_FULL_MATCH) throw ERR_INSUFFICIENT_GAS;
            var exchangeInfo = storage.exchangeInfo.load();
            assert(exchangeInfo.amount > 0) throw ERR_AMOUNT_NOT_AVAILABLE;
            assert(msg.amount <= exchangeInfo.amount) throw ERR_INVALID_AMOUNT;

            var generatedOrder = generateOrder(
                msg.anotherVault,
                msg.anotherOrderOwner,
                exchangeInfo.to,
                exchangeInfo.from,
                contract.getCode(),
                msg.createdAt
            );

            var matchInternalExchangeInfo = MatchExchangeInfo {
                amount: msg.amount,
                priceRate: exchangeInfo.priceRate,
                slippage: exchangeInfo.slippage,
                feeInfo: storage.feeInfo!
            };

            var bodyInternalMatchOrder = InternalMatchOrder {
                anotherVault: storage.vault,
                anotherOrderOwner: storage.owner,
                matcher: in.senderAddress,
                matchExchangeInfo: matchInternalExchangeInfo.toCell(),
                createdAt: storage.createdAt,
            };

            storage.sendInternalMatchOrder(
                generatedOrder.calculateAddress(),
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
            var anotherOrder = generateOrder(
                msg.anotherVault,
                msg.anotherOrderOwner,
                exchangeInfo.to,
                exchangeInfo.from,
                contract.getCode(),
                msg.createdAt
            );
            assert(in.senderAddress == anotherOrder.calculateAddress()) throw ERR_INVALID_SENDER;

            var matchExchangeInfo = msg.matchExchangeInfo.load();
            var matchFeeInfo = matchExchangeInfo.feeInfo.load();
            var feeInfo = storage.feeInfo!.load();

            // Simplified fee rate calculations
            val matchRate = addFeesToRate(matchExchangeInfo.priceRate, matchFeeInfo);
            val myRate = addFeesToRate(exchangeInfo.priceRate, feeInfo);

            // Simplified slippage validation
            assert(
                (exchangeInfo.amount > 0) &&
                isWithinSlippage(matchRate, exchangeInfo.priceRate, exchangeInfo.slippage) &&
                isWithinSlippage(myRate, matchExchangeInfo.priceRate, matchExchangeInfo.slippage)
            ) throw ERR_INVALID_SLIPPAGE;

            var anotherGetAmount = mulDivFloor(matchExchangeInfo.amount, matchExchangeInfo.priceRate, ton("1"));
            if (anotherGetAmount > exchangeInfo.amount) {
                anotherGetAmount = exchangeInfo.amount;
            }
            var getAmount = mulDivFloor(anotherGetAmount, ton("1"), matchExchangeInfo.priceRate);

            if (anotherGetAmount == exchangeInfo.amount) {
                reserveToncoinsOnBalance(GAS_MIN_ORDER_STORAGE, 0);
            } else {
                reserveToncoinsOnBalance(GAS_STORAGE, 0);
            }

            storage.sendSuccessMatch(
                in.valueCoins / 2,
                in.senderAddress,
                matchExchangeInfo.amount,
                getAmount,
                msg.matcher,
                0,
            );

            storage.sendVaultTransferJetton(
                0,
                anotherGetAmount,
                exchangeInfo.to,
                msg.anotherOrderOwner,
                matchExchangeInfo.feeInfo,
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
            var anotherOrder = generateOrder(
                msg.anotherVault,
                msg.anotherOrderOwner,
                exchangeInfo.to,
                exchangeInfo.from,
                contract.getCode(),
                msg.anotherOrderCreatedAt
            );
            assert(in.senderAddress == anotherOrder.calculateAddress()) throw ERR_INVALID_SENDER;

            var matchExchangeInfo = msg.matchExchangeInfo.load();
            val increaseAmount = matchExchangeInfo.startAmount - matchExchangeInfo.amount;

            if ((increaseAmount == 0) && (exchangeInfo.amount == 0)) {
                reserveToncoinsOnBalance(GAS_MIN_ORDER_STORAGE, RESERVE_MODE_EXACT_AMOUNT);
            } else {
                reserveToncoinsOnBalance(GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);
            }

            storage.sendVaultTransferJetton(
                0,
                matchExchangeInfo.amount,
                exchangeInfo.to,
                msg.anotherOrderOwner,
                msg.feeInfo,
                msg.matcher,
                SEND_MODE_CARRY_ALL_BALANCE,
            );

            exchangeInfo.amount += increaseAmount;
            storage.exchangeInfo = exchangeInfo.toCell();
            storage.save();
            return;
        }

        CloseOrder => {
            assert(in.senderAddress == storage.owner) throw ERR_INVALID_SENDER;
            assert(in.valueCoins >= GAS_ORDER_CLOSE_ORDER) throw ERR_INSUFFICIENT_GAS;

            var exchangeInfo = storage.exchangeInfo.load();
            reserveToncoinsOnBalance(GAS_MIN_ORDER_STORAGE, RESERVE_MODE_EXACT_AMOUNT);

            storage.sendVaultCloseOrder(
                exchangeInfo.amount,
                0,
                exchangeInfo.to,
                SEND_MODE_CARRY_ALL_BALANCE,
            );

            exchangeInfo.amount = 0;
            storage.exchangeInfo = exchangeInfo.toCell();
            storage.save();
            return;
        }

        InitOrder => {
            assert(in.senderAddress == storage.vault) throw ERR_INVALID_SENDER;
            assert(in.valueCoins >= GAS_STORAGE) throw ERR_INSUFFICIENT_GAS;

            var exchangeInfo = storage.exchangeInfo.load();
            assert(exchangeInfo.amount == 0) throw ERR_ORDER_ALREADY_INITIALIZED;

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
    val richBounceMessage = lazy RichBounceBody.fromSlice(in.bouncedBody);
    var msg = lazy BouncedMessage.fromCell(richBounceMessage.originalBody);

    match (msg) {
        InternalMatchOrder => {
            var msgExchangeInfo = msg.matchExchangeInfo.load();
            var storageExchangeInfo = storage.exchangeInfo.load();
            storageExchangeInfo.amount += msgExchangeInfo.amount;
            storage.exchangeInfo = storageExchangeInfo.toCell();
            storage.save();

            var body = beginCell().storeUint(OP_CODE_RETURN_MATCHER_FAILED, 32).endCell();
            sendSimpleMessage(msg.matcher, 0, body, SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
            return;
        }
    }
    return;
}

get fun getData(): (address, address, cell, uint32) {
    var storage = lazy Storage.fromCell(contract.getData());
    return (storage.owner, storage.vault, storage.exchangeInfo, storage.createdAt);
}
