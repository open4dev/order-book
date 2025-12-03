import "utils/fees"

struct Storage {
    vault: address
    owner: address
    amount: coins
}

fun Storage.save(mutate self) {
    contract.setData(self.toCell())
}

struct (0xec9a92f6) WithDraw {}

struct (0xfc7532f4) AddFee {
    amount: coins
}

type AllowedMessage = WithDraw | AddFee


fun onInternalMessage(in: InMessage) {
    var storage = lazy Storage.fromCell(contract.getData());

    var msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        WithDraw => {
            assert(in.valueCoins >= GAS_JETTON_WALLET_TRANSFER) throw 422;
            assert(in.senderAddress == storage.owner) throw 403; // Check if the sender is the owner

            var msg = createMessage({
                bounce: false,
                dest: storage.vault,
                value: 0,
                body: beginCell()
                    .storeUint(0xee83652a, 32)
                    .storeAddress(storage.owner)
                    .storeCoins(storage.amount)
                .endCell()
            });

            msg.send(SEND_MODE_CARRY_ALL_BALANCE);

            storage.amount = 0;
            storage.save();
            return;
        }
        AddFee => {
            assert(in.valueCoins >= GAS_MATCHER_FEE_COLLECTOR_ADD_FEE) throw 422;
            assert(in.senderAddress == storage.vault) throw 403; // Check if the sender is the owner
            storage.amount += msg.amount;
            storage.save();
            return;
        }
    }
}

get fun getData() {
    var storage = lazy Storage.fromCell(contract.getData());
    return (storage.vault, storage.owner, storage.amount);
}