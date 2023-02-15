import { toNano } from 'ton-core';
import { ReplayAttack } from '../wrappers/ReplayAttack';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    const replayAttack = ReplayAttack.createFromConfig({}, await compile('ReplayAttack'));

    await provider.deploy(replayAttack, toNano('0.05'));

    const openedContract = provider.open(replayAttack);

    // run methods on `openedContract`
}
