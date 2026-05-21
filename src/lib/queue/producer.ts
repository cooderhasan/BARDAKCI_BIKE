import { Queue } from "bullmq";
import redisConnection from "./redis";
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from "./config";

export const marketplaceSyncQueue = new Queue(QUEUE_NAMES.MARKETPLACE_SYNC, {
    connection: redisConnection,
});

export interface SyncJobData {
    marketplace: "trendyol" | "n11" | "hepsiburada";
    type: "products" | "prices" | "stocks";
    productIds?: string[]; // If empty, sync all applicable
}

export async function addMarketplaceSyncJob(data: SyncJobData) {
    const jobName = `sync-${data.marketplace}-${data.type}-${Date.now()}`;
    const job = await marketplaceSyncQueue.add(jobName, data, DEFAULT_JOB_OPTIONS);
    return job;
}
