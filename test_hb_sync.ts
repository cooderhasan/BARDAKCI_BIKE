import { PrismaClient } from '@prisma/client';
import { syncOrdersFromHepsiburada } from './src/app/admin/(protected)/integrations/hepsiburada/actions.ts';

const prisma = new PrismaClient();

async function run() {
    console.log('Running sync...');
    const result = await syncOrdersFromHepsiburada();
    console.log('Sync result:', result);
}

run().catch(console.error).finally(()=>prisma.$disconnect());
