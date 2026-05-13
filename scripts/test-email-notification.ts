
import * as dotenv from "dotenv";
import path from "path";

// MUST load environment variables BEFORE importing the email library
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { sendAdminNewOrderEmail } from "../src/lib/email";

async function main() {
    console.log("Sending test admin email with fixed env loading...");
    console.log("Using API Key starting with:", process.env.RESEND_API_KEY?.substring(0, 10));
    
    const result = await sendAdminNewOrderEmail({
        orderNumber: "TEST-FIXED-123",
        customerName: "Test Müşteri",
        companyName: "Test Limited Şirketi",
        totalAmount: 1250.75,
        orderId: "test-id",
    });

    if (result.success) {
        console.log("Test email sent successfully!", result.data);
    } else {
        console.error("Failed to send test email:", result.error);
    }
}

main().catch(console.error);
