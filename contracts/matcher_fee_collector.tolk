import "utils/fees"

struct Storage {
    vault: address
    owner: address
    amount: coins
}

fun Storage.load() {
    return Storage.fromCell(contract.getData());
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
    var storage = Storage.load();

    var msg = AllowedMessage.fromSlice(in.body);

    match (msg) {
        WithDraw => {
            assert(in.senderAddress == storage.owner) throw 403; // Check if the sender is the owner
            assert(in.valueCoins >= GAS_JETTON_WALLET_TRANSFER) throw 422;

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

            msg.send(SEND_MODE_CARRY_ALL_BALANCE | SEND_MODE_DESTROY);

            return;
        }
        AddFee => {
            assert(in.senderAddress == storage.vault) throw 403; // Check if the sender is the owner
            storage.amount += msg.amount;
            storage.save();
            return;
        }
    }
}
