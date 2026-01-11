import "utils/types.tolk"
import "utils/errors.tolk"
import "utils/op_codes.tolk"
import "utils/fees.tolk"
import "utils/fee_calc.tolk"
import "utils/messages.tolk"
import "utils/generate_addresses.tolk"

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

struct JettonTransferNotificationPayload {
    priceRate: coins
    toJetton: Cell<JettonInfo>?
    slippage: uint30
    feeInfo: Cell<FeeInfo>
}

struct ( 0x12966c79 ) VaultJettonTransfer {
    addresses: Cell<TransferAddresses>
    toJetton: Cell<JettonInfo>?
    amountTransfer: coins
    createdAtOrder: uint32
    feeInfo: Cell<FeeInfo>
}

struct ( 0x7362d09c ) JettonTransferNotification {
    query_id: uint64
    amount: coins
    sender: address
    forward_payload: Cell<JettonTransferNotificationPayload>?
}

struct ( 0x2717c4a2 ) InitVault {}

struct ( 0xcbcd047e ) TonTransfer {
    amount: coins,
    toJetton: Cell<JettonInfo>
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
    toJetton: Cell<JettonInfo>?
    amountTransfer: coins
    createdAtOrder: uint32
}

type AllowedMessage = VaultJettonTransfer | JettonTransferNotification | InitVault | TonTransfer | WithDraw | CloseOrder

fun Storage.save(self) {
    contract.setData(self.toCell())
}

// Vault2 specific: Different jetton wallet data layout
fun calculateJettonWallet(jettonWalletCode: cell, jettonMaster: address, owner: address): AutoDeployAddress {
    var jettonWalletData: cell = beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(jettonMaster)
        .storeRef(jettonWalletCode)
    .endCell();

    return AutoDeployAddress {
        stateInit: {
            code: jettonWalletCode,
            data: jettonWalletData
        }
    };
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

    var msg = createMessage({
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
    msg.send(sendMode);
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
            assert(generatedOrder.calculateAddress() == in.senderAddress) throw ERR_INVALID_SENDER;

            val feeInfo = msg.feeInfo.load();
            val fees = calculateFees(msg.amountTransfer, feeInfo);

            if (storage.fromJetton != null) {
                var jettonWallet = calculateJettonWallet(
                    codesInfo.jettonWalletCode!,
                    storage.fromJetton!.load().jettonMinter,
                    contract.getAddress()
                );

                reserveToncoinsOnBalance(GAS_STORAGE, 0);

                if (fees.matcherFee > 0) {
                    sendFeeToCollector(contract.getAddress(), addresses.matcher, fees.matcherFee, codesInfo.feeCollectorCode, GAS_FEE_COLLECTOR_ADD_FEE, SEND_MODE_PAY_FEES_SEPARATELY);
                }
                if (fees.providerFee > 0) {
                    sendFeeToCollector(contract.getAddress(), feeInfo.provider, fees.providerFee, codesInfo.feeCollectorCode, GAS_FEE_COLLECTOR_ADD_FEE, SEND_MODE_PAY_FEES_SEPARATELY);
                }

                sendJettonTransfer(0, jettonWallet, fees.transferAmount, addresses.counterparty, addresses.matcher, 0, SEND_MODE_CARRY_ALL_BALANCE);
            } else {
                var bodyRevert = beginCell().storeUint(OP_CODE_WITHDRAW_REVERT, 32).endCell();
                var bodySwap = beginCell().storeUint(OP_CODE_SWAP, 32).endCell();

                reserveToncoinsOnBalance(storage.amount - fees.transferAmount + GAS_STORAGE, 0);

                if (fees.matcherFee > 0) {
                    sendFeeToCollector(contract.getAddress(), addresses.matcher, fees.matcherFee, codesInfo.feeCollectorCode, GAS_FEE_COLLECTOR_ADD_FEE, SEND_MODE_PAY_FEES_SEPARATELY);
                }
                if (fees.providerFee > 0) {
                    sendFeeToCollector(contract.getAddress(), feeInfo.provider, fees.providerFee, codesInfo.feeCollectorCode, GAS_FEE_COLLECTOR_ADD_FEE, SEND_MODE_PAY_FEES_SEPARATELY);
                }

                sendSimpleMessage(addresses.counterparty, fees.transferAmount, bodySwap, SEND_MODE_PAY_FEES_SEPARATELY);
                sendSimpleMessage(addresses.matcher, 0, bodyRevert, SEND_MODE_CARRY_ALL_BALANCE);
            }

            storage.amount -= fees.transferAmount;
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
            assert(generatedOrder.calculateAddress() == in.senderAddress) throw ERR_INVALID_SENDER;

            var transferAmount = msg.amountTransfer;

            if (storage.fromJetton != null) {
                var jettonWallet = calculateJettonWallet(
                    codesInfo.jettonWalletCode!,
                    storage.fromJetton!.load().jettonMinter,
                    contract.getAddress()
                );

                reserveToncoinsOnBalance(GAS_STORAGE, 0);
                sendJettonTransfer(0, jettonWallet, transferAmount, msg.orderOwner, msg.orderOwner, 0, SEND_MODE_CARRY_ALL_BALANCE);
            } else {
                var body = beginCell().storeUint(OP_CODE_SWAP, 32).endCell();
                reserveToncoinsOnBalance(storage.amount - transferAmount + GAS_STORAGE, 0);
                sendSimpleMessage(msg.orderOwner, transferAmount, body, SEND_MODE_CARRY_ALL_BALANCE);
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
            assert(generatedJettonWallet.calculateAddress() == in.senderAddress) throw ERR_INVALID_JETTON_WALLET;

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
            assert(feeCollector.calculateAddress() == in.senderAddress) throw ERR_INVALID_SENDER;

            if (storage.fromJetton == null) {
                reserveToncoinsOnBalance(storage.amount - msg.amount + GAS_STORAGE, 0);
                val body = beginCell().storeUint(OP_CODE_VAULT_WITHDRAW_TON, 32).endCell();
                sendSimpleMessage(msg.feeAddress, 0, body, SEND_MODE_CARRY_ALL_BALANCE);
            } else {
                reserveToncoinsOnBalance(GAS_STORAGE, 0);
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

get fun getData() {
    var storage = lazy Storage.fromCell(contract.getData());
    return (storage.fromJetton, storage.randomHash, storage.vault_factory, storage.amount)
}

get fun getCodes() {
    var storage = lazy Storage.fromCell(contract.getData());
    val codesInfo = storage.codesInfo.load();
    return (codesInfo.jettonWalletCode, codesInfo.orderCode, codesInfo.feeCollectorCode)
}
