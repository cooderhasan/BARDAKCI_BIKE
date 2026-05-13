
import { Resend } from "resend";
import { AdminNewOrderEmail } from "../src/emails/admin-new-order";

// HARDCODED API KEY FOR FINAL TESTING
const resend = new Resend("re_AKUxfT1j_6pVvyh1r8zBpssRuU2n53shL");

async function main() {
    console.log("Sending hardcoded test admin email...");
    
    const { data, error } = await resend.emails.send({
        from: 'Sipariş Bildirim <siparis@serinmotor.com>',
        to: ["emreserin78@gmail.com"],
        subject: `Yeni Sipariş: #TEST-HARDCODED`,
        react: AdminNewOrderEmail({
            orderNumber: "TEST-HARDCODED",
            orderId: "test-id",
            customerName: "Test Müşteri",
            companyName: "Test Limited Şirketi",
            totalAmount: 999.99,
        }),
    });

    if (error) {
        console.error("Hardcoded test failed:", error);
    } else {
        console.log("Hardcoded test success!", data);
    }
}

main().catch(console.error);
