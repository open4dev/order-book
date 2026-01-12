import "utils/generate_addresses.tolk"
import "utils/fees.tolk"
import "utils/errors.tolk"
import "utils/op_codes.tolk"
import "utils/types.tolk"
import "utils/messages.tolk"
import "utils/fee_calc.tolk"

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
    createdAt: uint32
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

struct ( 0x2717c4a2 ) InitVault {
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

fun Storage.save(self) {
    contract.setData(self.toCell())
}

fun Storage.sendCreateOrder(mutate self, fromJetton: cell, toJetton: cell?, owner: address, amount: coins, priceRate: coins, slippage: uint30, feeInfo: Cell<FeeInfo>, value: coins, createdAt: uint32, sendMode: int) {
    var order: AutoDeployAddress = generateOrder(
        contract.getAddress(),
        owner,
        fromJetton,
        toJetton,
        self.codesInfo.load().orderCode,
        createdAt
    );

    var body = beginCell()
        .storeUint(OP_CODE_INIT_ORDER, 32)
        .storeCoins(amount)
        .storeCoins(priceRate)
        .storeUint(slippage, 30)
        .storeRef(feeInfo)
    .endCell();

    sendSimpleMessageToAutoDeploy(order, value, body, sendMode);
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

type AllowedMessage = VaultJettonTransfer | JettonTransferNotification | InitVault | WithDraw | CloseOrder

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
                storage.fromJetton!,
                msg.toJetton,
                codesInfo.orderCode,
                msg.createdAtOrder
            );
            assert(generatedOrder.calculateAddress() == in.senderAddress) throw ERR_INVALID_SENDER;
            
            val feeInfo = msg.feeInfo.load();
            val fees = calculateFees(msg.amountTransfer, feeInfo);
            
            var jettonWallet = calculateJettonWallet(
                codesInfo.jettonWalletCode!,
                storage.fromJetton!.load().jettonMinter,
                contract.getAddress()
            );

            reserveToncoinsOnBalance(GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);

            if (fees.matcherFee > 0) {
                sendFeeToCollector(contract.getAddress(), addresses.matcher, fees.matcherFee, codesInfo.feeCollectorCode, GAS_FEE_COLLECTOR_ADD_FEE, SEND_MODE_PAY_FEES_SEPARATELY);
            }
            if (fees.providerFee > 0) {
                sendFeeToProvider(contract.getAddress(), feeInfo.provider, fees.providerFee, codesInfo.feeCollectorCode, GAS_FEE_COLLECTOR_ADD_FEE, SEND_MODE_PAY_FEES_SEPARATELY);
            }

            sendJettonTransfer(
                0,
                jettonWallet,
                fees.transferAmount,
                addresses.counterparty,
                addresses.matcher,
                0,
                SEND_MODE_CARRY_ALL_BALANCE
            );
            storage.amount -= fees.transferAmount;
            storage.save();
            return;
        }
        CloseOrder => {
            assert(in.valueCoins >= GAS_VAULT_CLOSE_ORDER) throw ERR_INSUFFICIENT_GAS;
            val codesInfo = storage.codesInfo.load();
            var generatedOrder = generateOrder(
                contract.getAddress(),
                msg.orderOwner,
                storage.fromJetton!,
                msg.toJetton,
                codesInfo.orderCode,
                msg.createdAtOrder
            );
            assert(generatedOrder.calculateAddress() == in.senderAddress) throw ERR_INVALID_SENDER;
            
            var jettonWallet = calculateJettonWallet(
                codesInfo.jettonWalletCode!,
                storage.fromJetton!.load().jettonMinter,
                contract.getAddress()
            );

            reserveToncoinsOnBalance(GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);

            sendJettonTransfer(
                0,
                jettonWallet,
                msg.amountTransfer,
                msg.orderOwner,
                msg.orderOwner,
                0,
                SEND_MODE_CARRY_ALL_BALANCE
            );
            storage.amount -= msg.amountTransfer;
            storage.save();
            return;
        }
        JettonTransferNotification => {
            val codesInfo = storage.codesInfo.load();
            var generatedJettonWallet = calculateJettonWallet(codesInfo.jettonWalletCode!, storage.fromJetton!.load().jettonMinter, contract.getAddress());

            assert(generatedJettonWallet.calculateAddress() == in.senderAddress) throw ERR_INVALID_JETTON_WALLET;

            if (
                (in.valueCoins < GAS_STORAGE + GAS_ORDER_INIT + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_OUT_FORWARD_FEE + GAS_VAULT_JETTON_TRANSFER_NOTIFICATION_COMPUTE_FEE)
                ||
                (msg.forward_payload == null)
                ) {
                sendJettonTransfer(0, generatedJettonWallet, msg.amount, msg.sender, msg.sender, 0, SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
                return;
            }

            reserveToncoinsOnBalance(GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);


            var forwardPayload = msg.forward_payload!.load();

            
            storage.sendCreateOrder(
                storage.fromJetton!, 
                forwardPayload.toJetton, 
                msg.sender, 
                msg.amount, 
                forwardPayload.priceRate, 
                forwardPayload.slippage, 
                forwardPayload.feeInfo, 
                0, 
                forwardPayload.createdAt, 
                SEND_MODE_CARRY_ALL_BALANCE
            );
            storage.amount += msg.amount;
            storage.save();
            return;
        }
        InitVault => {
            assert(in.senderAddress == storage.vault_factory) throw ERR_INVALID_SENDER;
            assert(in.valueCoins >= GAS_STORAGE + GAS_VAULT_INIT) throw ERR_INSUFFICIENT_GAS;
            return;
        }
        WithDraw => {
            assert(in.valueCoins >= GAS_VAULT_WITHDRAW) throw ERR_INSUFFICIENT_GAS;
            val codesInfo = storage.codesInfo.load();
            var feeCollector = generateFeeCollector(contract.getAddress(), msg.feeAddress, codesInfo.feeCollectorCode);
            assert(feeCollector.calculateAddress() == in.senderAddress) throw ERR_INVALID_SENDER;
            
            reserveToncoinsOnBalance(GAS_STORAGE, RESERVE_MODE_EXACT_AMOUNT);
            val jettonWallet = calculateJettonWallet(
                codesInfo.jettonWalletCode!,
                storage.fromJetton!.load().jettonMinter,
                contract.getAddress()
            );
            sendJettonTransfer(0, jettonWallet, msg.amount, msg.feeAddress, msg.feeAddress, 0, SEND_MODE_CARRY_ALL_BALANCE);
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
