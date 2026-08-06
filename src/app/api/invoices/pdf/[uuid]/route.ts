import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { NesClient } from "@/services/nes/api";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ uuid: string }> }
) {
    try {
        const { uuid } = await params;
        const { searchParams } = new URL(request.url);
        const type = (searchParams.get("type") as "earchive" | "einvoice") || "earchive";

        if (!uuid) {
            return new NextResponse("UUID eksik", { status: 400 });
        }

        // NES Config getir
        const config = await (prisma as any).nesEInvoiceConfig.findFirst({ where: { isActive: true } });
        if (!config) {
            // Aktif config bulunamadıysa ilk kaydı al
            const firstConfig = await (prisma as any).nesEInvoiceConfig.findFirst();
            if (!firstConfig) {
                return new NextResponse("NES Config bulunamadı", { status: 404 });
            }
        }

        const activeConfig = config || (await (prisma as any).nesEInvoiceConfig.findFirst());

        const client = new NesClient({
            apiKey: activeConfig.apiKey,
            senderAlias: activeConfig.senderAlias,
            senderVkn: activeConfig.senderVkn,
            senderTitle: activeConfig.senderTitle,
            senderAddress: activeConfig.senderAddress,
            senderCity: activeConfig.senderCity,
            senderDistrict: activeConfig.senderDistrict,
            taxOffice: activeConfig.taxOffice,
            sourceApp: activeConfig.sourceApp,
            isTestMode: activeConfig.isTestMode,
        });

        // NES API'den PDF binary verisini indir
        const pdfBuffer = await client.downloadInvoicePdf(uuid, type);

        if (!pdfBuffer) {
            // Henüz hazırlanmamış veya hata alınmışsa HTML önizlemeyi dene
            const htmlContent = await client.getInvoiceHtml(uuid, type);
            if (htmlContent) {
                return new NextResponse(htmlContent, {
                    headers: {
                        "Content-Type": "text/html; charset=utf-8",
                    },
                });
            }
            return new NextResponse("Fatura PDF henüz hazırlanmadı, lütfen 1-2 dakika sonra tekrar deneyin.", { status: 404 });
        }

        return new NextResponse(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="fatura-${uuid}.pdf"`,
                "Cache-Control": "public, max-age=86400",
            },
        });
    } catch (error: any) {
        console.error("❌ Fatura PDF proxy hatası:", error.message);
        return new NextResponse("Fatura PDF alınırken hata oluştu: " + error.message, { status: 500 });
    }
}
