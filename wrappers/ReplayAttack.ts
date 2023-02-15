import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    external,
} from 'ton-core';

export type ReplayAttackConfig = {
    publicKey: Buffer;
};

export function replayAttackConfigToCell(config: ReplayAttackConfig): Cell {
    return beginCell().storeBuffer(config.publicKey).endCell();
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

    async sendMsg(
        provider: ContractProvider,
        params: {
            msgToSend: Cell;
            address: Address;
            amount: bigint;
            signFunc: (buf: Buffer) => Buffer;
        }
    ) {
        const cellToSign = beginCell()
            .storeRef(
                beginCell()
                    .storeUint(0x10, 16) // TODO explain
                    .storeAddress(params.address)
                    .storeCoins(params.amount)
                    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1) // TODO explain
                    .storeRef(params.msgToSend)
                    .endCell()
            )
            .endCell();

        const sig = params.signFunc(cellToSign.hash());

        await provider.external(
            beginCell().storeBuffer(sig).storeSlice(cellToSign.asSlice()).endCell()
        );
    }
}
