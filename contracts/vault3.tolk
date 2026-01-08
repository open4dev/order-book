import "utils/generate_addresses"
import "utils/fees"
import "utils/jetton_utils"
import "utils/errors.tolk"
import "utils/op_codes.tolk"

struct JettonInfo {
    jettonMinter: address
}

struct CodesInfo {
    jettonWalletCode: cell?
    orderCode: cell
    feeCollectorCode: cell
}

struct Storage {
    vault_factory: address
    codesInfo: Cell<CodesInfo>
    fromJetton: Cell<JettonInfo>?
    randomHash: uint256
    amount: coins
}

struct ToJettonInfo {
    jettonMinter: address
}

struct VaultJettonTransferAddresses {
    orderOwner: address
    matcher: address
    anotherOwnerOrder: address
}

struct ( 0x12966c79 ) VaultJettonTransfer {
    addresses: Cell<VaultJettonTransferAddresses>
    toJetton: Cell<ToJettonInfo>?
    amountTransfer: coins
    createdAtOrder: uint32
    feeInfo: Cell<FeeInfo>
}

struct FeeInfo {
    provider: address
    feeNum: uint14
    feeDenom: uint14
    matcherFeeNum: uint14
    matcherFeeDenom: uint14
}

struct JettonTransferNotificationPayload {
    priceRate: coins
    toJetton: Cell<ToJettonInfo>?
    slippage: uint30
    feeInfo: Cell<FeeInfo>
}

struct ( 0x7362d09c ) JettonTransferNotification {
    query_id: uint64
    amount: coins
    sender: address
    forward_payload: Cell<JettonTransferNotificationPayload>?
}

struct ( 0x2717c4a2 ) InitVault {
}

struct ( 0xcbcd047e ) TonTransfer {
    amount: coins,
    toJetton: Cell<ToJettonInfo>
    priceRate: coins
    slippage: uint30
    feeInfo: Cell<FeeInfo>
}

struct (0xee83652a) WithDraw {
    feeAddress: address
    amount: coins
}

struct ( 0xa597947e ) CloseOrder {
    orderOwner: address
    toJetton: Cell<ToJettonInfo>?
    amountTransfer: coins
    createdAtOrder: uint32
}

type AllowedMessage = VaultJettonTransfer | JettonTransferNotification | InitVault | TonTransfer | WithDraw | CloseOrder

fun Storage.save(self) {
    contract.setData(self.toCell())
}

