/**
 * NES Bilgi E-Fatura & E-Arşiv API Client
 * 
 * REST API, Bearer Token auth kullanır.
 * Belgeler UBL-TR XML formatında multipart/form-data ile gönderilir.
 * 
 * Test: https://apitest.nes.com.tr
 * Canlı: https://api.nes.com.tr
 * 
 * E-Arşiv: /earchive/v1/uploads/document
 * E-Fatura: /einvoice/v1/uploads/document
 * 
 * Swagger: https://apitest.nes.com.tr/earchive/v1.swagger.taged.json
 */

import {
    buildUblInvoiceXml,
    UblSenderInfo,
    UblReceiverInfo,
    UblInvoiceLine,
    UblInvoiceOptions,
    GeneratedInvoiceXml,
} from "./ubl-builder";

// ============= TYPES =============

export interface NesConfig {
    apiKey: string;
    senderAlias: string;
    senderVkn: string;
    senderTitle: string;
    senderAddress?: string;
    senderCity?: string;
    senderDistrict?: string;
    taxOffice?: string;
    sourceApp?: string;
    isTestMode?: boolean;
}

export interface NesUploadResponse {
    uuid?: string;
    invoiceNumber?: string;
    status?: string;
    message?: string;
    [key: string]: any;
}

export interface NesTaxpayerResult {
    isEInvoiceUser: boolean;
    alias?: string;
    title?: string;
    aliases?: Array<{ alias: string; type: string; title?: string }>;
}

// ============= CLIENT =============

export class NesClient {
    private baseUrl: string;
    private config: NesConfig;

    constructor(config: NesConfig) {
        this.config = config;
        this.baseUrl = config.isTestMode
            ? "https://apitest.nes.com.tr"
            : "https://api.nes.com.tr";
    }

    // ============= PRIVATE HELPERS =============

