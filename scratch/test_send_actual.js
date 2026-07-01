const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Resend } = require('resend');
const apiKey = process.env.RESEND_API_KEY;
const adminEmail = process.env.ADMIN_EMAIL;

console.log("Using API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "MISSING");
console.log("Admin Email:", adminEmail);

const resend = new Resend(apiKey);

async function main() {
    try {
        console.log("Sending actual test email from siparis@bardakcibike.com.tr...");
        const response = await resend.emails.send({
            from: 'Sipariş Bildirim <siparis@bardakcibike.com.tr>',
            to: [adminEmail],
            subject: 'Resend Doğrulama Testi - Bardakcı Bike 🚀',
            html: `
                <h1>Resend Kurulumu Başarılı! 🎉</h1>
                <p>Bardakcı Bike e-posta sistemi artık aktif ve çalışıyor.</p>
                <p>Bu maili görüyorsanız, yeni Resend API Key ve bardakcibike.com.tr alan adı entegrasyonu başarıyla doğrulanmıştır.</p>
                <br>
                <p><strong>Zaman:</strong> ${new Date().toLocaleString('tr-TR')}</p>
            `
        });
        
        console.log("Response:", JSON.stringify(response, null, 2));
    } catch (err) {
        console.error("Error sending email:", err);
    }
}

main();
