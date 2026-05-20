const fs = require("fs");
const path = require("path");

function convertExcelToBase64() {
    const filePath = path.join(__dirname, "../public/Satisbilgisi-18-05-2026-16_49.xlsx");
    
    if (!fs.existsSync(filePath)) {
        console.error("Excel dosyası bulunamadı:", filePath);
        return;
    }
    
    // Dosyayı oku ve base64 string'e dönüştür
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");
    
    // TS dosyası olarak yaz
    const tsContent = `// Auto-generated Excel data
export const excelBase64 = "${base64Data}";
`;
    
    const targetPath = path.join(__dirname, "../src/lib/excel-data.ts");
    fs.writeFileSync(targetPath, tsContent);
    
    console.log(`✅ Excel başarıyla Base64 olarak ${targetPath} dosyasına yazıldı!`);
}

convertExcelToBase64();
