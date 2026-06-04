import { generateOrderContracts } from '../src/lib/pdf-generator';
import fs from 'fs';
import path from 'path';

const dummyProps = {
    orderNumber: "TR-999999999",
    customerName: "FATIH BARDAKCI",
    customerPhone: "+90 5540144142",
    customerEmail: "vitrinmoto@gmail.com",
    shippingAddress: {
        address: "SELÇUKLU KONYA",
        city: "KONYA",
        district: "SELÇUKLU"
    },
    items: [
        {
            productName: "Muhtelif Yedek Parça",
            quantity: 1,
            unitPrice: 56700.00,
            lineTotal: 56700.00,
            variantInfo: "Motosiklet Aksesuar Seti"
        }
    ],
    totalAmount: 56880.00,
    paymentMethod: "CREDIT_CARD",
    shippingCost: 180.00,
    dateStr: "04.06.2026"
};

async function test() {
    console.log("Generating PDFs with dummy data...");
    try {
        const result = await generateOrderContracts(dummyProps);
        const scratchDir = path.join(__dirname, '..', 'scratch');
        if (!fs.existsSync(scratchDir)) {
            fs.mkdirSync(scratchDir, { recursive: true });
        }
        
        fs.writeFileSync(path.join(scratchDir, 'test-pre-info.pdf'), result.preInfoForm);
        console.log("Saved test-pre-info.pdf");
        
        fs.writeFileSync(path.join(scratchDir, 'test-distance-sales.pdf'), result.distanceSalesContract);
        console.log("Saved test-distance-sales.pdf");
        
        fs.writeFileSync(path.join(scratchDir, 'test-cancellation.pdf'), result.cancellationRefundPolicy);
        console.log("Saved test-cancellation.pdf");
        
        console.log("✅ All test PDFs generated successfully!");
    } catch (err) {
        console.error("❌ Error generating test PDFs:", err);
    }
}

test();
