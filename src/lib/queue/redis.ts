import Redis from "ioredis";

// Use REDIS_URL from env or fallback to a default localhost for dev
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const redisOptions = {
    maxRetriesPerRequest: null,
    lazyConnect: true,
};

let redisConnection: Redis;

if (process.env.NODE_ENV === "production") {
    redisConnection = new Redis(REDIS_URL, redisOptions);
} else {
    // In development, avoid exhausting connection limits due to HMR
    if (!(global as any).redisConnection) {
        (global as any).redisConnection = new Redis(REDIS_URL, redisOptions);
    }
    redisConnection = (global as any).redisConnection;
}

export default redisConnection;
