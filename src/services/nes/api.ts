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
            const modeName = this.config.isTestMode ? "TEST (apitest.nes.com.tr)" : "CANLI (api.nes.com.tr)";
            
            // Test için sırayla endpoint'leri deneyelim
            const testEndpoints = [
                `/einvoice/v1/users/${this.config.senderVkn}/All`,
                `/earchive/v1/notifications/dynamicrules?page=1&pageSize=1&sort=CreatedAt%20desc`,
                `/einvoice/v1/users/${this.config.senderVkn}/Pk`
            ];

            let lastStatus = 0;
            let lastText = "";

            for (const endpoint of testEndpoints) {
                try {
                    const response = await fetch(`${this.baseUrl}${endpoint}`, {
                        method: "GET",
                        headers: this.headers,
                        signal: AbortSignal.timeout(10000)
                    });

                    lastStatus = response.status;
                    lastText = await response.text();

                    if (response.ok) {
                        return {
                            success: true,
                            message: `✅ NES API bağlantısı başarılı! Ortam: ${modeName}`,
                        };
                    }

                    // 404 de dönse API'ye erişebildik ve yetkimiz var demektir
                    if (response.status === 404) {
                        return {
                            success: true,
                            message: `✅ NES API sunucusuna erişildi! (${modeName}) - Mükellef kaydı bulunamadı (404) ama API Key doğrulandı.`,
                        };
                    }
                } catch (e: any) {
                    lastText = e.message;
                }
            }

            if (lastStatus === 401 || lastStatus === 403) {
                return {
                    success: false,
                    message: `❌ API Anahtarı yetkisiz (HTTP ${lastStatus}). ${modeName} seçeneğini kontrol edin. Canlı key için Test Modunu kapatın. Detay: ${lastText.slice(0, 150)}`,
                };
            }

            return {
                success: false,
                message: `⚠️ NES API yanıt vermedi veya hata döndü (HTTP ${lastStatus}). Detay: ${lastText.slice(0, 150)}`,
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
        // Yanıt (UserInfo): { identifier, title, type, aliases: [{ alias, type: "Pk"|"Gb", creationTime }] }
        // Faturayı alıcının posta kutusu (Pk) etiketine göndeririz. Önceden üst düzeyde "alias" aranıyordu; bulunamadığı
        // için mükellefler "değil" sayılıp e-Arşiv kesiliyor, NES de "ALICI EFATURA MUKELLEFIDIR" diye reddediyordu.
        const endpoint = `/einvoice/v1/users/${encodeURIComponent(vkn)}/Pk`;
        console.log(`🔍 NES Mükellef Sorgusu: ${endpoint}`);
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "GET",
            headers: this.headers,
            signal: AbortSignal.timeout(15000),
        });

        // 404 = GİB mükellef listesinde yok → e-Arşiv
        if (response.status === 404) return { isEInvoiceUser: false };
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Mükellef sorgusu başarısız (${response.status}): ${text.slice(0, 200)}`);
        }

        const data = await response.json();
        console.log(`📋 Mükellef Yanıtı:`, JSON.stringify(data));
        const info = Array.isArray(data) ? data[0] : data;
        const aliases: Array<{ alias: string; type: string; title?: string }> = (info?.aliases || info?.Aliases || []).map((a: any) => ({
            alias: a.alias || a.Alias || "",
            type: a.type || a.Type || "",
        }));
        const pk = aliases.filter((a) => a.alias && (!a.type || a.type.toLowerCase() === "pk"));
        // En yeni oluşturulan etiket genelde güncel olanı; NES sıralamasına güvenip ilk Pk'yi alıyoruz
        const alias = pk[0]?.alias || info?.alias || info?.Alias;
        if (!alias) return { isEInvoiceUser: false };
        return { isEInvoiceUser: true, alias, title: info?.title || info?.Title, aliases };
    }

    /**
     * Gönderici (bizim) e-Fatura gönderici kutusu (Gb) etiketi. Ayardaki etiket GİB listesindeyse o, değilse listedeki ilk Gb.
     * Ayara yazım hatasıyla girilen etiket ("defaulttgb") e-Arşiv'de fark edilmiyor, e-Fatura'da reddediliyordu.
     */
    async resolveSenderAlias(): Promise<string | undefined> {
        const configured = this.config.senderAlias?.trim();
        try {
            const response = await fetch(`${this.baseUrl}/einvoice/v1/users/${encodeURIComponent(this.config.senderVkn)}/Gb`, {
                method: "GET",
                headers: this.headers,
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) return configured;
            const data = await response.json();
            const info = Array.isArray(data) ? data[0] : data;
            const gb: string[] = (info?.aliases || [])
                .filter((a: any) => a?.alias && (!a.type || String(a.type).toLowerCase() === "gb"))
                .map((a: any) => a.alias);
            if (configured && gb.includes(configured)) return configured;
            if (gb[0]) console.warn(`⚠️ Ayardaki gönderici etiketi (${configured}) GİB listesinde yok, ${gb[0]} kullanılıyor`);
            return gb[0] || configured;
        } catch {
            return configured;
        }
    }

    /**
     * E-Fatura serisi (3 harf): NES'te tanımlı aktif ve varsayılan seri. Numara NES tarafından verilir.
     * GET /einvoice/v1/definitions/series
     */
    async getEInvoiceSeriesPrefix(): Promise<string | null> {
        try {
            const response = await fetch(`${this.baseUrl}/einvoice/v1/definitions/series?status=Active`, {
                method: "GET",
                headers: this.headers,
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) return null;
            const list = await response.json();
            if (!Array.isArray(list) || list.length === 0) return null;
            const active = list.filter((s: any) => !s.activeStatus || String(s.activeStatus).toLowerCase() === "active");
            const pick = active.find((s: any) => s.isDefault) || active[0];
            return pick?.serie || null;
        } catch {
            return null;
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
        formData.append("PreviewType", "Html");
        formData.append("SourceApp", this.config.sourceApp || "BardakciBike");
        formData.append("IsDirectSend", "true");
        formData.append("SenderAlias", this.config.senderAlias || "urn:mail:defaultgb@nes.com.tr");
        formData.append("ReceiverAlias", "urn:mail:defaultpk@gib.gov.tr");

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
                let errorDetails = "";
                if (Array.isArray(responseData.invalidFields) && responseData.invalidFields.length > 0) {
                    errorDetails = responseData.invalidFields.map((f: any) => `${f.field}: ${f.description || ''}`).join(" | ");
                } else if (Array.isArray(responseData.errors) && responseData.errors.length > 0) {
                    errorDetails = responseData.errors.map((e: any) => `[${e.code || ''}] ${e.description || ''} ${e.detail || ''}`).join(" | ");
                } else {
                    errorDetails = responseData.message || responseText;
                }
                throw new Error(`NES E-Arşiv API Hatası (${response.status}): ${errorDetails}`);
            }

            return {
                ...generated,
                ...responseData,
                uuid: responseData.uuid || generated.uuid,
                invoiceNumber: responseData.documentNumber || responseData.invoiceNumber || generated.invoiceNumber,
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
        formData.append("PreviewType", "Html");
        formData.append("SourceApp", this.config.sourceApp || "BardakciBike");
        formData.append("IsDirectSend", "true");
        const senderAlias = await this.resolveSenderAlias();
        formData.append("SenderAlias", senderAlias || "urn:mail:defaultgb@nes.com.tr");
        formData.append("ReceiverAlias", receiver.receiverAlias || "urn:mail:defaultpk@nes.com.tr");
        // NES e-Fatura yüklemesinde zorunlu alan; alıcıyı NES firma listesine kaydetmesin
        formData.append("AutoSaveCompany", "false");

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
                let errorDetails = "";
                if (Array.isArray(responseData.invalidFields) && responseData.invalidFields.length > 0) {
                    errorDetails = responseData.invalidFields.map((f: any) => `${f.field}: ${f.description || ''}`).join(" | ");
                } else if (Array.isArray(responseData.errors) && responseData.errors.length > 0) {
                    errorDetails = responseData.errors.map((e: any) => `[${e.code || ''}] ${e.description || ''} ${e.detail || ''}`).join(" | ");
                } else {
                    errorDetails = responseData.message || responseText;
                }
                throw new Error(`NES E-Fatura API Hatası (${response.status}): ${errorDetails}`);
            }

            // NES numarayı "documentNumber" ile döner (e-Arşiv'de okunuyordu, burada okunmadığı için sadece seri öneki
            // "MFB" kaydediliyordu). Yanıtta yoksa belge detayından alınır.
            const uuid = responseData.uuid || generated.uuid;
            const documentNumber = responseData.documentNumber || responseData.invoiceNumber || (await this.getEInvoiceNumber(uuid));
            return {
                ...generated,
                ...responseData,
                uuid,
                invoiceNumber: documentNumber || generated.invoiceNumber,
                status: "SUCCESS",
            };
        } catch (error: any) {
            console.error("❌ NES E-Fatura gönderim hatası:", error.message);
            throw error;
        }
    }

    /** Giden e-Fatura numarası (ör. MFB2026000000012): GET /einvoice/v1/outgoing/invoices/{uuid} → documentNumber */
    async getEInvoiceNumber(uuid: string): Promise<string | null> {
        try {
            const response = await fetch(`${this.baseUrl}/einvoice/v1/outgoing/invoices/${encodeURIComponent(uuid)}`, {
                method: "GET",
                headers: this.headers,
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) return null;
            const data = await response.json();
            return data?.documentNumber || null;
        } catch {
            return null;
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
