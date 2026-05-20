const { Resend } = require('resend');
const dotenv = require('dotenv');
const path = require('path');

// .env dosyasını yükle
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.RESEND_API_KEY;
console.log("Resend API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "BULUNAMADI ❌");

if (!apiKey) {
    console.error("❌ RESEND_API_KEY tanımlı değil!");
    process.exit(1);
}

const resend = new Resend(apiKey);

async function testSend() {
    try {
        console.log("📡 Resend üzerinden test e-postası gönderiliyor...");
        
        // Fatura e-postasındaki şablon parametrelerinin benzerini gönderelim
        const result = await resend.emails.send({
            from: 'Fatura <fatura@serinmotor.com>',
            to: ['emreserin78@gmail.com'], // ADMIN_EMAIL veya alıcı test e-postası
            subject: 'Fatura Gönderim Testi - #TS1002',
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eaeaea; max-width: 465px; margin: auto;">
                    <h2 style="text-align: center;">🧾 Faturanız Hazır (Test)</h2>
                    <p>Merhaba,</p>
                    <p>Siparişinize ait fatura başarıyla oluşturulmuştur.</p>
                    <p><strong>Fatura No:</strong> TEST-123456</p>
                    <p><strong>Tutar:</strong> 150,00 TL</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" 
                           style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                           📄 Faturayı İndir (PDF)
                        </a>
                    </div>
                </div>
            `
        });

        console.log("📋 Resend API Yanıtı:");
        console.log(JSON.stringify(result, null, 2));

        if (result.error) {
            console.error("❌ E-posta Gönderimi Başarısız!");
        } else {
            console.log("✅ E-posta Başarıyla Gönderildi!");
        }
    } catch (error) {
        console.error("❌ Beklenmedik hata:", error);
    }
}

testSend();
