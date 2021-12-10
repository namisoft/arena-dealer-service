import {RedisAsyncClient} from "./common/redis-async-client";
import {container} from "tsyringe";

export class SecretDataStorage {
    private readonly redis: RedisAsyncClient;

    constructor(private randomizerAddress: string) {
        this.redis = container.resolve("RedisAsyncClient");
    }

    private readonly keyOf = (itemKey: string) => `Randomizer:${this.randomizerAddress}:${itemKey}`;

    private readonly lastScannedBlockKey = (scanner: string) => this.keyOf(`${scanner}:lastScannedBlock`);

    setLastScannedBlock(scanner: string, block: number) {
        return this.redis.set(this.lastScannedBlockKey(scanner), block.toString());
    }

    getLastScannedBlock(scanner: string): Promise<number | undefined> {
        return this.redis.get(this.lastScannedBlockKey(scanner)).then(v => Number(v))
    }

    private readonly submittedSecretsKey = this.keyOf("submittedSecrets");
    private readonly waitForRevealingKey = this.keyOf("waitForRevealing");

    saveSubmittedSecrets(secrets: { value: string, hash: string }[]) {
        const p: Promise<any>[] = [];
        for (const s of secrets) {
            p.push(this.redis.hset(this.submittedSecretsKey, s.hash, s.value));
        }
        return Promise.all(p)
    }

    removeSecrets(hashes: string[]) {
        const p: Promise<any>[] = [];
        for (const hash of hashes) {
            p.push(this.redis.hdel(this.submittedSecretsKey, hash));
        }
        return Promise.all(p);
    }

    existsSecret(hash: string): Promise<boolean> {
        return this.redis.hexists(this.submittedSecretsKey, hash);
    }

    getSecret(hash: string): Promise<string | undefined> {
        return this.redis.hget(this.submittedSecretsKey, hash)
    }

    saveWaitingSecret(info: { secretHash: string, secretIndex: number, block: number }) {
        // Save data with `block number` as sorting score
        return this.redis.zadd(this.waitForRevealingKey,
            info.block, `${info.secretIndex}:${info.secretHash}`
        );
    }

    removeWaitingSecret(secretInfo: { secretHash: string, secretIndex: number }) {
        return this.redis.zrem(this.waitForRevealingKey, `${secretInfo.secretIndex}:${secretInfo.secretHash}`);
    }

    // Get waiting secrets in block range [`fromBlock`, `toBlock`].
    // The return value is a Promise of an array of (secretHash, secretIndex) that sorted asc by secretIndex
    getWaitingSecretsInRange(blockRange: { min?: number, max?: number }):
        Promise<{ secretIndex: number, secretHash: string }[]> {
        const min = blockRange.min ? blockRange.min : "-inf";
        const max = blockRange.max ? blockRange.max : "+inf";
        return this.redis
            .zrangebyscore(this.waitForRevealingKey, min, max)
            .then(rs => {
                return rs
                    .map(v => {
                        const parts = v.split(":");
                        return {secretIndex: Number(parts[0]), secretHash: parts[1]}
                    })
                    .sort((a, b) => a.secretIndex - b.secretIndex)
            })
            .catch(_ => [])
    }
}