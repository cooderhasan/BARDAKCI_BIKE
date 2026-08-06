/**
 * NES E-Fatura / E-Arşiv - UBL-TR 2.1 XML Builder
 * GİB UBL-TR standartlarına uygun fatura XML'i oluşturur.
 * 
 * Referans: motovitrinfinans projesindeki UBL yapısı
 * NES API: POST /earchive/v1/uploads/document (multipart/form-data)
 * NES API: POST /einvoice/v1/uploads/document (multipart/form-data)
 */

import { v4 as uuidv4 } from "uuid";

// ============= TYPES =============

export interface UblSenderInfo {
    vkn: string;
    title: string;
    address?: string;
    city?: string;
    district?: string;
    country?: string;
    taxOffice?: string;
    senderAlias?: string;
}

export interface UblReceiverInfo {
    vkn: string;          // VKN (10 haneli) veya TCKN (11 haneli)
    name: string;         // Ad
    surname?: string;     // Soyad
    title?: string;       // Ünvan (Firma ise)
    address?: string;
    city?: string;
    district?: string;
    country?: string;
    taxOffice?: string;
    email?: string;
    phone?: string;
    receiverAlias?: string; // E-Fatura için alıcı etiketi
}

export interface UblInvoiceLine {
    name: string;
    quantity: number;
    unitCode: string;       // "C62" (Adet), "KGM" (Kg), "MTR" (Metre) vb.
    unitPrice: number;      // KDV hariç birim fiyat
    taxRate: number;        // KDV oranı (20, 10, 1, 0)
    discountAmount?: number; // İndirim tutarı
}

export interface UblInvoiceOptions {
    /** "EARSIVFATURA" veya "TEMELFATURA" veya "TICARIFATURA" */
    profileId: "EARSIVFATURA" | "TEMELFATURA" | "TICARIFATURA";
    /** "SATIS" veya "IADE" */
    invoiceTypeCode: "SATIS" | "IADE";
    /** Fatura tarihi (YYYY-MM-DD) */
    issueDate?: string;
    /** Fatura saati (HH:MM:SS) */
    issueTime?: string;
    /** Para birimi */
    currencyCode?: string;
    /** Sipariş numarası (not olarak eklenir) */
    orderNumber?: string;
    /** Fatura notları */
    notes?: string[];
    /** Kargo bilgileri */
    carrier?: {
        taxId: string;
        name: string;
    };
    /** İnternet satışı URL */
    purchaseUrl?: string;
    /** Ödeme yöntemi */
    paymentMeans?: string;
}

export interface GeneratedInvoiceXml {
    xml: string;
    uuid: string;
    invoiceNumber: string;
}

// ============= HELPERS =============

