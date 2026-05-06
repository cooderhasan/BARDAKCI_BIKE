import { Worker, Job, Queue } from "bullmq";
import redisConnection from "./redis";
import { QUEUE_NAMES } from "./config";
import { SyncJobData } from "./producer";
import { syncProductsToTrendyol, syncOrdersFromTrendyol } from "@/app/admin/(protected)/integrations/trendyol/actions";
import { syncProductsToN11 } from "@/app/admin/(protected)/integrations/n11/actions";

let workerInstance: Worker<SyncJobData> | null = null;

export async function setupRepeatableJobs() {
    const queue = new Queue(QUEUE_NAMES.MARKETPLACE_SYNC, { connection: redisConnection });
    
    // Her 15 dakikada bir Trendyol siparişlerini çek ve güncelle
    await queue.add("trendyol-order-sync", {}, {
        repeat: {
            pattern: '*/15 * * * *' // Every 15 minutes
        },
        jobId: 'trendyol-order-sync-cron' // Unique ID to prevent duplicates
    });

    console.log("⏰ Trendyol Order Sync Cron (15m) registered.");
}

export function initializeWorker() {
    if (workerInstance) {
        console.log("Worker is already initialized.");
        return;
    }

    workerInstance = new Worker<SyncJobData>(
        QUEUE_NAMES.MARKETPLACE_SYNC,
        async (job: Job<SyncJobData>) => {
            console.log(`🚀 İşleniyor: [${job.id}] ${job.name}`);
            
            try {
                // Cron Jobs
                if (job.name === "trendyol-order-sync") {
                    console.log("🔄 Otomatik Trendyol Sipariş Senkronizasyonu başlatıldı...");
                    const result = await syncOrdersFromTrendyol();
                    console.log(`✅ Cron Sonucu: ${result.message}`);
                    return;
                }

                // Manual Product Sync Jobs
                if (job.data.marketplace === "trendyol") {
                    const { syncProductsToTrendyol } = await import("@/app/admin/(protected)/integrations/trendyol/actions");
                    const result = await syncProductsToTrendyol(job.data.productIds, job.data.type);
                    if (!result.success) throw new Error(result.message);
                    console.log(`✅ Tamamlandı: Trendyol Sync - ${result.message}`);
                } else if (job.data.marketplace === "n11") {
                    const result = await syncProductsToN11(job.data.productIds);
                    if (!result.success) throw new Error(result.message);
                    console.log(`✅ Tamamlandı: N11 Sync - ${result.message}`);
                } else if (job.data.marketplace === "hepsiburada") {
                    const { syncProductsToHepsiburada } = await import("@/app/admin/(protected)/integrations/hepsiburada/actions");
                    const result = await syncProductsToHepsiburada(job.data.productIds);
                    if (!result.success) throw new Error(result.message);
                    console.log(`✅ Tamamlandı: Hepsiburada Sync - ${result.message}`);
                }
                
                await job.updateProgress(100);
            } catch (error: any) {
                console.error(`❌ Hata [${job.id}]:`, error.message);
                throw error;
            }
        },
        {
            connection: redisConnection,
            concurrency: 1,
            limiter: {
                max: 1,
                duration: 2000,
            }
        }
    );

    workerInstance.on("completed", (job) => {
        console.log(`🎉 Görev Başarılı: ${job.id}`);
    });

    workerInstance.on("failed", (job, err) => {
        console.error(`⚠️ Görev Başarısız: ${job?.id} - Hata: ${err.message}`);
    });

    console.log("👷‍♂️ Marketplace Sync Worker başlatıldı.");
    
    // Setup crons
    setupRepeatableJobs().catch(console.error);
}
