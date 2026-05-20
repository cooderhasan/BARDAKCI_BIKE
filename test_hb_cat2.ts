import { hepsiburadaClient } from './src/services/hepsiburada/client';

async function run() {
    const client = await hepsiburadaClient();
    const url = `https://mpop.hepsiburada.com/product/api/categories/get-all-categories`;
    console.log('Fetching', url);
    const res = await fetch(url, { headers: client.getHeaders() });
    const data = await res.json();
    console.log('Total categories from API directly:', data?.data?.length);
    if (data?.data) {
        const motosiklet = data.data.find(c => c.name && c.name.toLowerCase().includes('motosiklet'));
        console.log('Motosiklet:', motosiklet?.name, 'ID:', motosiklet?.id);
    }
}
run().catch(console.error);
