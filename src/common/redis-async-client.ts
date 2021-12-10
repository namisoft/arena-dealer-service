import {inject, singleton} from "tsyringe";
import redis = require("redis");

/**
 * Created by IntelliJ IDEA.
 * Author: @cryptoz
 * Date: 10/24/2021
 * Time: 10:10 AM
 */
const promisify = require('util').promisify;

export interface RedisClientConfig extends redis.ClientOpts {

}

@singleton()
export class RedisAsyncClient {
    private readonly client: redis.RedisClient;
    private readonly getAsync: (_: string) => Promise<string | undefined>;
    private readonly hexistsAsync: (key: string, field: string) => Promise<boolean>;
    private readonly hgetAsync: (key: string, field: string) => Promise<string | undefined>;
    private readonly hgetallAsync: (key: string) => Promise<{ [key: string]: string } | undefined>;
    private readonly hkeysAsync: (key: string) => Promise<string[] | undefined>;
    private readonly hsetAsync: (key: string, field: string, value: string) => Promise<number>;
    private readonly hdelAsync: (key: string, field: string) => Promise<number>;
    private readonly smembersAsync: (key: string) => Promise<string[] | undefined>;
    private readonly existsAsync: (key: string) => Promise<boolean>;
    private readonly setAsync: (key: string, value: string) => Promise<"OK" | undefined>;
    private readonly zaddAsync: (key: string, score: number, member: string) => Promise<boolean>;
    private readonly zrangebyscoreAsync: (key: string, min: number | string, max: number | string) => Promise<string[]>;
    private readonly zrevrangebyscoreAsync: (key: string, min: number | string, max: number | string) => Promise<string[]>;
    private readonly zremAsync: (key: string, member: string) => Promise<boolean>;

    constructor(private redisConfig: RedisClientConfig) {
        this.client = redis.createClient(redisConfig);
        this.client.on('error', err => {
            console.log(`Redis connection error: ${err}`);
        });

        this.getAsync = promisify(this.client.get).bind(this.client);
        this.hexistsAsync = promisify(this.client.hexists).bind(this.client);
        this.hgetAsync = promisify(this.client.hget).bind(this.client);
        this.hgetallAsync = promisify(this.client.hgetall).bind(this.client);
        this.hkeysAsync = promisify(this.client.hkeys).bind(this.client);
        this.hsetAsync = promisify(this.client.hset).bind(this.client);
        this.hdelAsync = promisify(this.client.hdel).bind(this.client);
        this.smembersAsync = promisify(this.client.smembers).bind(this.client);
        this.existsAsync = promisify(this.client.exists).bind(this.client);
        this.setAsync = promisify(this.client.set).bind(this.client);
        this.zaddAsync = promisify(this.client.zadd).bind(this.client);
        this.zrangebyscoreAsync = promisify(this.client.zrangebyscore).bind(this.client);
        this.zrevrangebyscoreAsync = promisify(this.client.zrevrangebyscore).bind(this.client);
        this.zremAsync = promisify(this.client.zrem).bind(this.client);
    }

    get underlying() {
        return this.client;
    }

    get get() {
        return this.getAsync;
    }

    get hexists() {
        return this.hexistsAsync;
    }

    get hget() {
        return this.hgetAsync;
    }

    get hgetall() {
        return this.hgetallAsync;
    }

    get hkeys() {
        return this.hkeysAsync;
    }

    get hset() {
        return this.hsetAsync;
    }

    get hdel() {
        return this.hdelAsync;
    }

    get smembers() {
        return this.smembersAsync;
    }

    get exists() {
        return this.existsAsync;
    }

    set(key: string, value: string) {
        return this.setAsync(key, value).then(r => r === "OK");
    }

    get zadd() {
        return this.zaddAsync;
    }

    get zrangebyscore() {
        return this.zrangebyscoreAsync;
    }

    get zrevrangebyscore() {
        return this.zrevrangebyscoreAsync;
    }

    get zrem() {
        return this.zremAsync;
    }
}
