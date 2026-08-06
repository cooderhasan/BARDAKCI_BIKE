/**
 * NES E-Fatura / E-Arşiv - UBL-TR 2.1 XML Builder
 * 
 * Motovitrin Finans projesinde sorunsuz çalışan UBL-TR XML şablonuna dayanmaktadır.
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
    receiverAlias?: string;
}

export interface UblInvoiceLine {
    name: string;
    quantity: number;
    unitCode: string;       // "C62" (Adet)
    unitPrice: number;      // KDV hariç birim fiyat
    taxRate: number;        // KDV oranı (20, 10, 1, 0)
    discountAmount?: number;
}

export interface UblInvoiceOptions {
    /** "EARSIVFATURA" veya "TICARIFATURA" veya "TEMELFATURA" */
    profileId: "EARSIVFATURA" | "TEMELFATURA" | "TICARIFATURA";
    /** Fatura tipi */
    invoiceTypeCode?: "SATIS" | "IADE";
    /** Fatura tarihi (YYYY-MM-DD) */
    issueDate?: string;
    /** Fatura saati (HH:MM:SS) */
    issueTime?: string;
    /** Fatura 3 haneli seri ön eki (örn: MTV, MFB) */
    prefix?: string;
    orderNumber?: string;
    notes?: string[];
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

function todayDate(): string {
    return new Date().toISOString().split("T")[0];
}

function currentTime(): string {
    return new Date().toTimeString().split(" ")[0];
}

// ============= MAIN BUILDER =============

