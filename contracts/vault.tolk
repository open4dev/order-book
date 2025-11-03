import "utils/generate_addresses"
import "utils/fees"
import "utils/jetton_utils"
import "utils/op"

struct ComissionInfo {
    comissionNum: uint14
    comissionDenom: uint14
    feeAmount: coins
}

struct MatcherFeeInfo {
    comissionNum: uint14
    comissionDenom: uint14
}

struct JettonInfo {
    jettonMinter: address
}

struct CodesInfo {
    jettonWalletCode: cell?
    orderCode: cell
    matcherFeeCollectorCode: cell
}

struct Storage {
    vault_factory: address
    codesInfo: Cell<CodesInfo>
    fromJetton: Cell<JettonInfo>?
    randomHash: uint256
    amount: uint128
    comissionInfo: Cell<ComissionInfo>?
    comissionInfoMatcher: Cell<MatcherFeeInfo>?
}


struct ToJettonInfo {
    jettonMinter: address
}

struct ( 0x12966c79 ) VaultJettonTransfer {
    orderOwner: address
    matcher: address
    toJetton: Cell<ToJettonInfo>?
    amount: coins
    createdAt: uint32
    destination: address
    closedFlag: bool
}


struct JettonTransferNotificationPayload {
    priceRate: coins
    toJetton: Cell<ToJettonInfo>?
    slippage: uint30
}

struct ( 0x7362d09c ) JettonTransferNotification {
    query_id: uint64
    amount: coins
    sender: address
    forward_payload: Cell<JettonTransferNotificationPayload>?
}

struct ( 0x2717c4a2 ) InitVault {
    comissionInfo: Cell<ComissionInfo>
    comissionInfoMatcher: Cell<MatcherFeeInfo>
}

struct ( 0xec9a92f6 ) WithDraw {
    feeAddress: address
}

struct ( 0xcbcd047e ) TonTransfer {
    amount: coins,
    toJetton: Cell<ToJettonInfo>
    priceRate: coins
    slippage: uint30
}

struct (0xee83652a) WithDrawMatcher {
    matcher: address
    amount: coins
}

