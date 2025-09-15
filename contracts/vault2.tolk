import "utils/generate_addresses"
import "utils/fees"
import "utils/jetton_utils"


struct ComissionInfo {
    comissionNum: uint14
    comissionDenom: uint14
    feeAmount: coins
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
    // jettonWalletCode: cell?
    fromJetton: Cell<JettonInfo>?
    randomHash: uint256
    amount: uint128
    // orderCode: cell
    comissionInfo: Cell<ComissionInfo>?
}


struct ToJettonInfo {
    jettonMinter: address
}

struct ( 0x12966c79 ) VaultJettonTransfer {
    orderOwner: address
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
}

struct ( 0xec9a92f6 ) WithDraw {
    feeAdress: address
}

struct ( 0xcbcd047e ) TonTransfer {
    amount: coins,
    toJetton: Cell<ToJettonInfo>
    priceRate: coins
    slippage: uint30
}

type AllowedMessage = VaultJettonTransfer | JettonTransferNotification | InitVault | WithDraw | TonTransfer

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
        WithDraw => {
            // reserveToncoinsOnBalance(GAS_STORAGE, SEND_MODE_REGULAR);
            assert(in.valueCoins >= GAS_VAULT_WITHDRAW) throw 422;
            var comissionInfo = storage.comissionInfo!.load();
            assert(comissionInfo.feeAmount > 0) throw 423;
            if (storage.fromJetton == null) {
                // var delta = contract.getOriginalBalance() - GAS_STORAGE - comissionInfo.feeAmount - GAS_VAULT_WITHDRAW;
                // if (delta < 0) {
                //     delta = 0;
                // }
                var msgSendTokens = createMessage({
                    bounce: false,
                    dest: msg.feeAdress,
                    // value: comissionInfo.feeAmount + delta,
                    value: comissionInfo.feeAmount,
                    body: beginCell()
                        .storeUint(0xec9a92f6, 32)
                    .endCell(),
                });
                msgSendTokens.send(SEND_MODE_PAY_FEES_SEPARATELY);
            } else {
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
                    msg.feeAdress,
                    msg.feeAdress,
                    // delta
                    0
                );
            }
            comissionInfo.feeAmount = 0;
            storage.comissionInfo = comissionInfo.toCell();
            storage.save();
            return;
        }
        VaultJettonTransfer => {
            // reserveToncoinsOnBalance(GAS_STORAGE + storage.comissionInfo!.load().feeAmount, SEND_MODE_REGULAR);
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

            

            var transferAmount = msg.amount;

            if (msg.closedFlag == false) {
                var feeAmount = mulDivFloor(msg.amount, comissionInfo.comissionNum, comissionInfo.comissionDenom);
                transferAmount -= feeAmount;
                comissionInfo.feeAmount += feeAmount;
            }
            var msgSendTokens: OutMessage? = null;

            if (storage.fromJetton != null) {
                val codesInfo = storage.codesInfo.load();
                var jettonWallet = calculateJettonWallet(
                    codesInfo.jettonWalletCode!,
                    storage.fromJetton!.load().jettonMinter,
                    contract.getAddress()
                );
                sendJettonTransfer(
                    0,
                    jettonWallet,
                    transferAmount,
                    msg.orderOwner,
                    msg.orderOwner,
                    0
                );
            } else {
                msgSendTokens = createMessage({
                    bounce: false,
                    dest: msg.destination,
                    value: transferAmount,
                    body: beginCell()
                        .storeUint(0xec9a92f6, 32)
                    .endCell(),
                });
                msgSendTokens.send(SEND_MODE_PAY_FEES_SEPARATELY);
            }


            storage.amount -= msg.amount;
            storage.comissionInfo = comissionInfo.toCell();
            storage.save();
            return;
        }
        JettonTransferNotification => {
            // reserveToncoinsOnBalance(GAS_STORAGE + storage.comissionInfo!.load().feeAmount, SEND_MODE_REGULAR);
            assert(in.valueCoins >= GAS_VAULT_JETTON_NOTIFICATION + GAS_ORDER_INIT + GAS_STORAGE + GAS_ORDER_INTERNAL_MATCH0 + GAS_ORDER_INTERNAL_MATCH1 + GAS_JETTON_WALLET_TRANSFER) throw 422;
            val codesInfo = storage.codesInfo.load();
            var generatedJettonWallet = calculateJettonWallet(codesInfo.jettonWalletCode!, storage.fromJetton!.load().jettonMinter, contract.getAddress());
            val generatedJettonWalletAddress: address = address.fromValidBuilder(generatedJettonWallet.buildAddress());
            assert(generatedJettonWalletAddress == in.senderAddress) throw 403;
            assert(storage.fromJetton != null) throw 403;
            assert(msg.forward_payload != null) throw 403;
            storage.amount += msg.amount;
            var forwardPayload = msg.forward_payload!.load();
            storage.sendCreateOrder(storage.fromJetton, forwardPayload.toJetton, msg.sender, msg.amount, forwardPayload.priceRate, forwardPayload.slippage);
            storage.save();
            return;
        }
        TonTransfer => {
            // reserveToncoinsOnBalance(GAS_STORAGE + storage.comissionInfo!.load().feeAmount, SEND_MODE_REGULAR);
            assert(in.valueCoins >= GAS_VAULT_JETTON_NOTIFICATION + GAS_ORDER_INIT + GAS_STORAGE + GAS_ORDER_INTERNAL_MATCH0 + GAS_ORDER_INTERNAL_MATCH1 + GAS_JETTON_WALLET_TRANSFER) throw 422;
            assert(storage.fromJetton == null) throw 403;
            storage.amount += msg.amount;
            storage.sendCreateOrder(null, msg.toJetton, in.senderAddress, msg.amount, msg.priceRate, msg.slippage);
            storage.save();
            return;
        }
        InitVault => {
            assert(in.senderAddress == storage.vault_factory) throw 422;
            assert(in.valueCoins >= GAS_VAULT_INIT + GAS_STORAGE) throw 422;
            storage.comissionInfo = msg.comissionInfo;
            storage.save();
            return;
        }
    }
}


fun Storage.sendCreateOrder(mutate self, fromJetton: cell?, toJetton: cell?, owner: address, amount: coins, priceRate: coins, slippage: uint30) {
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
        value: GAS_ORDER_INIT + GAS_STORAGE + GAS_ORDER_INTERNAL_MATCH0 + GAS_ORDER_INTERNAL_MATCH1 + GAS_JETTON_WALLET_TRANSFER,
        body: beginCell()
            .storeUint(0x2d0e1e1b, 32)
            .storeCoins(amount)
            .storeCoins(priceRate)
            .storeUint(slippage, 30)
        .endCell()
    });

    msgCreateOrder.send(SEND_MODE_PAY_FEES_SEPARATELY);
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