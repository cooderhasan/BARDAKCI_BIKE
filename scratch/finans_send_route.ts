import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

// POST /api/finance/einvoice/send
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { recipient, settings: invSettings, items } = body

        // 1. Validations
        if (!recipient.vkn || !items.length) {
            return NextResponse.json({ error: 'Eksik bilgi: VKN ve kalemler zorunludur.' }, { status: 400 })
        }

        // 2. Get API Credentials
        const settings = await db.settings.findMany({
            where: { key: { in: ['nesApiKey', 'nesApiUrl', 'companyTitle', 'companyVkn', 'companyAddress', 'companyCity', 'companyDistrict', 'companyInvoicePrefix'] } } // Added company details for UBL
        })
        const settingsMap = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value || ''
            return acc
        }, {} as Record<string, string>)

        const apiKey = settingsMap['nesApiKey']
        const apiUrl = settingsMap['nesApiUrl'] || 'https://api.nes.com.tr/'
        const myTitle = settingsMap['companyTitle'] || 'MOTOVITRIN A.S'
        const myVkn = settingsMap['companyVkn'] || '1111111111'
        const myCity = settingsMap['companyCity'] || 'ISTANBUL'
        const myDetailsPrefix = settingsMap['companyInvoicePrefix'] || 'TAS'

        if (!apiKey) {
            return NextResponse.json({ error: 'API Anahtarı bulunamadı.' }, { status: 400 })
        }

        // 3. Generate UUID for the invoice
        const invoiceUuid = uuidv4()
        const issueDate = invSettings.date // YYYY-MM-DD
        const inviteDateYear = issueDate.split('-')[0]
        const issueTime = new Date().toTimeString().split(' ')[0] // HH:MM:SS

        // 4. Calculate Totals
        let lineExtensionAmount = 0
        let taxExclusiveAmount = 0
        let taxInclusiveAmount = 0
        let totalTaxAmount = 0

        const linesXml = items.map((item: any, index: number) => {
            const qty = parseFloat(item.quantity)
            const price = parseFloat(item.price)
            const vatRate = parseInt(item.vatRate)
            const lineTotal = qty * price
            const vatAmount = lineTotal * (vatRate / 100)

            lineExtensionAmount += lineTotal
            taxExclusiveAmount += lineTotal
            totalTaxAmount += vatAmount
            taxInclusiveAmount += (lineTotal + vatAmount)

            return `
        <cac:InvoiceLine>
            <cbc:ID>${index + 1}</cbc:ID>
            <cbc:InvoicedQuantity unitCode="C62">${qty}</cbc:InvoicedQuantity>
            <cbc:LineExtensionAmount currencyID="TRY">${lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
            <cac:TaxTotal>
                <cbc:TaxAmount currencyID="TRY">${vatAmount.toFixed(2)}</cbc:TaxAmount>
                <cac:TaxSubtotal>
                    <cbc:TaxableAmount currencyID="TRY">${lineTotal.toFixed(2)}</cbc:TaxableAmount>
                    <cbc:TaxAmount currencyID="TRY">${vatAmount.toFixed(2)}</cbc:TaxAmount>
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
                <cbc:Name>${item.name}</cbc:Name>
            </cac:Item>
            <cac:Price>
                <cbc:PriceAmount currencyID="TRY">${price.toFixed(2)}</cbc:PriceAmount>
            </cac:Price>
        </cac:InvoiceLine>`
        }).join('\n')

        // 5. Construct UBL XML
        // Note: Assuming 'SATIS' profile. For E-Archive, ProfileID changes to 'EARSIVFATURA'.
        const profileId = (invSettings.profile === 'E-ARCHIVE' || invSettings.profile === 'EARSIVFATURA') ? 'EARSIVFATURA' : 'TICARIFATURA'
        // Dynamic Prefix Logic: E-Invoice = MFB, E-Archive = MTV
        const invoicePrefix = profileId === 'EARSIVFATURA' ? 'MTV' : 'MFB'

        // Aliases are critical for E-Invoice/E-Archive
        const senderAlias = 'urn:mail:defaultgb@nes.com.tr'
        const receiverAlias = profileId === 'EARSIVFATURA'
            ? 'urn:mail:defaultpk@gib.gov.tr'
            : 'urn:mail:defaultpk@nes.com.tr'

        const ublXml = `<?xml version="1.0" encoding="UTF-8"?>
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
    <cbc:ID>${invoicePrefix}</cbc:ID> 
    <cbc:CopyIndicator>false</cbc:CopyIndicator>
    <cbc:UUID>${invoiceUuid}</cbc:UUID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:IssueTime>${issueTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
    <cbc:LineCountNumeric>${items.length}</cbc:LineCountNumeric>
    ${profileId === 'EARSIVFATURA' ? `
    <cac:AdditionalDocumentReference>
        <cbc:ID>ELEKTRONIK</cbc:ID>
        <cbc:IssueDate>${issueDate}</cbc:IssueDate>
        <cbc:DocumentTypeCode>SEND_TYPE</cbc:DocumentTypeCode>
    </cac:AdditionalDocumentReference>` : ''}
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="${myVkn.length === 11 ? 'TCKN' : 'VKN'}">${myVkn}</cbc:ID>
            </cac:PartyIdentification>
            ${myVkn.length === 11 ? '' : `
            <cac:PartyName>
                <cbc:Name>${myTitle}</cbc:Name>
            </cac:PartyName>`}
            <cac:PostalAddress>
                <cbc:StreetName>${settingsMap['companyAddress'] || '.'}</cbc:StreetName>
                <cbc:CitySubdivisionName>${settingsMap['companyDistrict'] || 'Merkez'}</cbc:CitySubdivisionName>
                <cbc:CityName>${myCity}</cbc:CityName>
                <cac:Country>
                    <cbc:Name>Turkiye</cbc:Name>
                </cac:Country>
            </cac:PostalAddress>
            ${myVkn.length === 11 ? (() => {
                const parts = myTitle.trim().split(' ')
                const lastName = parts.pop() || ''
                const firstName = parts.join(' ') || '.'
                return `
            <cac:Person>
                <cbc:FirstName>${firstName}</cbc:FirstName>
                <cbc:FamilyName>${lastName}</cbc:FamilyName>
            </cac:Person>`
            })() : ''}
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="${recipient.vkn.length === 11 ? 'TCKN' : 'VKN'}">${recipient.vkn}</cbc:ID>
            </cac:PartyIdentification>
            ${recipient.vkn.length === 11 ? '' : `
            <cac:PartyName>
                <cbc:Name>${recipient.title}</cbc:Name>
            </cac:PartyName>`}
            <cac:PostalAddress>
                <cbc:StreetName>${recipient.address}</cbc:StreetName>
                <cbc:CitySubdivisionName>${recipient.district}</cbc:CitySubdivisionName>
                <cbc:CityName>${recipient.city}</cbc:CityName>
                <cac:Country>
                    <cbc:Name>Turkiye</cbc:Name>
                </cac:Country>
            </cac:PostalAddress>
            <cac:Contact>
                <cbc:ElectronicMail>${recipient.email}</cbc:ElectronicMail>
            </cac:Contact>
            ${recipient.vkn.length === 11 ? (() => {
                const parts = recipient.title.trim().split(' ')
                const lastName = parts.pop() || ''
                const firstName = parts.join(' ') || '.'
                return `
            <cac:Person>
                <cbc:FirstName>${firstName}</cbc:FirstName>
                <cbc:FamilyName>${lastName}</cbc:FamilyName>
            </cac:Person>`
            })() : ''}
        </cac:Party>
    </cac:AccountingCustomerParty>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="TRY">${totalTaxAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="TRY">${taxExclusiveAmount.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="TRY">${totalTaxAmount.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                 <cac:TaxScheme>
                    <cbc:Name>KDV</cbc:Name>
                    <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="TRY">${lineExtensionAmount.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="TRY">${taxExclusiveAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="TRY">${taxInclusiveAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="TRY">${taxInclusiveAmount.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    ${linesXml}
</Invoice>`

        // 6. Send as Multipart Form Data to /v1/uploads/document
        const formData = new FormData()

        // Convert string to Blob/File for FormData
        // Node.js native fetch (Next 13+) supports FormData with Blobs usually, 
        // but 'file' parameter logic might be ticklish in some environments.
        const blob = new Blob([ublXml], { type: 'application/xml' })
        formData.append('File', blob, 'invoice.xml')

        formData.append('PreviewType', 'Html')
        formData.append('SourceApp', 'Antigravity')

        // IsDirectSend: true = Gönder, false = Taslak olarak kaydet
        // E-Arşiv için de zorunlu! Yoksa sadece taslak olarak kaydedilir.
        formData.append('IsDirectSend', 'true')

        // Note: SendType for E-Archive is now in UBL XML as AdditionalDocumentReference, not FormData

        formData.append('SenderAlias', senderAlias)
        formData.append('ReceiverAlias', receiverAlias)

        // Determine Service Path (E-Invoice vs E-Archive)
        const servicePath = profileId === 'EARSIVFATURA' ? 'earchive/v1' : 'einvoice/v1'
        const targetUrl = `${apiUrl}${servicePath}/uploads/document`

        console.log('Sending Multipart to:', targetUrl)

        let response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            body: formData
        })

        if (!response.ok) {
            const text = await response.text()
            console.error('NES Upload Error:', text)
            return NextResponse.json({ error: `Gönderim Hatası: ${text} (Status: ${response.status})` }, { status: response.status })
        }

        // Success
        const successData = await response.json() // assuming JSON response

        // Try to save UUID to database if customer exists
        try {
            // Build search criteria
            const isGenericVkn = recipient.vkn === '11111111111' || recipient.vkn === '1111111111'

            // 1. Find all candidates by title
            const candidates = await db.cari.findMany({
                where: {
                    title: {
                        equals: recipient.title,
                        mode: 'insensitive'
                    },
                    type: 'CUSTOMER'
                },
                include: { defaultCurrency: true }
            })

            let customer = null

            // 2. Intelligent matching logic
            if (candidates.length > 0) {
                // Priority 1: Exact Tax Number match (if not generic)
                if (!isGenericVkn) {
                    customer = candidates.find(c => c.taxNumber === recipient.vkn)
                }

                // Priority 2: Phone Number match (if provided)
                if (!customer && recipient.phone) {
                    // Normalize phone numbers (remove non-digits)
                    const cleanRecPhone = recipient.phone.replace(/\D/g, '')

                    // Only attempt matching if we have enough digits
                    if (cleanRecPhone.length > 6) {
                        customer = candidates.find(c => {
                            if (!c.phone) return false
                            const cleanDbPhone = c.phone.replace(/\D/g, '')
                            return cleanDbPhone.includes(cleanRecPhone) || cleanRecPhone.includes(cleanDbPhone)
                        })
                    }
                }

                // Priority 3: If only one candidate exists with this name, assume it's the one
                if (!customer && candidates.length === 1) {
                    customer = candidates[0]
                }

                // Priority 4: Fallback to first candidate (if generic VKN and no other match found)
                if (!customer && candidates.length > 0) {
                    console.log(`⚠️ Multiple candidates for '${recipient.title}' but no specific VKN/Phone match. Using first found.`)
                    customer = candidates[0] // Fallback
                }
            }

            // If customer not found, create new one
            let finalCustomer = customer
            if (!finalCustomer) {
                console.log(`ℹ️ Customer not found, creating new: ${recipient.title}`)

                // Get default currency (TL)
                const defaultCurrency = await db.currency.findUnique({
                    where: { code: 'TL' }
                })

                if (defaultCurrency) {
                    finalCustomer = await db.cari.create({
                        data: {
                            title: recipient.title,
                            type: 'CUSTOMER',
                            phone: recipient.phone || null,
                            email: recipient.email || null,
                            address: recipient.address || null,
                            city: recipient.city || null,
                            district: recipient.district || null,
                            taxNumber: recipient.vkn || null,
                            taxOffice: recipient.taxOffice || null,
                            defaultCurrencyId: defaultCurrency.id,
                            openingBalance: 0,
                            openingBalanceCurrencyId: defaultCurrency.id,
                            isActive: true
                        },
                        include: { defaultCurrency: true }
                    })
                    console.log(`✅ New customer created: ${finalCustomer.title}`)
                }
            }

            if (finalCustomer) {
                // Calculate total amount
                // Calculate total amount (VAT Inclusive)
                let totalAmount = 0
                const salesItemsData = items.map((item: any) => {
                    const qty = parseFloat(item.quantity)
                    const priceExcl = parseFloat(item.price)
                    const vatRate = parseFloat(item.vatRate) || 0

                    // Calculate inclusive price
                    const priceIncl = priceExcl * (1 + vatRate / 100)
                    const lineTotalIncl = qty * priceIncl

                    totalAmount += lineTotalIncl

                    return {
                        productName: item.name,
                        quantity: qty,
                        unitPrice: priceIncl, // Store inclusive price so slip shows correct total
                        lineTotal: lineTotalIncl
                    }
                })

                // Create sales slip with UUID
                const salesSlip = await db.salesSlip.create({
                    data: {
                        customerId: finalCustomer.id,
                        slipDate: new Date(invSettings.date),
                        currencyId: finalCustomer.defaultCurrencyId,
                        exchangeRate: 1,
                        totalAmount: totalAmount,
                        uuid: invoiceUuid,
                        invoiceNumber: successData.documentNumber || null,
                        sentToNes: true,
                        sentAt: new Date(),
                        invoiceType: profileId,
                        items: {
                            create: salesItemsData
                        }
                    }
                })

                // Create CashTransaction for Account Reflection
                await db.cashTransaction.create({
                    data: {
                        cariId: finalCustomer.id,
                        transactionType: 'DEBIT', // Customer owes us (Borç)
                        source: 'sales_slip',
                        sourceId: salesSlip.id,
                        amount: totalAmount,
                        currencyId: finalCustomer.defaultCurrencyId,
                        exchangeRate: 1,
                        transactionDate: new Date(invSettings.date),
                        description: `E-Arşiv Fatura #${salesSlip.id} - ${finalCustomer.title}`
                    }
                })
                console.log(`✅ UUID saved for customer: ${finalCustomer.title}`)
            } else {
                console.log(`ℹ️ Customer not found in DB even after creation attempt. VKN: ${recipient.vkn}, UUID not saved`)
            }
        } catch (dbError: any) {
            console.error('Database save error (non-critical):', dbError)
            // Don't fail the request if DB save fails, but return the error
            return NextResponse.json({
                success: true,
                uuid: invoiceUuid,
                nesResponse: successData,
                message: 'Fatura başarıyla gönderildi FAKAT sisteme kaydedilemedi. Lütfen teknik desteğe bildirin.',
                warning: 'Veritabanı kayıt hatası',
                dbError: dbError.message
            })
        }

        return NextResponse.json({
            success: true,
            uuid: invoiceUuid,
            nesResponse: successData,
            message: 'Fatura başarıyla yüklendi ve gönderildi.'
        })

    } catch (error: any) {
        console.error('Send Invoice Error:', error)
        return NextResponse.json({ error: error.message || 'Gönderim hatası' }, { status: 500 })
    }
}