fun onInternalMessage(in: InMessage) {
    var storage = lazy Storage.fromCell(contract.getData());

    var msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        VaultJettonTransfer => {
            assert(in.valueCoins >= GAS_VAULT_JETTON_TRANSFER + GAS_JETTON_WALLET_TRANSFER) throw ERR_INSUFFICIENT_GAS;
            val codesInfo = storage.codesInfo.load();
            var addresses = msg.addresses.load();
            var generatedOrder = generateOrder(
                contract.getAddress(),
                addresses.orderOwner,
                storage.fromJetton,
                msg.toJetton,
                codesInfo.orderCode,
                msg.createdAtOrder
            );
            var generatedOrderAddress = generatedOrder.calculateAddress();
            assert(generatedOrderAddress == in.senderAddress) throw ERR_INVALID_SENDER;
            val feeInfo = msg.feeInfo.load();
            var transferAmount = msg.amountTransfer;
            var matcherFeeAmount = 0;
            var feeAmount = 0;

            if ((feeInfo.feeNum > 0) && (feeInfo.feeDenom > 0)) {
                feeAmount = mulDivFloor(msg.amountTransfer, feeInfo.feeNum, feeInfo.feeDenom);
                transferAmount -= feeAmount;
            }
            if ((feeInfo.matcherFeeNum > 0) && (feeInfo.matcherFeeDenom > 0)) {
                matcherFeeAmount = mulDivFloor(msg.amountTransfer, feeInfo.matcherFeeNum, feeInfo.matcherFeeDenom);
                transferAmount -= matcherFeeAmount;
            }

            if (storage.fromJetton != null) {
                val codesInfo = storage.codesInfo.load();
                var jettonWallet = calculateJettonWallet(
                    codesInfo.jettonWalletCode!,
                    storage.fromJetton!.load().jettonMinter,
                    contract.getAddress()
                );

                reserveToncoinsOnBalance(GAS_STORAGE, 0);

                if (matcherFeeAmount > 0) {
                    sendAddMatcherFee(addresses.matcher, matcherFeeAmount, codesInfo.feeCollectorCode!, GAS_FEE_COLLECTOR_ADD_FEE, SEND_MODE_PAY_FEES_SEPARATELY);
                }
                if (feeAmount > 0) {
                    sendAddMatcherFee(feeInfo.provider, feeAmount, codesInfo.feeCollectorCode!, GAS_FEE_COLLECTOR_ADD_FEE, SEND_MODE_PAY_FEES_SEPARATELY);
                }

                sendJettonTransfer(
                    0,
                    jettonWallet,
                    transferAmount,
                    addresses.anotherOwnerOrder,
                    addresses.matcher,
                    0,
                    SEND_MODE_CARRY_ALL_BALANCE
                );
            } else {
                var bodyRevertToMatcher = beginCell()
                    .storeUint(OP_CODE_WITHDRAW_REVERT, 32)
                .endCell();

                var bodySwap = beginCell()
                    .storeUint(OP_CODE_SWAP, 32)
                .endCell();

                reserveToncoinsOnBalance(storage.amount - transferAmount + GAS_STORAGE, 0);
                if (matcherFeeAmount > 0) {
                    sendAddMatcherFee(addresses.matcher, matcherFeeAmount, codesInfo.feeCollectorCode!, GAS_FEE_COLLECTOR_ADD_FEE, SEND_MODE_PAY_FEES_SEPARATELY);
                }
                if (feeAmount > 0) {
                    sendAddMatcherFee(feeInfo.provider, feeAmount, codesInfo.feeCollectorCode!, GAS_FEE_COLLECTOR_ADD_FEE, SEND_MODE_PAY_FEES_SEPARATELY);
                }
                simpleMessage(addresses.anotherOwnerOrder, transferAmount, bodySwap, SEND_MODE_PAY_FEES_SEPARATELY);
                simpleMessage(addresses.matcher, 0, bodyRevertToMatcher, SEND_MODE_CARRY_ALL_BALANCE);
            }
            storage.amount -= transferAmount;
            storage.save();
            return;
        }
        CloseOrder => {
            assert(in.valueCoins >= GAS_ORDER_CLOSE_ORDER - GAS_ORDER_CLOSE_ORDER_FEE) throw ERR_INSUFFICIENT_GAS;
            val codesInfo = storage.codesInfo.load();
            var generatedOrder = generateOrder(
                contract.getAddress(),
                msg.orderOwner,
                storage.fromJetton,
                msg.toJetton,
                codesInfo.orderCode,
                msg.createdAtOrder
            );
            var generatedOrderAddress = generatedOrder.calculateAddress();
            assert(generatedOrderAddress == in.senderAddress) throw ERR_INVALID_SENDER;
            var transferAmount = msg.amountTransfer;

            if (storage.fromJetton != null) {
                val codesInfo = storage.codesInfo.load();
                var jettonWallet = calculateJettonWallet(
                    codesInfo.jettonWalletCode!,
                    storage.fromJetton!.load().jettonMinter,
                    contract.getAddress()
                );

                reserveToncoinsOnBalance(GAS_STORAGE, 0);

                sendJettonTransfer(
                    0,
                    jettonWallet,
                    transferAmount,
                    msg.orderOwner,
                    msg.orderOwner,
                    0,
                    SEND_MODE_CARRY_ALL_BALANCE
                );
            } else {
                var body = beginCell().storeUint(OP_CODE_SWAP, 32).endCell();

                reserveToncoinsOnBalance(storage.amount - transferAmount + GAS_STORAGE, 0);
                simpleMessage(msg.orderOwner, transferAmount, body, SEND_MODE_CARRY_ALL_BALANCE);
            }
            storage.amount -= transferAmount;
            storage.save();
            return;
        }
        JettonTransferNotification => {
            assert(in.valueCoins >= GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_OUT_FORWARD_FEE + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_COMPUTE_FEE) throw ERR_INSUFFICIENT_GAS;
            assert(storage.fromJetton != null) throw ERR_FROM_JETTON_REQUIRED;
            assert(msg.forward_payload != null) throw ERR_FORWARD_PAYLOAD_REQUIRED;
            val codesInfo = storage.codesInfo.load();
            reserveToncoinsOnBalance(GAS_STORAGE, 0);
            var generatedJettonWallet = calculateJettonWallet(codesInfo.jettonWalletCode!, storage.fromJetton!.load().jettonMinter, contract.getAddress());
            val generatedJettonWalletAddress: address = generatedJettonWallet.calculateAddress();
            assert(generatedJettonWalletAddress == in.senderAddress) throw ERR_INVALID_JETTON_WALLET;
            var forwardPayload = msg.forward_payload!.load();
            storage.sendCreateOrder(storage.fromJetton, forwardPayload.toJetton, msg.sender, msg.amount, forwardPayload.priceRate, forwardPayload.slippage, forwardPayload.feeInfo, 0, SEND_MODE_CARRY_ALL_BALANCE);
            storage.amount += msg.amount;
            storage.save();
            return;
        }
        TonTransfer => {
            assert(storage.fromJetton == null) throw ERR_VAULT_ALREADY_HAS_JETTON;
            assert(in.valueCoins >= msg.amount + GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_TON_TRANSFER) throw ERR_INSUFFICIENT_GAS;
            reserveToncoinsOnBalance(storage.amount + msg.amount + GAS_STORAGE, 0);
            storage.sendCreateOrder(null, msg.toJetton, in.senderAddress, msg.amount, msg.priceRate, msg.slippage, msg.feeInfo, 0, SEND_MODE_CARRY_ALL_BALANCE);
            storage.amount += msg.amount;
            storage.save();
            return;
        }
        InitVault => {
            assert(in.senderAddress == storage.vault_factory) throw ERR_INVALID_SENDER;
            assert(in.valueCoins >= GAS_VAULT_INIT + GAS_STORAGE) throw ERR_INSUFFICIENT_GAS;
            return;
        }
        WithDraw => {
            assert(in.valueCoins >= GAS_VAULT_WITHDRAW) throw ERR_INSUFFICIENT_GAS;
            var codesInfo = storage.codesInfo.load();
            var feeCollector = generateFeeCollector(contract.getAddress(), msg.feeAddress, codesInfo.feeCollectorCode);
            var feeCollectorAddress = feeCollector.calculateAddress();
            assert(feeCollectorAddress == in.senderAddress) throw ERR_INVALID_SENDER;
            if (storage.fromJetton == null) {
                reserveToncoinsOnBalance(storage.amount - msg.amount + GAS_STORAGE, 0);
                val body = beginCell()
                    .storeUint(OP_CODE_VAULT_WITHDRAW_TON, 32)
                .endCell();
                simpleMessage(msg.feeAddress, 0, body, SEND_MODE_CARRY_ALL_BALANCE);
            } else {
                reserveToncoinsOnBalance(GAS_STORAGE, 0);
                val codesInfo = storage.codesInfo.load();
                val jettonWallet = calculateJettonWallet(
                    codesInfo.jettonWalletCode!,
                    storage.fromJetton!.load().jettonMinter,
                    contract.getAddress()
                );
                sendJettonTransfer(0, jettonWallet, msg.amount, msg.feeAddress, msg.feeAddress, 0, SEND_MODE_CARRY_ALL_BALANCE);
            }
            storage.amount -= msg.amount;
            storage.save();
            return;
        }
    }
}


