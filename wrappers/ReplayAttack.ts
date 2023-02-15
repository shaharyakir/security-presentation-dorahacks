import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    internal,
    Sender,
    SendMode,
    storeMessageRelaxed,
} from 'ton-core';

export type ReplayAttackConfig = {
    publicKey: Buffer;
};

export function replayAttackConfigToCell(config: ReplayAttackConfig): Cell {
    return beginCell().storeUint(0, 32).storeBuffer(config.publicKey).endCell();
}

export class ReplayAttack implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new ReplayAttack(address);
    }

    static createFromConfig(config: ReplayAttackConfig, code: Cell, workchain = 0) {
        const data = replayAttackConfigToCell(config);
        const init = { code, data };
        return new ReplayAttack(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATLY,
            body: beginCell().endCell(),
        });
    }

    async getSeqno(provider: ContractProvider) {
        return (await provider.get('seqno', [])).stack.readNumber();
    }

    async sendMsg(
        provider: ContractProvider,
        params: {
            msgToSend: Cell;
            address: Address;
            amount: bigint;
            signFunc: (buf: Buffer) => Buffer;
            seqno: number;
        }
    ) {
        const msg = internal({
            to: params.address,
            value: params.amount,
            body: params.msgToSend,
        });

        const cellToSign = beginCell()
            .storeUint(params.seqno, 32)
            .storeRef(beginCell().store(storeMessageRelaxed(msg)).endCell())
            .endCell();

        const sig = params.signFunc(cellToSign.hash());

        await provider.external(
            beginCell().storeBuffer(sig).storeSlice(cellToSign.asSlice()).endCell()
        );
    }
}
