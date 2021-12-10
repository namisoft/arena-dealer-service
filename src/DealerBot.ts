import {container} from "tsyringe";
import Web3 from "web3";
import {BaseResult} from "./common/base-result";
import {SequentialTaskQueue} from "sequential-task-queue";
import {PenguinRandomizer} from "./contracts/PenguinRandomizer";
import {to32BytesHex} from "./common/utils";

export class DealerBot {
    private _address: string;
    private readonly _randomizer: PenguinRandomizer;
    private readonly _taskQueue = new SequentialTaskQueue();

    public get address() {
        return this._address;
    }

    constructor(private privateKey: string, private defaultGasLimit: number) {
        this._setAccount(privateKey);
        this._randomizer = PenguinRandomizer.getInstance();
        this._randomizer.setDefaultAccount(this._address);
        this._randomizer.setDefaultGasLimit(defaultGasLimit)
    }

    commit = (hashes: string[]) => new Promise<boolean>(resolve => {
        this._taskQueue.push(() => {
            return this._randomizer
                .commit(hashes)
                .then(r => {
                    if (r.success) {
                        const secretCommittedEvents = r.receipt.events["SecretHashCommitted"];
                        let numOfEvents = 1;
                        if (secretCommittedEvents instanceof Array) {
                            numOfEvents = secretCommittedEvents.length;
                        }
                        console.log(`Commit secret hashes success: number of hashes = ${numOfEvents}`);
                    } else {
                        const reason = r.receipt ? "tx processing failed" : "tx sending failed"
                        console.error(`Commit secret hashes failed: ${reason}`);
                    }
                    return r.success;
                })
                .catch(e => {
                    console.error(`Commit secret hashes exception: ${e.toString()}`);
                    return false;
                });
        }).then(v => resolve(v), _ => resolve(false))
    })

    reveal = (hash: string, secret: string) =>
        new Promise<BaseResult<string, { txProcessingError?: boolean, txSendingError?: boolean }>>(resolve => {
            this._taskQueue.push(() => {
                return this._randomizer
                    .reveal(hash, secret)
                    .then(r => {
                        if (r.success) {
                            // Tx success
                            console.log(`Reveal secret ${hash} success: tx=${r.receipt.transactionHash}`);
                            return {data: r.receipt.transactionHash}
                        } else if (r.receipt) {
                            // Tx processing failed
                            console.error(`Reveal secret ${hash} failed in tx processing: tx=${r.receipt.transactionHash}`);
                            return {error: {txProcessingError: true}}
                        } else {
                            // Tx sending failed
                            console.error(`Reveal secret ${hash} failed in tx sending`);
                            return {error: {txSendingError: true}}
                        }
                    })
                    .catch(err => {
                        console.error(`Reveal secret ${hash} failed with exception: ${err.toString()}`);
                        return {error: {txSendingError: true}}
                    })
            }).then(r => resolve(r))
        })

    getControlState(): Promise<{ requestCounter: number, totalUsableHashes: number}> {
        return this._randomizer.controlState();
    }

    isRevealedSecret(hash: string) {
        return this._randomizer.revealedSecrets(hash).then(r => r !== to32BytesHex(0))
    }

    readSecretHashAssigned(fromBlock: number, toBlock: number) {
        return this._randomizer.pastEvents
            .secretHashAssigned(fromBlock, toBlock)
            .then(v => {
                return {data: v}
            })
            .catch(e => {
                return {error: e.toString()}
            })
    }

    private _setAccount(privateKey: string) {
        const web3: Web3 = container.resolve("Web3");
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        this._address = account.address;
        web3.eth.accounts.wallet.add(privateKey);
    }
}