fun Storage.sendCreateOrder(mutate self, fromJetton: cell?, toJetton: cell?, owner: address, amount: coins, priceRate: coins, slippage: uint30, feeInfo: Cell<FeeInfo>, value: coins, sendMode: int) {
    var order: AutoDeployAddress = generateOrder(
        contract.getAddress(),
        owner,
        fromJetton,
        toJetton,
        self.codesInfo.load().orderCode,
        blockchain.now()
    );


    var msgCreateOrder = createMessage({
        bounce: BounceMode.NoBounce,
        dest: order,
        value: value,
        body: beginCell()
            .storeUint(OP_CODE_INIT_ORDER, 32)
            .storeCoins(amount)
            .storeCoins(priceRate)
            .storeUint(slippage, 30)
            .storeRef(feeInfo)
        .endCell()
    });

    msgCreateOrder.send(sendMode);
}


fun sendAddMatcherFee(matcher: address, matcherFeeAmount: coins, feeCollectorCode: cell, value: coins, sendMode: int) {
    var matcherFeeContract: AutoDeployAddress = generateFeeCollector(contract.getAddress(), matcher, feeCollectorCode);
    var msgAddMatcherFee = createMessage({
        bounce: BounceMode.NoBounce,
        dest: matcherFeeContract,
        value: value,
        body: beginCell()
            .storeUint(OP_CODE_ADD_FEE, 32)
            .storeCoins(matcherFeeAmount)
        .endCell()
    });

    msgAddMatcherFee.send(sendMode);
}

fun simpleMessage(dest: address, value: coins, body: cell, sendMode: int) {
    var msg = createMessage({
        bounce: BounceMode.NoBounce,
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

    //    return begin_cell()
    // .store_uint(0, 2) ;; 0b00 - No split_depth; No special
    // .store_maybe_ref(jetton_wallet_code)
    // .store_maybe_ref(
    //     pack_jetton_wallet_data(
    //         0, ;; status
    //         0, ;; balance
    //         owner_address,
    //         jetton_master_address)
    // )
    // .store_uint(0, 1) ;; Empty libraries
    // .end_cell();

    // https://tonviewer.com/EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT?section=code

    var stateInitCell = beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(jettonWalletData)
        .storeUint(0, 1)
    .endCell();

    var jettonWallet = AutoDeployAddress {
        stateInit: stateInitCell
    };

    return jettonWallet;
}


get fun getData() {
    var storage = lazy Storage.fromCell(contract.getData());

    return (storage.fromJetton, storage.randomHash, storage.vault_factory, storage.amount)
}


get fun getCodes() {
    var storage = lazy Storage.fromCell(contract.getData());
    val codesInfo = storage.codesInfo.load();

    return (codesInfo.jettonWalletCode, codesInfo.orderCode, codesInfo.feeCollectorCode)
}