    private get headers(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.config.apiKey}`,
            Accept: "application/json",
        };
    }

    private get senderInfo(): UblSenderInfo {
        return {
            vkn: this.config.senderVkn,
            title: this.config.senderTitle,
            address: this.config.senderAddress,
            city: this.config.senderCity,
            district: this.config.senderDistrict,
            taxOffice: this.config.taxOffice,
            senderAlias: this.config.senderAlias,
        };
    }

    // ============= BAĞLANTI TESTİ =============

    /**
     * NES API bağlantısını test eder
     */
    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            // Basit bir GET isteği ile API erişilebilirliğini kontrol et
            // Mükellef sorgulama endpoint'i ile test ediyoruz (kendi VKN'miz)
            const response = await fetch(
                `${this.baseUrl}/einvoice/v1/users/${this.config.senderVkn}/All`,
                {
                    method: "GET",
                    headers: this.headers,
                }
            );

            if (response.ok) {
                return {
                    success: true,
                    message: `✅ NES API bağlantısı başarılı! (${this.config.isTestMode ? "TEST" : "CANLI"} ortam)`,
                };
            }

            if (response.status === 401 || response.status === 403) {
                return {
                    success: false,
                    message: "❌ API anahtarı geçersiz veya yetki yetersiz. NES Portal'dan kontrol edin.",
                };
            }

            return {
                success: true,
                message: `⚠️ NES API erişilebilir ancak yanıt beklenen formatta değil (${response.status}). Test ortamı kısıtlaması olabilir.`,
            };
        } catch (error: any) {
            return {
                success: false,
                message: `❌ NES API'ye bağlanılamadı: ${error.message}`,
            };
        }
    }

    // ============= MÜKELLEF SORGULAMA =============

    /**
     * VKN ile e-Fatura mükellefi kontrolü yapar
     * GET /einvoice/v1/users/{identifier}/{aliasType}
     * aliasType: All, Pk, Gb
     */
    async checkTaxpayer(vkn: string): Promise<NesTaxpayerResult> {
        try {
            // Birden fazla endpoint deneyelim
            const endpoints = [
                `/einvoice/v1/users/${vkn}/All`,
                `/einvoice/v1/users/${vkn}/Pk`,
            ];

            for (const endpoint of endpoints) {
                try {
                    console.log(`🔍 NES Mükellef Sorgusu: ${endpoint}`);
                    const response = await fetch(`${this.baseUrl}${endpoint}`, {
                        method: "GET",
                        headers: this.headers,
                        signal: AbortSignal.timeout(15000),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        console.log(`📋 Mükellef Yanıtı:`, JSON.stringify(data, null, 2));

                        // API dizi veya obje dönebilir
                        if (Array.isArray(data) && data.length > 0) {
                            return {
                                isEInvoiceUser: true,
                                alias: data[0].alias || data[0].Alias || data[0].identifier,
                                title: data[0].title || data[0].Title || data[0].name,
                                aliases: data.map((item: any) => ({
                                    alias: item.alias || item.Alias || "",
                                    type: item.type || item.Type || item.aliasType || "",
                                    title: item.title || item.Title || "",
                                })),
                            };
                        }

                        // Tek obje döndüyse
                        if (data && (data.alias || data.Alias)) {
                            return {
                                isEInvoiceUser: true,
                                alias: data.alias || data.Alias,
                                title: data.title || data.Title,
                            };
                        }
                    }

                    // 404 = e-Fatura mükellefi değil
                    if (response.status === 404) {
                        return { isEInvoiceUser: false };
                    }
                } catch (endpointError: any) {
                    console.warn(`⚠️ Endpoint ${endpoint} başarısız:`, endpointError.message);
                }
            }

            return { isEInvoiceUser: false };
        } catch (error: any) {
            console.error("❌ Mükellef sorgusu hatası:", error.message);
            return { isEInvoiceUser: false };
        }
    }

    // ============= E-ARŞİV FATURA GÖNDERME =============

    /**
     * E-Arşiv fatura oluşturur ve NES API'ye gönderir
     * POST /earchive/v1/uploads/document (multipart/form-data)
     */
    async createEArchiveInvoice(
        receiver: UblReceiverInfo,
        lines: UblInvoiceLine[],
        invoiceOptions: Partial<UblInvoiceOptions> = {}
    ): Promise<NesUploadResponse & GeneratedInvoiceXml> {
        const options: UblInvoiceOptions = {
            profileId: "EARSIVFATURA",
            invoiceTypeCode: "SATIS",
            ...invoiceOptions,
        };

        // UBL XML oluştur
        const generated = buildUblInvoiceXml(this.senderInfo, receiver, lines, options);
        console.log(`📄 E-Arşiv UBL XML oluşturuldu: UUID=${generated.uuid}, No=${generated.invoiceNumber}`);

        // Multipart form data hazırla
        const formData = new FormData();
        const xmlBlob = new Blob([generated.xml], { type: "application/xml" });
        formData.append("File", xmlBlob, `${generated.uuid}.xml`);
        formData.append("IsDirectSend", "true");
        formData.append("PreviewType", "Pdf");
        formData.append("SourceApp", this.config.sourceApp || "BardakciBike");
        formData.append("AutoSaveCompany", "true");

        // Pazaryeri bilgileri (opsiyonel)
        if (invoiceOptions.orderNumber) {
            formData.append("SourceAppRecordId", invoiceOptions.orderNumber);
        }

        console.log(`📤 NES E-Arşiv API'ye gönderiliyor: ${this.baseUrl}/earchive/v1/uploads/document`);

        try {
            const response = await fetch(`${this.baseUrl}/earchive/v1/uploads/document`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                    // Content-Type multipart/form-data için browser otomatik set eder
                },
                body: formData,
                signal: AbortSignal.timeout(60000),
            });

            const responseText = await response.text();
            console.log(`📋 NES E-Arşiv Yanıt (${response.status}):`, responseText);

            let responseData: any = {};
            try {
                responseData = JSON.parse(responseText);
            } catch {
                responseData = { rawResponse: responseText };
            }

            if (!response.ok) {
                const errorMsg = responseData.message || responseData.errors?.[0]?.description || responseText;
                throw new Error(`NES E-Arşiv API Hatası (${response.status}): ${errorMsg}`);
            }

            return {
                ...generated,
                ...responseData,
                uuid: responseData.uuid || generated.uuid,
                invoiceNumber: responseData.invoiceNumber || generated.invoiceNumber,
                status: "SUCCESS",
            };
        } catch (error: any) {
            console.error("❌ NES E-Arşiv gönderim hatası:", error.message);
            throw error;
        }
    }

    // ============= E-FATURA GÖNDERME =============

    /**
     * E-Fatura oluşturur ve NES API'ye gönderir
     * POST /einvoice/v1/uploads/document (multipart/form-data)
     */
    async createEInvoice(
        receiver: UblReceiverInfo,
        lines: UblInvoiceLine[],
        invoiceOptions: Partial<UblInvoiceOptions> = {}
    ): Promise<NesUploadResponse & GeneratedInvoiceXml> {
        const options: UblInvoiceOptions = {
            profileId: "TEMELFATURA",
            invoiceTypeCode: "SATIS",
            ...invoiceOptions,
        };

        // UBL XML oluştur
        const generated = buildUblInvoiceXml(this.senderInfo, receiver, lines, options);
        console.log(`📄 E-Fatura UBL XML oluşturuldu: UUID=${generated.uuid}, No=${generated.invoiceNumber}`);

        // Multipart form data hazırla
        const formData = new FormData();
        const xmlBlob = new Blob([generated.xml], { type: "application/xml" });
        formData.append("File", xmlBlob, `${generated.uuid}.xml`);
        formData.append("SenderAlias", this.config.senderAlias);
        formData.append("ReceiverAlias", receiver.receiverAlias || "urn:mail:defaultpk@nes.com.tr");
        formData.append("IsDirectSend", "true");
        formData.append("PreviewType", "Pdf");
        formData.append("SourceApp", this.config.sourceApp || "BardakciBike");
        formData.append("AutoSaveCompany", "true");

        if (invoiceOptions.orderNumber) {
            formData.append("SourceAppRecordId", invoiceOptions.orderNumber);
        }

        console.log(`📤 NES E-Fatura API'ye gönderiliyor: ${this.baseUrl}/einvoice/v1/uploads/document`);

        try {
            const response = await fetch(`${this.baseUrl}/einvoice/v1/uploads/document`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                },
                body: formData,
                signal: AbortSignal.timeout(60000),
            });

            const responseText = await response.text();
            console.log(`📋 NES E-Fatura Yanıt (${response.status}):`, responseText);

            let responseData: any = {};
            try {
                responseData = JSON.parse(responseText);
            } catch {
                responseData = { rawResponse: responseText };
            }

            if (!response.ok) {
                const errorMsg = responseData.message || responseData.errors?.[0]?.description || responseText;
                throw new Error(`NES E-Fatura API Hatası (${response.status}): ${errorMsg}`);
            }

            return {
                ...generated,
                ...responseData,
                uuid: responseData.uuid || generated.uuid,
                invoiceNumber: responseData.invoiceNumber || generated.invoiceNumber,
                status: "SUCCESS",
            };
        } catch (error: any) {
            console.error("❌ NES E-Fatura gönderim hatası:", error.message);
            throw error;
        }
    }

    // ============= PDF İNDİRME =============

    /**
     * Fatura PDF'ini indirir
     * GET /earchive/v1/invoices/{uuid}/pdf
     * GET /einvoice/v1/invoices/{uuid}/pdf
     */
    async getInvoicePdfUrl(uuid: string, type: "earchive" | "einvoice" = "earchive"): Promise<string | null> {
        try {
            // NES API'de PDF doğrudan binary olarak döner
            // PDF URL'ini oluştur
            const pdfEndpoint = `${this.baseUrl}/${type}/v1/invoices/${uuid}/pdf`;
            
            // PDF erişilebilir mi kontrol et
            const response = await fetch(pdfEndpoint, {
                method: "HEAD",
                headers: this.headers,
                signal: AbortSignal.timeout(10000),
            });

            if (response.ok) {
                return pdfEndpoint;
            }

            console.warn(`⚠️ PDF henüz hazır değil: ${response.status}`);
            return null;
        } catch (error: any) {
            console.error("❌ PDF kontrol hatası:", error.message);
            return null;
        }
    }

    /**
     * Fatura PDF'ini binary olarak indirir
     */
    async downloadInvoicePdf(uuid: string, type: "earchive" | "einvoice" = "earchive"): Promise<ArrayBuffer | null> {
        try {
            const pdfEndpoint = `${this.baseUrl}/${type}/v1/invoices/${uuid}/pdf`;
            const response = await fetch(pdfEndpoint, {
                method: "GET",
                headers: this.headers,
                signal: AbortSignal.timeout(30000),
            });

            if (response.ok) {
                return await response.arrayBuffer();
            }

            console.warn(`⚠️ PDF indirilemedi: ${response.status}`);
            return null;
        } catch (error: any) {
            console.error("❌ PDF indirme hatası:", error.message);
            return null;
        }
    }

    // ============= BELGE HTML ÖNİZLEME =============

    /**
     * Fatura HTML önizlemesini indirir
     * GET /earchive/v1/invoices/{uuid}/html
     * GET /einvoice/v1/invoices/{uuid}/html
     */
    async getInvoiceHtml(uuid: string, type: "earchive" | "einvoice" = "earchive"): Promise<string | null> {
        try {
            const htmlEndpoint = `${this.baseUrl}/${type}/v1/invoices/${uuid}/html`;
            const response = await fetch(htmlEndpoint, {
                method: "GET",
                headers: {
                    ...this.headers,
                    Accept: "text/html",
                },
                signal: AbortSignal.timeout(15000),
            });

            if (response.ok) {
                return await response.text();
            }

            return null;
        } catch (error: any) {
            console.error("❌ HTML önizleme hatası:", error.message);
            return null;
        }
    }

    // ============= BELGE DURUMU =============

    /**
     * Fatura listesinden UUID ile belge durumunu sorgular
     */
    async getDocumentStatus(uuid: string, type: "earchive" | "einvoice" = "earchive"): Promise<any> {
        try {
            const response = await fetch(
                `${this.baseUrl}/${type}/v1/invoices/${uuid}`,
                {
                    method: "GET",
                    headers: this.headers,
                    signal: AbortSignal.timeout(15000),
                }
            );

            if (response.ok) {
                return await response.json();
            }

            return null;
        } catch (error: any) {
            console.error("❌ Belge durum sorgusu hatası:", error.message);
            return null;
        }
    }
}
