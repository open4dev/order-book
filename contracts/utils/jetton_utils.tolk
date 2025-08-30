fun sendJettonTransfer(queryId: uint64, jettonAmount: coins, to: address, destination: address, responseDestination: address?, forwardTonAmount: coins?, forwardPayload: cell?) {
    // transfer#0f8a7ea5 query_id:uint64 amount:(VarUInteger 16) destination:MsgAddress
    //  response_destination:MsgAddress custom_payload:(Maybe ^Cell)
    //  forward_ton_amount:(VarUInteger 16) forward_payload:(Either Cell ^Cell)
    //  = InternalMsgBody;
    var jettonTransferBody = beginCell()
    .storeUint(queryId, 64)
    .storeCoins(jettonAmount)
    .storeAddress(destination);

    var msg = createMessage({
        bounce: false,
        dest: to,
        value: ton("0.05"),
        body: jettonTransferBody
    });

    msg.send(SEND_MODE_REGULAR);
}