export function buildUblInvoiceXml(
    sender: UblSenderInfo,
    receiver: UblReceiverInfo,
    lines: UblInvoiceLine[],
    options: UblInvoiceOptions
): GeneratedInvoiceXml {
    const uuid = uuidv4();
    const issueDate = options.issueDate || todayDate();
    const issueTime = options.issueTime || currentTime();
    const profileId = options.profileId;
    
    // Prefix: E-Arşiv için MTV/TAS, E-Fatura için MFB/DIP vb.
    const prefix = options.prefix || (profileId === "EARSIVFATURA" ? "MTV" : "MFB");

    // Satır hesaplamaları
    let lineExtensionAmount = 0;
    let totalTaxAmount = 0;

    const linesXml = lines.map((line, index) => {
        const qty = line.quantity;
        const price = line.unitPrice;
        const vatRate = line.taxRate;
        const lineTotal = qty * price;
        const vatAmount = lineTotal * (vatRate / 100);

        lineExtensionAmount += lineTotal;
        totalTaxAmount += vatAmount;

        return `
        <cac:InvoiceLine>
            <cbc:ID>${index + 1}</cbc:ID>
            <cbc:InvoicedQuantity unitCode="${escapeXml(line.unitCode || "C62")}">${qty}</cbc:InvoicedQuantity>
            <cbc:LineExtensionAmount currencyID="TRY">${toFixed2(lineTotal)}</cbc:LineExtensionAmount>
            <cac:TaxTotal>
                <cbc:TaxAmount currencyID="TRY">${toFixed2(vatAmount)}</cbc:TaxAmount>
                <cac:TaxSubtotal>
                    <cbc:TaxableAmount currencyID="TRY">${toFixed2(lineTotal)}</cbc:TaxableAmount>
                    <cbc:TaxAmount currencyID="TRY">${toFixed2(vatAmount)}</cbc:TaxAmount>
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
                <cbc:PriceAmount currencyID="TRY">${toFixed2(price)}</cbc:PriceAmount>
            </cac:Price>
        </cac:InvoiceLine>`;
    }).join("\n");

    const taxExclusiveAmount = lineExtensionAmount;
    const taxInclusiveAmount = lineExtensionAmount + totalTaxAmount;

    // Gönderici (Supplier) isim/şahıs ayrımı
    const senderVkn = sender.vkn.replace(/\D/g, "");
    const isSenderTckn = senderVkn.length === 11;
    let senderPersonXml = "";
    let senderPartyNameXml = "";

    if (isSenderTckn) {
        const parts = sender.title.trim().split(" ");
        const lastName = parts.pop() || "";
        const firstName = parts.join(" ") || ".";
        senderPersonXml = `
            <cac:Person>
                <cbc:FirstName>${escapeXml(firstName)}</cbc:FirstName>
                <cbc:FamilyName>${escapeXml(lastName)}</cbc:FamilyName>
            </cac:Person>`;
    } else {
        senderPartyNameXml = `
            <cac:PartyName>
                <cbc:Name>${escapeXml(sender.title)}</cbc:Name>
            </cac:PartyName>`;
    }

    // Alıcı (Customer) isim/şahıs ayrımı
    const receiverVkn = receiver.vkn.replace(/\D/g, "");
    const isReceiverTckn = receiverVkn.length === 11;
    let receiverPersonXml = "";
    let receiverPartyNameXml = "";

    const receiverTitleStr = receiver.title || `${receiver.name} ${receiver.surname || ""}`.trim();

    if (isReceiverTckn) {
        const parts = receiverTitleStr.split(" ");
        const lastName = receiver.surname || (parts.length > 1 ? parts.pop() || "" : "");
        const firstName = receiver.name || parts.join(" ") || ".";
        receiverPersonXml = `
            <cac:Person>
                <cbc:FirstName>${escapeXml(firstName)}</cbc:FirstName>
                <cbc:FamilyName>${escapeXml(lastName)}</cbc:FamilyName>
            </cac:Person>`;
    } else {
        receiverPartyNameXml = `
            <cac:PartyName>
                <cbc:Name>${escapeXml(receiverTitleStr)}</cbc:Name>
            </cac:PartyName>`;
    }

    // E-Arşiv ek referansı
    const eArchiveReferenceXml = profileId === "EARSIVFATURA" ? `
    <cac:AdditionalDocumentReference>
        <cbc:ID>ELEKTRONIK</cbc:ID>
        <cbc:IssueDate>${issueDate}</cbc:IssueDate>
        <cbc:DocumentTypeCode>SEND_TYPE</cbc:DocumentTypeCode>
    </cac:AdditionalDocumentReference>` : "";

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" 
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" 
 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" 
 xmlns:ds="http://www.w3.org/2000/09/xmldsig#" 
 xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" 
 xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" 
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
    <cbc:ProfileID>${profileId}</cbc:ProfileID>
    <cbc:ID>${prefix}</cbc:ID>
    <cbc:CopyIndicator>false</cbc:CopyIndicator>
    <cbc:UUID>${uuid}</cbc:UUID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:IssueTime>${issueTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
    <cbc:LineCountNumeric>${lines.length}</cbc:LineCountNumeric>${eArchiveReferenceXml}
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="${isSenderTckn ? "TCKN" : "VKN"}">${senderVkn}</cbc:ID>
            </cac:PartyIdentification>${senderPartyNameXml}
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(sender.address || ".")}</cbc:StreetName>
                <cbc:CitySubdivisionName>${escapeXml(sender.district || "Merkez")}</cbc:CitySubdivisionName>
                <cbc:CityName>${escapeXml(sender.city || "ISTANBUL")}</cbc:CityName>
                <cac:Country>
                    <cbc:Name>Turkiye</cbc:Name>
                </cac:Country>
            </cac:PostalAddress>${senderPersonXml}
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="${isReceiverTckn ? "TCKN" : "VKN"}">${receiverVkn}</cbc:ID>
            </cac:PartyIdentification>${receiverPartyNameXml}
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(receiver.address || ".")}</cbc:StreetName>
                <cbc:CitySubdivisionName>${escapeXml(receiver.district || "Merkez")}</cbc:CitySubdivisionName>
                <cbc:CityName>${escapeXml(receiver.city || "ISTANBUL")}</cbc:CityName>
                <cac:Country>
                    <cbc:Name>Turkiye</cbc:Name>
                </cac:Country>
            </cac:PostalAddress>
            <cac:Contact>
                <cbc:ElectronicMail>${escapeXml(receiver.email || "")}</cbc:ElectronicMail>
            </cac:Contact>${receiverPersonXml}
        </cac:Party>
    </cac:AccountingCustomerParty>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="TRY">${toFixed2(totalTaxAmount)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="TRY">${toFixed2(taxExclusiveAmount)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="TRY">${toFixed2(totalTaxAmount)}</cbc:TaxAmount>
            <cac:TaxCategory>
                 <cac:TaxScheme>
                    <cbc:Name>KDV</cbc:Name>
                    <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="TRY">${toFixed2(lineExtensionAmount)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="TRY">${toFixed2(taxExclusiveAmount)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="TRY">${toFixed2(taxInclusiveAmount)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="TRY">${toFixed2(taxInclusiveAmount)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>`;

    return {
        xml,
        uuid,
        invoiceNumber: prefix,
    };
}
