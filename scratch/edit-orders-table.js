const fs = require("fs");
const path = require("path");

function editOrdersTable() {
    const filePath = path.join(__dirname, "../src/components/admin/orders-table.tsx");
    
    if (!fs.existsSync(filePath)) {
        console.error("Dosya bulunamadı:", filePath);
        return;
    }
    
    let content = fs.readFileSync(filePath, "utf8");
    
    const targetStart = "{!(order as any).invoiceNo && (";
    const startIndex = content.indexOf(targetStart);
    
    if (startIndex === -1) {
        console.error("❌ Başlangıç ifadesi bulunamadı!");
        return;
    }
    
    // 1. Başlangıçtaki && işaretini ? yapalım
    content = content.replace(targetStart, "{!(order as any).invoiceNo ? (");
    
    // Güncellenmiş metinden tekrar index'leri hesaplayalım
    const newStartIndex = content.indexOf("{!(order as any).invoiceNo ? (");
    
    // onClick parantezlerini atlamak için </Button> etiketinin bittiği yeri bulalım
    const buttonCloseIndex = content.indexOf("</Button>", newStartIndex);
    if (buttonCloseIndex === -1) {
        console.error("❌ Kapanış </Button> etiketi bulunamadı!");
        return;
    }
    
    // </Button> etiketinden sonra gelen İLK ")}" kapanış parantezini bulalım
    const endIndex = content.indexOf(")}", buttonCloseIndex);
    
    if (endIndex === -1) {
        console.error("❌ Kapanış parantezi ')}' bulunamadı!");
        return;
    }
    
    // Kapanış parantezini yeni pazaryeri butonu ile güncelleyelim
    const beforeEnd = content.substring(0, endIndex);
    const afterEnd = content.substring(endIndex + 2); // 2 karakter olan ")}" sonrasını al
    
    const newContent = beforeEnd + `) : (order.source === "HEPSIBURADA" || order.source === "N11") && (
                                                         <Button
                                                             variant="outline"
                                                             size="icon"
                                                             className="border-orange-300 bg-orange-50/50 text-orange-600 hover:bg-orange-100 h-9 w-9"
                                                             title="Pazaryeri Faturasını Güncelle / Yeniden Gönder"
                                                             disabled={loadingId === order.id}
                                                             onClick={() => handleSendInvoice(order.id)}
                                                         >
                                                             <RefreshCw className={\`h-4 w-4 text-orange-600 \${loadingId === order.id ? 'animate-spin' : ''}\`} />
                                                         </Button>
                                                     )}` + afterEnd;
    
    fs.writeFileSync(filePath, newContent, "utf8");
    console.log("✅ orders-table.tsx başarıyla güncellendi ve yeniden gönderim butonu eklendi!");
}

editOrdersTable();
