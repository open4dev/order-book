import "op_codes.tolk"

fun sendJettonTransfer(queryId: uint64, fromJettonWallet: AutoDeployAddress, jettonAmount: coins, to: address, responseDestination: address, value: coins, sendMode: int) {
    // transfer#0f8a7ea5 query_id:uint64 amount:(VarUInteger 16) destination:MsgAddress
    //  response_destination:MsgAddress custom_payload:(Maybe ^Cell)
    //  forward_ton_amount:(VarUInteger 16) forward_payload:(Either Cell ^Cell)
    //  = InternalMsgBody;
    var msgSendTokens = createMessage({
        bounce: BounceMode.NoBounce,
        dest: fromJettonWallet,
        value: value,
        body: beginCell()
            .storeUint(OP_CODE_JETTON_TRANSFER, 32).storeUint(queryId, 64) // op: transfer
            .storeCoins(jettonAmount)
            .storeAddress(to)
            .storeAddress(responseDestination)
            .storeUint(0, 2)
            .storeCoins(0)
            .storeUint(0, 1)
    });

    msgSendTokens.send(sendMode);
}
