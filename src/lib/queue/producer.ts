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
    marketplace: "trendyol" | "n11" | "hepsiburada" | "idefix" | "pazarama" | "pttavm" | "ciceksepeti";
    type: "products" | "prices" | "stocks" | "status"; // status: pazaryerinde satışa aç/kapat
    productIds?: string[]; // If empty, sync all applicable
}

export async function addMarketplaceSyncJob(data: SyncJobData) {
    const jobName = `sync-${data.marketplace}-${data.type}-${Date.now()}`;
    const queue = getQueue();
    // ePttAVM aynı anda gelen istekleri bir süre reddediyor; 15 sn içinde biten 3 deneme yetmiyor ve güncelleme kayboluyordu.
    // Bu yüzden ePttAVM işleri 1-2-4-8-16 dk arayla tekrar denenir.
    const options = data.marketplace === "pttavm"
        ? { ...DEFAULT_JOB_OPTIONS, attempts: 6, backoff: { type: "exponential", delay: 60000 } }
        : DEFAULT_JOB_OPTIONS;
    const job = await queue.add(jobName, data, options);
    return job;
}
