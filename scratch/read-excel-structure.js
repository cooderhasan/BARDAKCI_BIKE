const XLSX = require("xlsx");
const path = require("path");

function inspectExcel() {
    const filePath = path.join(__dirname, "../Satisbilgisi-18-05-2026-16_49.xlsx");
    const workbook = XLSX.readFile(filePath);
    
    console.log("WORKBOOK_SHEET_NAMES:", workbook.SheetNames);
    
    const sheetName = workbook.SheetNames.find(name => name.includes("Liste") || name === "Listelerim") || workbook.SheetNames[0];
    console.log("USING_SHEET:", sheetName);
    
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(0, 10);
    console.log("LIST_SAMPLE_ROWS:", JSON.stringify(rows, null, 2));
}

inspectExcel();