type AllowedMessage = VaultJettonTransfer | JettonTransferNotification | InitVault | WithDraw | TonTransfer | WithDrawMatcher

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
    var storage = lazy Storage.fromCell(contract.getData());

    var msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        WithDraw => {
            assert(in.senderAddress == storage.vault_factory) throw 403;
            assert(in.valueCoins >= GAS_VAULT_WITHDRAW) throw 422;
            var comissionInfo = storage.comissionInfo!.load();
            assert(comissionInfo.feeAmount > 0) throw 423;
            if (storage.fromJetton == null) {
                reserveToncoinsOnBalance(GAS_STORAGE + storage.amount, 0);
                var msgSendTokens = createMessage({
                    bounce: false,
                    dest: msg.feeAddress,
                    value: comissionInfo.feeAmount,
                    body: beginCell()
                        .storeUint(0xec9a92f6, 32)
                    .endCell(),
                });
                msgSendTokens.send(SEND_MODE_CARRY_ALL_BALANCE);
            } else {
                reserveToncoinsOnBalance(GAS_STORAGE, 0);
                var delta = contract.getOriginalBalance() - GAS_STORAGE - GAS_VAULT_WITHDRAW;
                if (delta < 0) {
                    delta = 0;
                }
                var codesInfo = storage.codesInfo.load();
                var jettonWallet = calculateJettonWallet(
                    codesInfo.jettonWalletCode!,
                    storage.fromJetton!.load().jettonMinter,
                    contract.getAddress()
                );

                sendJettonTransfer(
                    0,
                    jettonWallet,
                    comissionInfo.feeAmount,
                    msg.feeAddress,
                    msg.feeAddress,
                    0,
                    SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE
                );
            }
            comissionInfo.feeAmount = 0;
            storage.comissionInfo = comissionInfo.toCell();
            storage.save();
            return;
        }
        VaultJettonTransfer => {
            assert(in.valueCoins >= GAS_VAULT_JETTON_TRANSFER + GAS_JETTON_WALLET_TRANSFER) throw 422;
            val codesInfo = storage.codesInfo.load();
            var generatedOrder = generateOrder(
                contract.getAddress(),
                msg.orderOwner,
                storage.fromJetton,
                msg.toJetton,
                codesInfo.orderCode,
                msg.createdAt
            );
            var generatedOrderAddress = address.fromValidBuilder(generatedOrder.buildAddress());
            assert(generatedOrderAddress == in.senderAddress) throw 403;
            var comissionInfo = storage.comissionInfo!.load();
            var matcherFeeInfo = storage.comissionInfoMatcher!.load();

            var transferAmount = msg.amount;
            var matcherFeeAmount = 0;

            if (msg.closedFlag == false) {
                var feeAmount = mulDivFloor(msg.amount, comissionInfo.comissionNum, comissionInfo.comissionDenom);
                transferAmount -= feeAmount;
                comissionInfo.feeAmount += feeAmount;
                matcherFeeAmount = mulDivFloor(msg.amount, matcherFeeInfo.comissionNum, matcherFeeInfo.comissionDenom);
                transferAmount -= matcherFeeAmount;
                storage.comissionInfo = comissionInfo.toCell();
            }

            if (storage.fromJetton != null) {
                val codesInfo = storage.codesInfo.load();
                var jettonWallet = calculateJettonWallet(
                    codesInfo.jettonWalletCode!,
                    storage.fromJetton!.load().jettonMinter,
                    contract.getAddress()
                );
                reserveToncoinsOnBalance(0, 4);

                var sendModeTransfer = SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE;
                if (matcherFeeAmount > 0) {
                    sendModeTransfer = SEND_MODE_CARRY_ALL_BALANCE;
                    sendAddMatcherFee(msg.matcher, matcherFeeAmount, codesInfo.matcherFeeCollectorCode!, GAS_MATCHER_FEE_COLLECTOR_ADD_FEE, SEND_MODE_REGULAR);
                }
                sendJettonTransfer(
                    0,
                    jettonWallet,
                    transferAmount,
                    msg.destination,
                    msg.matcher,
                    0,
                    sendModeTransfer
                );
            } else {
                var bodyRevert = beginCell()
                    .storeUint(0xec9a92f6, 32)
                .endCell();

                var body = beginCell().storeUint(OP_EXCHANGE, 32).endCell();

                reserveToncoinsOnBalance(transferAmount + in.valueCoins, 1);

                simpleMessage(msg.destination, transferAmount, body, SEND_MODE_REGULAR);

                if (matcherFeeAmount > 0) {
                    sendAddMatcherFee(msg.matcher, matcherFeeAmount, codesInfo.matcherFeeCollectorCode!, GAS_MATCHER_FEE_COLLECTOR_ADD_FEE, SEND_MODE_REGULAR);
                }

                simpleMessage(msg.matcher, 0, bodyRevert, SEND_MODE_CARRY_ALL_BALANCE);
            }
            storage.amount -= msg.amount;
            storage.save();
            return;
        }
        JettonTransferNotification => {
            reserveToncoinsOnBalance(GAS_STORAGE + storage.comissionInfo!.load().feeAmount, 0);
            assert(in.valueCoins >= GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_JETTON_NOTIFICATION) throw 422;
            val codesInfo = storage.codesInfo.load();
            var generatedJettonWallet = calculateJettonWallet(codesInfo.jettonWalletCode!, storage.fromJetton!.load().jettonMinter, contract.getAddress());
            val generatedJettonWalletAddress: address = address.fromValidBuilder(generatedJettonWallet.buildAddress());
            assert(generatedJettonWalletAddress == in.senderAddress) throw 429;
            assert(storage.fromJetton != null) throw 428;
            assert(msg.forward_payload != null) throw 427;
            storage.amount += msg.amount;
            var forwardPayload = msg.forward_payload!.load();
            storage.sendCreateOrder(storage.fromJetton, forwardPayload.toJetton, msg.sender, msg.amount, forwardPayload.priceRate, forwardPayload.slippage, 0, SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
            storage.save();
            return;
        }
        TonTransfer => {
            assert(in.valueCoins >= msg.amount + GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_TON_TRANSFER) throw 422;
            reserveToncoinsOnBalance(GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_TON_TRANSFER, 1);
            assert(storage.fromJetton == null) throw 403;
            storage.amount += msg.amount;
            storage.sendCreateOrder(null, msg.toJetton, in.senderAddress, msg.amount, msg.priceRate, msg.slippage, 0, SEND_MODE_CARRY_ALL_BALANCE);
            storage.save();
            return;
        }
        InitVault => {
            assert(in.senderAddress == storage.vault_factory) throw 422;
            assert(in.valueCoins >= GAS_VAULT_INIT + GAS_STORAGE) throw 422;
            storage.comissionInfo = msg.comissionInfo;
            storage.comissionInfoMatcher = msg.comissionInfoMatcher;
            storage.save();
            return;
        }
        WithDrawMatcher => {
            assert(in.valueCoins >= GAS_VAULT_WITHDRAW) throw 422;
            var codesInfo = storage.codesInfo.load();
            var matcherFeeCollector = generateMatcherFeeCollector(contract.getAddress(), msg.matcher, codesInfo.matcherFeeCollectorCode);
            var matcherFeeCollectorAddress = address.fromValidBuilder(matcherFeeCollector.buildAddress());
            assert(matcherFeeCollectorAddress == in.senderAddress) throw 403;
            if (storage.fromJetton == null) {
                val body = beginCell()
                    .storeUint(0xee83652a, 32)
                .endCell();
                simpleMessage(msg.matcher, msg.amount, body, SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
            } else {
                val codesInfo = storage.codesInfo.load();
                val jettonWallet = calculateJettonWallet(
                    codesInfo.jettonWalletCode!,
                    storage.fromJetton!.load().jettonMinter,
                    contract.getAddress()
                );
                sendJettonTransfer(0, jettonWallet, msg.amount, msg.matcher, msg.matcher, 0, SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
            }
            return;
        }
    }
}


fun Storage.sendCreateOrder(mutate self, fromJetton: cell?, toJetton: cell?, owner: address, amount: coins, priceRate: coins, slippage: uint30, value: coins, sendMode: int) {
    var order: AutoDeployAddress = generateOrder(
        contract.getAddress(),
        owner,
        fromJetton,
        toJetton,
        self.codesInfo.load().orderCode,
        blockchain.now()
    );


    var msgCreateOrder = createMessage({
        bounce: false,
        dest: order,
        value: value,
        body: beginCell()
            .storeUint(0x2d0e1e1b, 32)
            .storeCoins(amount)
            .storeCoins(priceRate)
            .storeUint(slippage, 30)
        .endCell()
    });

    msgCreateOrder.send(sendMode);
}


fun sendAddMatcherFee(matcher: address, matcherFeeAmount: coins, matcherFeeCollectorCode: cell, value: coins, sendMode: int) {
    var matcherFeeContract: AutoDeployAddress = generateMatcherFeeCollector(contract.getAddress(), matcher, matcherFeeCollectorCode);
    var msgAddMatcherFee = createMessage({
        bounce: false,
        dest: matcherFeeContract,
        value: value,
        body: beginCell()
            .storeUint(0xfc7532f4, 32)
            .storeCoins(matcherFeeAmount)
        .endCell()
    });

    msgAddMatcherFee.send(sendMode);
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


fun calculateJettonWallet(jettonWalletCode: cell, jettonMaster: address, owner: address): AutoDeployAddress {
    var jettonWalletData: cell = beginCell()
        .storeUint(0, 4)
        .storeCoins(0)
        .storeAddress(owner)
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

    return (storage.amount, storage.fromJetton, storage.randomHash, storage.vault_factory)
}


get fun getCodes() {
    var storage = Storage.parse(contract.getData());
    val codesInfo = storage.codesInfo.load();

    return (codesInfo.jettonWalletCode, codesInfo.orderCode, codesInfo.matcherFeeCollectorCode)
}