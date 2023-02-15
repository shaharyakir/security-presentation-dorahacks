import { Blockchain, OpenedContract } from '@ton-community/sandbox'; // TODO PR such that this comes from ton-core
import { Cell, toNano, beginCell } from 'ton-core';
import { ReplayAttack } from '../wrappers/ReplayAttack';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';

import { KeyPair, mnemonicNew, mnemonicToPrivateKey, sign } from 'ton-crypto';
import { randomAddress } from '@ton-community/test-utils';

export async function randomKeyPair() {
    let mnemonics = await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

describe('ReplayAttack', () => {
    let code: Cell;
    let replayAttack: OpenedContract<ReplayAttack>;
    let kp: KeyPair;
    let blockchain: Blockchain;

    beforeAll(async () => {
        code = await compile('ReplayAttack');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        kp = await randomKeyPair();
        replayAttack = blockchain.openContract(
            ReplayAttack.createFromConfig({ publicKey: kp.publicKey }, code)
        );
        const deployer = await blockchain.treasury('deployer');
        const deployResult = await replayAttack.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: replayAttack.address,
            deploy: true,
        });
    });

    it('fails on wrong signature', async () => {
        const myCell = beginCell().storeUint(1, 1).endCell();

        const kp = await randomKeyPair();

        await expect(
            replayAttack.sendMsg({
                msgToSend: myCell,
                signFunc: (buf) => sign(buf, kp.secretKey),
                amount: toNano('0.02'),
                address: randomAddress(),
                seqno: 0,
            })
        ).rejects.toThrow();
    });

    it('signs', async () => {
        const myCell = beginCell().storeUint(1, 1).endCell();

        const toAddress = randomAddress();

        await replayAttack.sendMsg({
            msgToSend: myCell,
            signFunc: (buf) => sign(buf, kp.secretKey),
            amount: toNano('0.02'),
            address: toAddress,
            seqno: 0,
        });
    });

    it('replays', async () => {
        const myCell = beginCell().storeUint(1, 1).endCell();

        let firstSig: Buffer;

        const toAddress = randomAddress();

        const res = await replayAttack.sendMsg({
            msgToSend: myCell,
            signFunc: (buf) => {
                firstSig = sign(buf, kp.secretKey);
                return firstSig;
            },
            amount: toNano('0.02'),
            address: toAddress,
            seqno: 0,
        });

        await expect(
            replayAttack.sendMsg({
                msgToSend: myCell,
                signFunc: (buf) => {
                    return firstSig;
                },
                amount: toNano('0.02'),
                address: toAddress,
                seqno: 0,
            })
        ).rejects.toThrow();
    });
});