function escapeXml(str: string): string {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function toFixed2(num: number): string {
    return Number(num).toFixed(2);
}

/** UUID'den tire işaretlerini kaldırarak büyük harfle ETTN formatı oluşturur */
function formatUuid(uuid: string): string {
    return uuid.toLowerCase();
}

/** Bugünün tarihini YYYY-MM-DD formatında döner */
function todayDate(): string {
    const now = new Date();
    return now.toISOString().split("T")[0];
}

/** Şu anki saati HH:MM:SS formatında döner */
function currentTime(): string {
    const now = new Date();
    return now.toTimeString().split(" ")[0];
}

/**
 * Fatura numarası üretir: PREFIX + YIL + 9 haneli sıra
 * Örnek: BRD2026000000001
 */
function generateInvoiceNumber(prefix: string = "BRD"): string {
    const year = new Date().getFullYear();
    // Rastgele 9 haneli sıra numarası (gerçek uygulamada DB'den alınmalı)
    const seq = Math.floor(Math.random() * 999999999).toString().padStart(9, "0");
    return `${prefix}${year}${seq}`;
}

// ============= MAIN BUILDER =============

/**
 * GİB UBL-TR 2.1 standartlarına uygun e-Fatura / e-Arşiv XML'i oluşturur
 */
export function buildUblInvoiceXml(
    sender: UblSenderInfo,
    receiver: UblReceiverInfo,
    lines: UblInvoiceLine[],
    options: UblInvoiceOptions
): GeneratedInvoiceXml {
    const uuid = uuidv4();
    const issueDate = options.issueDate || todayDate();
    const issueTime = options.issueTime || currentTime();
    const currencyCode = options.currencyCode || "TRY";
    const profileId = options.profileId;
    const invoiceTypeCode = options.invoiceTypeCode || "SATIS";

    // Fatura numarası prefix'i profil tipine göre ayarla
    const invoicePrefix = profileId === "EARSIVFATURA" ? "BRD" : "BRE";
    const invoiceNumber = generateInvoiceNumber(invoicePrefix);

    // ============= HESAPLAMALAR =============
    // KDV oranlarına göre gruplama
    const taxGroups: Record<number, { taxableAmount: number; taxAmount: number }> = {};

    let lineExtensionAmount = 0;
    let totalTaxAmount = 0;
    let totalAllowance = 0;

    const invoiceLinesXml = lines.map((line, index) => {
        const qty = line.quantity;
        const price = line.unitPrice;
        const vatRate = line.taxRate;
        const discount = line.discountAmount || 0;

        const lineTotal = qty * price - discount;
        const vatAmount = lineTotal * (vatRate / 100);

        lineExtensionAmount += lineTotal;
        totalTaxAmount += vatAmount;
        totalAllowance += discount;

        // KDV gruplama
        if (!taxGroups[vatRate]) {
            taxGroups[vatRate] = { taxableAmount: 0, taxAmount: 0 };
        }
        taxGroups[vatRate].taxableAmount += lineTotal;
        taxGroups[vatRate].taxAmount += vatAmount;

        // İndirim XML'i
        const discountXml = discount > 0 ? `
            <cac:AllowanceCharge>
                <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
                <cbc:Amount currencyID="${currencyCode}">${toFixed2(discount)}</cbc:Amount>
            </cac:AllowanceCharge>` : "";

        return `
    <cac:InvoiceLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${escapeXml(line.unitCode)}">${qty}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${currencyCode}">${toFixed2(lineTotal)}</cbc:LineExtensionAmount>${discountXml}
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="${currencyCode}">${toFixed2(vatAmount)}</cbc:TaxAmount>
            <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="${currencyCode}">${toFixed2(lineTotal)}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="${currencyCode}">${toFixed2(vatAmount)}</cbc:TaxAmount>
                <cbc:Percent>${vatRate}</cbc:Percent>
                <cac:TaxCategory>
                    <cac:TaxScheme>
                        <cbc:Name>KDV</cbc:Name>
                        <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
                    </cac:TaxScheme>
                </cac:TaxCategory>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>${escapeXml(line.name)}</cbc:Name>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="${currencyCode}">${toFixed2(price)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`;
    }).join("\n");

    // Toplam vergi subtotal'ları
    const taxSubtotalsXml = Object.entries(taxGroups).map(([rate, group]) => `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${currencyCode}">${toFixed2(group.taxableAmount)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${currencyCode}">${toFixed2(group.taxAmount)}</cbc:TaxAmount>
            <cbc:Percent>${rate}</cbc:Percent>
            <cac:TaxCategory>
                <cac:TaxScheme>
                    <cbc:Name>KDV</cbc:Name>
                    <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`).join("\n");

    const taxExclusiveAmount = lineExtensionAmount;
    const taxInclusiveAmount = lineExtensionAmount + totalTaxAmount;
    const payableAmount = taxInclusiveAmount;

    // ============= NOTLAR =============
    const notesXml = (options.notes || []).map(note =>
        `    <cbc:Note>${escapeXml(note)}</cbc:Note>`
    ).join("\n");

    // E-Arşiv için internet satış bilgisi notu
    const internetSalesNote = profileId === "EARSIVFATURA" && options.purchaseUrl
        ? `    <cbc:Note>İNTERNET SATIŞI - ${escapeXml(options.purchaseUrl)}</cbc:Note>\n` : "";

    // Sipariş notu
    const orderNote = options.orderNumber
        ? `    <cbc:Note>Sipariş No: ${escapeXml(options.orderNumber)}</cbc:Note>\n` : "";

    // ============= ALICI BİLGİLERİ =============
    // VKN 10 haneli → Tüzel kişi, 11 haneli → Gerçek kişi
    const isCompany = receiver.vkn.length === 10;

    const receiverPartyId = `
        <cac:PartyIdentification>
            <cbc:ID schemeID="${isCompany ? "VKN" : "TCKN"}">${escapeXml(receiver.vkn)}</cbc:ID>
        </cac:PartyIdentification>`;

    const receiverPartyName = receiver.title
        ? `<cac:PartyName><cbc:Name>${escapeXml(receiver.title)}</cbc:Name></cac:PartyName>`
        : "";

    const receiverPersonXml = !isCompany ? `
        <cac:Person>
            <cbc:FirstName>${escapeXml(receiver.name)}</cbc:FirstName>
            <cbc:FamilyName>${escapeXml(receiver.surname || "")}</cbc:FamilyName>
        </cac:Person>` : "";

    // ============= TAŞıMA (KARGO) BİLGİLERİ =============
    const deliveryXml = options.carrier ? `
    <cac:Delivery>
        <cac:CarrierParty>
            <cac:PartyIdentification>
                <cbc:ID schemeID="VKN">${escapeXml(options.carrier.taxId)}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>${escapeXml(options.carrier.name)}</cbc:Name>
            </cac:PartyName>
        </cac:CarrierParty>
    </cac:Delivery>` : "";

    // ============= ÖDEME BİLGİLERİ =============
    const paymentMeansXml = options.paymentMeans ? `
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>${options.paymentMeans === "CREDIT_CARD" ? "48" : "1"}</cbc:PaymentMeansCode>
        <cbc:PaymentDueDate>${issueDate}</cbc:PaymentDueDate>
    </cac:PaymentMeans>` : "";

    // ============= E-ARŞİV İNTERNET SATIŞ BİLGİLERİ =============
    const internetSalesXml = profileId === "EARSIVFATURA" && options.purchaseUrl ? `
    <cac:AdditionalDocumentReference>
        <cbc:ID>ELEKTRONIK</cbc:ID>
        <cbc:IssueDate>${issueDate}</cbc:IssueDate>
        <cbc:DocumentType>SEND_TYPE</cbc:DocumentType>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>${escapeXml(options.purchaseUrl)}</cbc:ID>
        <cbc:IssueDate>${issueDate}</cbc:IssueDate>
        <cbc:DocumentType>INT_WEBSITE</cbc:DocumentType>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>${options.paymentMeans === "CREDIT_CARD" ? "KREDIKARTI/BANKAKARTI" : "EFT/HAVALE"}</cbc:ID>
        <cbc:IssueDate>${issueDate}</cbc:IssueDate>
        <cbc:DocumentType>INT_PAYMENTMETHOD</cbc:DocumentType>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>${issueDate}</cbc:ID>
        <cbc:IssueDate>${issueDate}</cbc:IssueDate>
        <cbc:DocumentType>INT_PAYMENTDATE</cbc:DocumentType>
    </cac:AdditionalDocumentReference>` : "";

    // ============= TOPLAM İNDİRİM =============
    const allowanceXml = totalAllowance > 0 ? `
    <cac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        <cbc:Amount currencyID="${currencyCode}">${toFixed2(totalAllowance)}</cbc:Amount>
    </cac:AllowanceCharge>` : "";

    // ============= ANA XML =============
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
 xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
    <cbc:ProfileID>${profileId}</cbc:ProfileID>
    <cbc:ID>${invoiceNumber}</cbc:ID>
    <cbc:CopyIndicator>false</cbc:CopyIndicator>
    <cbc:UUID>${formatUuid(uuid)}</cbc:UUID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:IssueTime>${issueTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode>${invoiceTypeCode}</cbc:InvoiceTypeCode>
${orderNote}${internetSalesNote}${notesXml}
    <cbc:DocumentCurrencyCode>${currencyCode}</cbc:DocumentCurrencyCode>
    <cbc:LineCountNumeric>${lines.length}</cbc:LineCountNumeric>
${internetSalesXml}
    <cac:Signature>
        <cbc:ID schemeID="VKN_TCKN" schemeAgencyName="NES">${escapeXml(sender.vkn)}</cbc:ID>
        <cac:SignatoryParty>
            <cac:PartyIdentification>
                <cbc:ID schemeID="VKN">${escapeXml(sender.vkn)}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PostalAddress>
                <cbc:Room>.</cbc:Room>
                <cbc:CitySubdivisionName>${escapeXml(sender.district || "MERKEZ")}</cbc:CitySubdivisionName>
                <cbc:CityName>${escapeXml(sender.city || "İSTANBUL")}</cbc:CityName>
                <cac:Country>
                    <cbc:Name>${escapeXml(sender.country || "Türkiye")}</cbc:Name>
                </cac:Country>
            </cac:PostalAddress>
        </cac:SignatoryParty>
        <cac:DigitalSignatureAttachment>
            <cac:ExternalReference>
                <cbc:URI>#Signature</cbc:URI>
            </cac:ExternalReference>
        </cac:DigitalSignatureAttachment>
    </cac:Signature>

    <cac:AccountingSupplierParty>
        <cac:Party>
            <cbc:WebsiteURI>https://www.bardakcibike.com.tr</cbc:WebsiteURI>
            <cac:PartyIdentification>
                <cbc:ID schemeID="VKN">${escapeXml(sender.vkn)}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>${escapeXml(sender.title)}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(sender.address || ".")}</cbc:StreetName>
                <cbc:CitySubdivisionName>${escapeXml(sender.district || "MERKEZ")}</cbc:CitySubdivisionName>
                <cbc:CityName>${escapeXml(sender.city || "İSTANBUL")}</cbc:CityName>
                <cac:Country>
                    <cbc:Name>${escapeXml(sender.country || "Türkiye")}</cbc:Name>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cac:TaxScheme>
                    <cbc:Name>${escapeXml(sender.taxOffice || "VERGİ DAİRESİ")}</cbc:Name>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
        </cac:Party>
    </cac:AccountingSupplierParty>

    <cac:AccountingCustomerParty>
        <cac:Party>
            ${receiverPartyId}
            ${receiverPartyName}
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(receiver.address || ".")}</cbc:StreetName>
                <cbc:CitySubdivisionName>${escapeXml(receiver.district || "MERKEZ")}</cbc:CitySubdivisionName>
                <cbc:CityName>${escapeXml(receiver.city || "İSTANBUL")}</cbc:CityName>
                <cac:Country>
                    <cbc:Name>${escapeXml(receiver.country || "Türkiye")}</cbc:Name>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cac:TaxScheme>
                    <cbc:Name>${escapeXml(receiver.taxOffice || "VERGİ DAİRESİ")}</cbc:Name>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            ${receiverPersonXml}
        </cac:Party>
    </cac:AccountingCustomerParty>
${deliveryXml}
${paymentMeansXml}
${allowanceXml}
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${currencyCode}">${toFixed2(totalTaxAmount)}</cbc:TaxAmount>
${taxSubtotalsXml}
    </cac:TaxTotal>

    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${currencyCode}">${toFixed2(lineExtensionAmount)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="${currencyCode}">${toFixed2(taxExclusiveAmount)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="${currencyCode}">${toFixed2(taxInclusiveAmount)}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="${currencyCode}">${toFixed2(totalAllowance)}</cbc:AllowanceTotalAmount>
        <cbc:PayableAmount currencyID="${currencyCode}">${toFixed2(payableAmount)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
${invoiceLinesXml}
</Invoice>`;

    return {
        xml,
        uuid: formatUuid(uuid),
        invoiceNumber,
    };
}
