import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const config = await prisma.hepsiburadaConfig.findFirst();
    if (!config) return console.log('no config found in db');
    console.log('Merchant:', config.merchantId);
    
    let url = 'https://mpop.hepsiburada.com/product/api/categories/get-all-categories?status=ACTIVE&size=50000';
    if (config.isTestMode) {
        url = 'https://mpop-sit.hepsiburada.com/product/api/categories/get-all-categories?status=ACTIVE&size=50000';
    }

    const res = await fetch(url, {
        headers: {
            Authorization: 'Basic ' + Buffer.from(config.merchantId + ':' + config.password).toString('base64'),
            'User-Agent': 'serinmotor_dev',
            Accept: 'application/json'
        }
    });
    
    if (!res.ok) {
        console.error('Err:', res.status, await res.text());
        return;
    }
    const data = await res.json();
    console.log('Categories count:', data.data?.length);
    console.log('Total pages:', data.totalPages);
    console.log('Total elements:', data.totalElements);
    
    // Check if we can find 'Motosiklet Filtresi'
    const found = data.data?.filter((c: any) => c.name.includes('Motosiklet Filtresi') || c.paths?.join(' ').includes('Motosiklet Filtresi'));
    console.log('Found elements:', found?.map((f:any) => f.name));
    console.log('Found count:', found?.length);
}

run().catch(console.error).finally(() => prisma.$disconnect());
