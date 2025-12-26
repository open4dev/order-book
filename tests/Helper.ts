import { Address } from "@ton/core";
import { Blockchain, SendMessageResult } from "@ton/sandbox";
import { flattenTransaction } from "@ton/test-utils";
import { JettonWallet } from "../wrappers/JettonWallet";
import { Vault } from "../wrappers/Vault";
import { FeeCollector } from "../wrappers/MatcherFeeCollector";
import { Order } from "../wrappers/Order";


export const mapOpcode = (op: number): string | null => {
    switch (op) {
        case 0x178d4519:
            return 'JettonWalletInternalTransfer';
        case 0x2717c4a2:
            return 'VaultInit';
        case 0x2d0e1e1b:
            return 'OrderInit';
        case 0xfc7532f4:
            return 'FeeCollectorAddFee';
        case 0xec9a92f6:
            return 'FeeCollectorWithDraw';
        case 0x47ff7e25:
            return 'OrderMatchOrder';
        case 0xdfe29f63:
            return 'OrderInternalMatchOrder';
        case 0x52e80bac:
            return 'OrderCloseOrder';
        case 0x55feb42a:
            return 'OrderSuccessMatch';
        case 0x64e90480:
            return 'VaultFactoryCreateVault';
        case 0xb6cf7f0f:
            return 'VaultFactoryChangeOwner';
        case 0x81e36595:
            return 'VaultFactoryInit';
        case 0x12966c79:
            return 'VaultJettonTransfer';
        case 0x7362d09c:
            return 'VaultJettonTransferNotification';
        case 0xcbcd047e:
            return 'VaultTonTransfer';
        case 0xee83652a:
            return 'VaultWithDraw';
        case 0xecd3ad8e:
            return 'BounceRevertInternalMatchOrder';
        case 0xd53276db:
            return 'JettonWalletInternalTransferExcesses';
        case 0xf8a7ea5:
            return 'JettonWalletTransfer';
        default:
            return null;
    }
};


export function getJettonWalletWrapper(blockchain: Blockchain, trs: SendMessageResult, jettonMinter: Address)  {
    const jettonDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        return tx.op == 0x178d4519;
    });
    const jettonWallet = blockchain.openContract(JettonWallet.createFromAddress(flattenTransaction(jettonDeployTrs!).to!));
    
    return jettonWallet;
}

export function getVaultWrapper(blockchain: Blockchain, trs: SendMessageResult)  {
    const vaultDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        return tx.op == 0x2717c4a2;
    });
    const vault = blockchain.openContract(Vault.createFromAddress(flattenTransaction(vaultDeployTrs!).to!));
    
    return vault;
}

export function getFeeCollectorWrapper(blockchain: Blockchain, trs: SendMessageResult, vaultAddress: Address)  {
    const feeCollectorDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        // return (tx.op == 0xfc7532f4 && tx.from!.equals(vaultAddress));
        // return tx.from?.toRawString() == vaultAddress.toRawString();
        return (tx.op == 0xfc7532f4) && (tx.from?.equals(vaultAddress));
    });
    
    if (!feeCollectorDeployTrs) {
        throw new Error('FeeCollector deployment transaction not found');
    }
    
    const feeCollector = blockchain.openContract(FeeCollector.createFromAddress(flattenTransaction(feeCollectorDeployTrs).to!));
    
    return feeCollector;
}

export function getOrderWrapper(blockchain: Blockchain, trs: SendMessageResult, vaultAddress: Address)  {
    const orderDeployTrs = trs.transactions.find((e) => {
        const tx = flattenTransaction(e);
        return tx.op == 0x2d0e1e1b;
    });
    const order = blockchain.openContract(Order.createFromAddress(flattenTransaction(orderDeployTrs!).to!));
    
    return order;
}
