import { prisma } from "../src/lib/db";
import { CiceksepetiClient } from "../src/services/ciceksepeti/api";

async function main() {
  console.log("🚀 Testing Çiçeksepeti Order Fetching...");

  const config = await (prisma as any).ciceksepetiConfig.findFirst();
  console.log("Config in DB:", config);

  if (config) {
    const client = new CiceksepetiClient({
      apiKey: config.apiKey
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDateStr = thirtyDaysAgo.toISOString();
    const endDateStr = now.toISOString();

    console.log(`Date range: ${startDateStr} -> ${endDateStr}`);

    try {
      const orders = await client.getOrders({
        startDate: startDateStr,
        endDate: endDateStr,
        pageSize: 50
      });
      console.log("Orders response:", { count: orders.length, sample: orders.slice(0, 2) });
    } catch (e: any) {
      console.error("Error fetching CS orders:", e.message);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
