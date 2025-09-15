import { Address, toNano } from '@ton/core';
import { VaultFactory } from '../wrappers/VaultFactory';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { JettonWallet, jettonWalletCodeCell } from '../wrappers/JettonWallet';
import { Vault } from '../wrappers/Vault';
import { Order } from '../wrappers/Order';

// jetton minter from kQBz3lxXqAPk3kTkQGvK8LF3EJ9-cBlbZcbffdYBrECuJYxJ
// jetton wallet from kQDC3gHQEgdmIdxXgJWAwRRTmcIwS0DWvvosPFu9c6_KH0ql
// vault from 0QCcamEepPcBnfczp0I2oUO214_5DuRm4ilWvgo7GmNYgq7p

// jetton minter to kQDegHRHZdro9SYipDnQ41pji9HSJteoYBRS8lfpMzHGUjhg
// jetton wallet to kQAj82m-kX_I8c0BKHOXW_FxM_qY55mALmSQ3eLRhyRX00Ws
// vault to 0QASeOhar42-kOaN9ir6EaOJaobHq47OfgyHDKUpGDASig9e

export async function run(provider: NetworkProvider) {
    const order = provider.open(Order.createFromAddress(Address.parse("0QC1LtnZci7d76QTkdemx4XuGQPAPflat0f-71fQLR8Gz7QY")));

    // 1. закидывать на матч 1 тон, что бы если фейк, то отдаем сумму обратно матчеру + матчер платит всю комиссию
    // 2. vault деплоит комиссия матчерам при VaultJettonTransfer на vault

    await order.sendMatchOrder(
        provider.sender(),
        toNano(0.005),
        {
            anotherVault: Address.parse("kQCcamEepPcBnfczp0I2oUO214_5DuRm4ilWvgo7GmNYgvMs"),
            anotherOrderOwner: provider.sender().address!,
            anotherOrder: Address.parse("0QBAEbwLRuEBF9FanKZdjeUbKvU0bLQAknCiJDTR8gyUN43G"),
            createdAt: Number(0x68bec445),
        }
    )
}
