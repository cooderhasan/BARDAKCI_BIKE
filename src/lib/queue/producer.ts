import { Queue } from "bullmq";
import redisConnection from "./redis";
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from "./config";

let marketplaceSyncQueue: Queue | null = null;

function getQueue() {
    if (!marketplaceSyncQueue) {
        marketplaceSyncQueue = new Queue(QUEUE_NAMES.MARKETPLACE_SYNC, {
            connection: redisConnection,
        });
    }
    return marketplaceSyncQueue;
}

export interface SyncJobData {
    marketplace: "trendyol" | "n11" | "hepsiburada";
    type: "products" | "prices" | "stocks";
    productIds?: string[]; // If empty, sync all applicable
}

export async function addMarketplaceSyncJob(data: SyncJobData) {
    const jobName = `sync-${data.marketplace}-${data.type}-${Date.now()}`;
    const queue = getQueue();
    const job = await queue.add(jobName, data, DEFAULT_JOB_OPTIONS);
    return job;
}
