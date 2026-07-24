import { Worker, Job, Queue } from "bullmq";
import redisConnection from "./redis";
import { QUEUE_NAMES } from "./config";
import { SyncJobData } from "./producer";
import { prisma } from "@/lib/db";
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

    // Her 15 dakikada bir Hepsiburada siparişlerini çek
    await queue.add("hepsiburada-order-sync", {}, {
        repeat: {
            pattern: '*/15 * * * *' // Every 15 minutes
        },
        jobId: 'hepsiburada-order-sync-cron'
    });
    console.log("⏰ Hepsiburada Order Sync Cron (15m) registered.");

    // Her 15 dakikada bir N11 siparişlerini çek
    await queue.add("n11-order-sync", {}, {
        repeat: {
            pattern: '*/15 * * * *' // Every 15 minutes
        },
        jobId: 'n11-order-sync-cron'
    });
    console.log("⏰ N11 Order Sync Cron (15m) registered.");

    // Her 15 dakikada bir Idefix siparişlerini çek
    await queue.add("idefix-order-sync", {}, {
        repeat: {
            pattern: '*/15 * * * *' // Every 15 minutes
        },
        jobId: 'idefix-order-sync-cron'
    });
    console.log("⏰ Idefix Order Sync Cron (15m) registered.");

    // Her 15 dakikada bir Pazarama siparişlerini çek
    await queue.add("pazarama-order-sync", {}, {
        repeat: {
            pattern: '*/15 * * * *' // Every 15 minutes
        },
        jobId: 'pazarama-order-sync-cron'
    });
    console.log("⏰ Pazarama Order Sync Cron (15m) registered.");
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

                if (job.name === "hepsiburada-order-sync") {
                    console.log("🔄 Otomatik Hepsiburada Sipariş Senkronizasyonu başlatıldı...");
                    const { syncOrdersFromHepsiburada } = await import("@/app/admin/(protected)/integrations/hepsiburada/actions");
                    const result = await syncOrdersFromHepsiburada();
                    console.log(`✅ Cron Sonucu: ${result.message}`);
                    return;
                }

                if (job.name === "n11-order-sync") {
                    console.log("🔄 Otomatik N11 Sipariş Senkronizasyonu başlatıldı...");
                    const { syncOrdersFromN11 } = await import("@/app/admin/(protected)/integrations/n11/actions");
                    const result = await syncOrdersFromN11();
                    console.log(`✅ Cron Sonucu: ${result.message}`);
                    return;
                }

                if (job.name === "idefix-order-sync") {
                    console.log("🔄 Otomatik Idefix Sipariş Senkronizasyonu başlatıldı...");
                    const { syncOrdersFromIdefix } = await import("@/app/admin/(protected)/integrations/idefix/actions");
                    const result = await syncOrdersFromIdefix();
                    console.log(`✅ Cron Sonucu: ${result.message}`);
                    return;
                }

                if (job.name === "pazarama-order-sync") {
                    console.log("🔄 Otomatik Pazarama Sipariş Senkronizasyonu başlatıldı...");
                    const { syncOrdersFromPazarama } = await import("@/app/admin/(protected)/integrations/pazarama/actions");
                    const result = await syncOrdersFromPazarama();
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
                    const n11Config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
                    if (n11Config) {
                        const result = await syncProductsToN11(job.data.productIds);
                        if (!result.success) throw new Error(result.message);
                        console.log(`✅ Tamamlandı: N11 Sync - ${result.message}`);
                    }
                } else if (job.data.marketplace === "hepsiburada") {
                    const hbConfig = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
                    if (hbConfig) {
                        const { syncProductsToHepsiburada } = await import("@/app/admin/(protected)/integrations/hepsiburada/actions");
                        const result = await syncProductsToHepsiburada(job.data.productIds);
                        if (!result.success) throw new Error(result.message);
                        console.log(`✅ Tamamlandı: Hepsiburada Sync - ${result.message}`);
                    }
                } else if (job.data.marketplace === "idefix") {
                    const idefixConfig = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
                    if (idefixConfig) {
                        const { syncProductsToIdefix } = await import("@/app/admin/(protected)/integrations/idefix/actions");
                        const result = await syncProductsToIdefix(job.data.productIds);
                        if (!result.success) throw new Error(result.message);
                        console.log(`✅ Tamamlandı: Idefix Sync - ${result.message}`);
                    }
                } else if (job.data.marketplace === "pazarama") {
                    const pazaramaConfig = await (prisma as any).pazaramaConfig.findFirst({ where: { isActive: true } });
                    if (pazaramaConfig && job.data.productIds && job.data.productIds.length > 0) {
                        const { syncPazaramaStockAndPrice } = await import("@/app/admin/(protected)/integrations/pazarama/actions");
                        const result = await syncPazaramaStockAndPrice(job.data.productIds);
                        if (!result.success) throw new Error(result.message);
                        console.log(`✅ Tamamlandı: Pazarama Sync - ${result.message}`);
                    }
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
