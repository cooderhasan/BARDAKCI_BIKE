import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const config = await prisma.hepsiburadaConfig.findFirst({ where: { isActive: true } });
    if (!config) throw new Error("No config");
    
    const token = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const headers = { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' };
    
    // Default get-all-categories
    const url = `https://mpop.hepsiburada.com/product/api/categories/get-all-categories`;
    console.log('Fetching', url);
    const res = await fetch(url, { headers });
    const data = await res.json();
    console.log('Total items in response:', data?.data?.length);
    
    if (data?.data) {
        const motosiklet = data.data.find((c: any) => c.name && c.name.toLowerCase().includes('motosiklet'));
        console.log('Motosiklet:', motosiklet?.name, 'ID:', motosiklet?.categoryId || motosiklet?.id);
        
        // Find other related
        const motosikletList = data.data.filter((c: any) => c.name && c.name.toLowerCase().includes('motosiklet'));
        console.log('Motosiklet Categories count:', motosikletList.length);
        console.log('Motosiklet Categories sample:', motosikletList.slice(0, 5).map((c:any)=>c.name));
    }
}
run().catch(console.error).finally(()=>prisma.$disconnect());
