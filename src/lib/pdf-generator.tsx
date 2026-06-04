import React from 'react';
import path from 'path';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
    renderToBuffer,
} from '@react-pdf/renderer';

// Register Turkish-supporting fonts
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');
Font.register({
    family: 'NotoSans',
    fonts: [
        { src: path.join(FONT_DIR, 'NotoSans-Regular.ttf'), fontWeight: 'normal' },
        { src: path.join(FONT_DIR, 'NotoSans-Bold.ttf'),    fontWeight: 'bold' },
    ],
});

// Common Styles
const styles = StyleSheet.create({
    page: {
        fontFamily: 'NotoSans',
        fontSize: 8.5,
        padding: 35,
        lineHeight: 1.4,
        color: '#333333',
    },
    header: {
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 15,
        textTransform: 'uppercase',
        borderBottomWidth: 1,
        borderBottomColor: '#cccccc',
        paddingBottom: 5,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 12,
        marginBottom: 6,
        color: '#111111',
        textTransform: 'uppercase',
        borderBottomWidth: 0.5,
        borderBottomColor: '#e5e5e5',
        paddingBottom: 2,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 3,
    },
    label: {
        fontWeight: 'bold',
        width: 130,
    },
    value: {
        flex: 1,
    },
    paragraph: {
        marginBottom: 8,
        textAlign: 'justify',
    },
    table: {
        marginTop: 10,
        marginBottom: 10,
        borderWidth: 0.5,
        borderColor: '#cccccc',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#cccccc',
        padding: 4,
        alignItems: 'center',
    },
    tableHeaderRow: {
        backgroundColor: '#f5f5f5',
        fontWeight: 'bold',
    },
    colName: {
        flex: 3,
        paddingRight: 5,
    },
    colQty: {
        flex: 1,
        textAlign: 'center',
    },
    colPrice: {
        flex: 1.5,
        textAlign: 'right',
    },
    colTotal: {
        flex: 1.5,
        textAlign: 'right',
    },
    boldText: {
        fontWeight: 'bold',
    },
    totalsSection: {
        alignSelf: 'flex-end',
        width: 200,
        marginTop: 5,
        borderTopWidth: 0.5,
        borderTopColor: '#cccccc',
        paddingTop: 5,
    },
    totalsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
});

// Helper for formatting TRY currency
export function formatTRY(amount: number): string {
    return amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
}

// Interfaces
export interface PdfItem {
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    variantInfo?: string;
}

export interface OrderPdfProps {
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    shippingAddress: {
        address: string;
        city: string;
        district?: string;
    };
    items: PdfItem[];
    totalAmount: number;
    paymentMethod: string;
    shippingCost?: number;
    dateStr?: string;
}

// 1. ÖN BİLGİLENDİRME FORMU Component
const PreInformationFormDocument: React.FC<OrderPdfProps> = (props) => {
    const { orderNumber, customerName, customerPhone, customerEmail, shippingAddress, items, totalAmount, paymentMethod, shippingCost = 0, dateStr } = props;
    
    // Subtotal and tax calculation for display
    const itemsTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const dateOfForm = dateStr || new Date().toLocaleDateString('tr-TR');

    let displayPaymentMethod = paymentMethod;
    if (paymentMethod === 'BANK_TRANSFER') displayPaymentMethod = 'Havale / EFT';
    else if (paymentMethod === 'CREDIT_CARD') displayPaymentMethod = 'Kredi Kartı';
    else if (paymentMethod === 'CURRENT_ACCOUNT') displayPaymentMethod = 'Cari Hesap';

    return (
        <Document title={`On-Bilgilendirme-Formu-${orderNumber}`}>
            <Page size="A4" style={styles.page}>
                <Text style={styles.header}>TÜKETİCİ MEVZUATI GEREĞİNCE ÖN BİLGİLENDİRME FORMU</Text>
                
                <Text style={[styles.paragraph, { fontSize: 8 }]}>Tarih: {dateOfForm}</Text>

                <Text style={styles.sectionTitle}>1. SATICIYA İLİŞKİN BİLGİLER</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Ticari Ünvan:</Text>
                    <Text style={styles.value}>Serin Motor - Emre Serin</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Adres:</Text>
                    <Text style={styles.value}>Çatalhüyük mah. asarçayı cad. no 122 1/C Karatay / KONYA</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Telefon:</Text>
                    <Text style={styles.value}>+905353783949</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>E-posta Adresi:</Text>
                    <Text style={styles.value}>emreserin78@gmail.com</Text>
                </View>

                <Text style={styles.sectionTitle}>2. ALICIYA İLİŞKİN BİLGİLER</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Adı Soyadı / Ünvanı:</Text>
                    <Text style={styles.value}>{customerName}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Teslimat Adresi:</Text>
                    <Text style={styles.value}>
                        {shippingAddress.address} {shippingAddress.district ? `${shippingAddress.district}/` : ''}{shippingAddress.city}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Telefon:</Text>
                    <Text style={styles.value}>{customerPhone}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>E-posta:</Text>
                    <Text style={styles.value}>{customerEmail}</Text>
                </View>

                <Text style={styles.sectionTitle}>3. KONU</Text>
                <Text style={styles.paragraph}>
                    İşbu Ön Bilgilendirme Formu’nun konusu; Alıcının, aşağıda nitelik ve satış fiyatı belirtilen ürün ya da ürünlerin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicilerin Korunması Hakkında Kanun ve Mesafeli Sözleşmelere Dair Yönetmelik hükümleri gereğince bilgilendirilmesidir.
                </Text>

                <Text style={styles.sectionTitle}>4. ÜRÜN BİLGİLERİ VE ÖDEME</Text>
                <View style={styles.table}>
                    <View style={[styles.tableRow, styles.tableHeaderRow]}>
                        <Text style={[styles.colName, styles.boldText]}>Ürün Adı</Text>
                        <Text style={[styles.colQty, styles.boldText]}>Adet</Text>
                        <Text style={[styles.colPrice, styles.boldText]}>Birim Fiyat</Text>
                        <Text style={[styles.colTotal, styles.boldText]}>Toplam</Text>
                    </View>
                    {items.map((item, idx) => (
                        <View key={idx} style={styles.tableRow}>
                            <View style={styles.colName}>
                                <Text>{item.productName}</Text>
                                {item.variantInfo && (
                                    <Text style={{ fontSize: 7, color: '#666666' }}>({item.variantInfo})</Text>
                                )}
                            </View>
                            <Text style={styles.colQty}>{item.quantity}</Text>
                            <Text style={styles.colPrice}>{formatTRY(item.unitPrice)}</Text>
                            <Text style={styles.colTotal}>{formatTRY(item.lineTotal)}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.totalsSection}>
                    <View style={styles.totalsRow}>
                        <Text>Ara Toplam:</Text>
                        <Text>{formatTRY(itemsTotal)}</Text>
                    </View>
                    <View style={styles.totalsRow}>
                        <Text>Kargo Bedeli:</Text>
                        <Text>{shippingCost > 0 ? formatTRY(shippingCost) : 'Ücretsiz Kargo'}</Text>
                    </View>
                    <View style={[styles.totalsRow, { marginTop: 4, borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 2 }]}>
                        <Text style={styles.boldText}>Toplam Tutar:</Text>
                        <Text style={styles.boldText}>{formatTRY(totalAmount)}</Text>
                    </View>
                    <View style={[styles.totalsRow, { marginTop: 2 }]}>
                        <Text>Ödeme Şekli:</Text>
                        <Text>{displayPaymentMethod}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>5. TESLİMAT</Text>
                <Text style={styles.paragraph}>
                    Teslimat, stok durumuna göre en kısa sürede yapılır. Satıcı, siparişten itibaren 30 gün içinde teslim eder.
                </Text>

                <Text style={styles.sectionTitle}>6. CAYMA HAKKI</Text>
                <Text style={styles.paragraph}>
                    Alıcı, ürünü teslim aldığı tarihten itibaren 14 gün içinde cayma hakkına sahiptir. Bu hakkın kullanılması için Satıcıya bildirim yapılması gerekmektedir.
                </Text>

                <Text style={styles.sectionTitle}>7. CAYMA HAKKI İSTİSNALARI</Text>
                <Text style={styles.paragraph}>
                    - Alıcının istekleri veya açıkça onun kişisel ihtiyaçları doğrultusunda hazırlanan ürünler (kişiye özel ürünler)
                    {'\n'}- Hijyen açısından iadesi uygun olmayan ürünler (ambalajı açılmış olanlar)
                    {'\n'}- Dijital içerikler ve anında ifa edilen hizmetler
                </Text>

                <Text style={styles.sectionTitle}>8. YETKİLİ MAHKEME</Text>
                <Text style={styles.paragraph}>
                    Uyuşmazlıklarda tüketici hakem heyetleri ve tüketici mahkemeleri yetkilidir.
                </Text>

                <Text style={styles.sectionTitle}>9. ONAY</Text>
                <Text style={styles.paragraph}>
                    Alıcı, bu formu okuyup kabul ettiğini beyan eder.
                </Text>
            </Page>
        </Document>
    );
};

// 2. MESAFELİ SATIŞ SÖZLEŞMESİ Component
const DistanceSalesContractDocument: React.FC<OrderPdfProps> = (props) => {
    const { orderNumber, customerName, customerPhone, customerEmail, shippingAddress, items, totalAmount, paymentMethod, shippingCost = 0, dateStr } = props;
    const itemsTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const dateOfForm = dateStr || new Date().toLocaleDateString('tr-TR');

    let displayPaymentMethod = paymentMethod;
    if (paymentMethod === 'BANK_TRANSFER') displayPaymentMethod = 'Havale / EFT';
    else if (paymentMethod === 'CREDIT_CARD') displayPaymentMethod = 'Kredi Kartı';
    else if (paymentMethod === 'CURRENT_ACCOUNT') displayPaymentMethod = 'Cari Hesap';

    return (
        <Document title={`Mesafeli-Satis-Sozlesmesi-${orderNumber}`}>
            <Page size="A4" style={styles.page}>
                <Text style={styles.header}>MESAFELİ SATIŞ SÖZLEŞMESİ</Text>
                
                <Text style={[styles.paragraph, { fontSize: 8 }]}>Tarih: {dateOfForm}</Text>
                
                <Text style={styles.paragraph}>
                    Tüm kullanıcılar üyelik işlemlerini gerçekleştirdikleri anda satış sözleşmesini okuduklarını ve onayladıklarını kabul etmiş sayılırlar.
                    {'\n'}İşbu sözleşme www.serinmotor.com ile Müşteri arasındaki sanal ortamda satış sözleşmesidir.
                </Text>

                <Text style={styles.sectionTitle}>Madde - 1: KONU</Text>
                <Text style={styles.paragraph}>
                    İşbu sözleşmenin konusu, satıcının alıcıya satışını yaptığı ürünün satışı ve teslimi ile ilgili olarak ilgili mevzuat hükümleri gereğince tarafların hak ve yükümlülüklerini kapsamaktadır.
                </Text>

                <Text style={styles.sectionTitle}>Madde - 2: SATICI BİLGİLERİ</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Ticari Ünvan:</Text>
                    <Text style={styles.value}>Serin Motor - Emre Serin</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Adres:</Text>
                    <Text style={styles.value}>Çatalhüyük mah. asarçayı cad. no 122 1/C Karatay / KONYA</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Telefon:</Text>
                    <Text style={styles.value}>+905353783949</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>GSM / WhatsApp:</Text>
                    <Text style={styles.value}>+905353783949</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>E-Posta:</Text>
                    <Text style={styles.value}>emreserin78@gmail.com</Text>
                </View>

                <Text style={styles.sectionTitle}>Madde - 3: ALICI BİLGİLERİ</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Adı Soyadı / Ünvanı:</Text>
                    <Text style={styles.value}>{customerName}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Teslimat Adresi:</Text>
                    <Text style={styles.value}>
                        {shippingAddress.address} {shippingAddress.district ? `${shippingAddress.district}/` : ''}{shippingAddress.city}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Telefon:</Text>
                    <Text style={styles.value}>{customerPhone}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>E-posta:</Text>
                    <Text style={styles.value}>{customerEmail}</Text>
                </View>

                <Text style={styles.sectionTitle}>Madde - 4: SÖZLEŞME KONUSU VE ÜRÜN BİLGİLERİ</Text>
                <Text style={styles.paragraph}>
                    Mal/ürün veya hizmetin türü, miktarı, marka/modeli, rengi, adedi, satış bedeli ve ödeme şekli sitede belirtildiği gibidir.
                </Text>

                <View style={styles.table}>
                    <View style={[styles.tableRow, styles.tableHeaderRow]}>
                        <Text style={[styles.colName, styles.boldText]}>Ürün Adı</Text>
                        <Text style={[styles.colQty, styles.boldText]}>Adet</Text>
                        <Text style={[styles.colPrice, styles.boldText]}>Birim Fiyat</Text>
                        <Text style={[styles.colTotal, styles.boldText]}>Toplam</Text>
                    </View>
                    {items.map((item, idx) => (
                        <View key={idx} style={styles.tableRow}>
                            <View style={styles.colName}>
                                <Text>{item.productName}</Text>
                                {item.variantInfo && (
                                    <Text style={{ fontSize: 7, color: '#666666' }}>({item.variantInfo})</Text>
                                )}
                            </View>
                            <Text style={styles.colQty}>{item.quantity}</Text>
                            <Text style={styles.colPrice}>{formatTRY(item.unitPrice)}</Text>
                            <Text style={styles.colTotal}>{formatTRY(item.lineTotal)}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.totalsSection}>
                    <View style={styles.totalsRow}>
                        <Text>Ara Toplam:</Text>
                        <Text>{formatTRY(itemsTotal)}</Text>
                    </View>
                    <View style={styles.totalsRow}>
                        <Text>Kargo Bedeli:</Text>
                        <Text>{shippingCost > 0 ? formatTRY(shippingCost) : 'Ücretsiz Kargo'}</Text>
                    </View>
                    <View style={[styles.totalsRow, { marginTop: 4, borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 2 }]}>
                        <Text style={styles.boldText}>Toplam Tutar:</Text>
                        <Text style={styles.boldText}>{formatTRY(totalAmount)}</Text>
                    </View>
                    <View style={[styles.totalsRow, { marginTop: 2 }]}>
                        <Text>Ödeme Şekli:</Text>
                        <Text>{displayPaymentMethod}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Madde - 5: GENEL HÜKÜMLER</Text>
                <Text style={styles.paragraph}>
                    5.1 Alıcı ürün bilgilerini okuyup onayladığını kabul eder.
                    {'\n'}5.2 Ürünler yasal süre (30 gün) içinde teslim edilir.
                    {'\n'}5.3 Teslim edilecek kişi ürünü kabul etmezse satıcı sorumlu değildir.
                    {'\n'}5.4 Satıcı ürünü eksiksiz teslim etmekle yükümlüdür.
                    {'\n'}5.5 Ödeme yapılmazsa teslimat yapılmaz.
                    {'\n'}5.6 Yetkisiz kart kullanımlarında alıcı sorumludur.
                    {'\n'}5.7 Mücbir sebepler halinde teslimat ertelenebilir.
                    {'\n'}5.8 Arızalı ürünlerde iade/onarım işlemi yapılır.
                    {'\n'}5.9 Sözleşme elektronik onay ile geçerlidir.
                </Text>

                <Text style={styles.sectionTitle}>Madde - 6: CAYMA HAKKI</Text>
                <Text style={styles.paragraph}>
                    Alıcı, ürünü teslim aldıktan sonra 7 gün (mevzuat uyarınca 14 gün) içinde cayma hakkına sahiptir. Ürün kullanılmamış ve zarar görmemiş olmalıdır. İade kargo ücreti alıcıya aittir.
                </Text>

                <Text style={styles.sectionTitle}>Madde - 7: YETKİLİ MAHKEME</Text>
                <Text style={styles.paragraph}>
                    Uyuşmazlıklarda Konya Mahkemeleri ve Tüketici Hakem Heyetleri yetkilidir.
                </Text>

                <Text style={styles.sectionTitle}>FİRMA BİLGİLERİ</Text>
                <Text style={styles.paragraph}>
                    Serin Motor - Emre Serin
                    {'\n'}Adres: Çatalhüyük mah. asarçayı cad. no 122 1/C Karatay / KONYA
                    {'\n'}Telefon: +905353783949 | E-Posta: emreserin78@gmail.com
                </Text>
            </Page>
        </Document>
    );
};

// 3. İPTAL VE İADE KOŞULLARI Component
const CancellationRefundPolicyDocument: React.FC<{ dateStr?: string }> = ({ dateStr }) => {
    const dateOfForm = dateStr || new Date().toLocaleDateString('tr-TR');
    return (
        <Document title="Iptal-ve-Iade-Kosullari">
            <Page size="A4" style={styles.page}>
                <Text style={styles.header}>TÜKETİCİ HAKLARI – CAYMA – İPTAL İADE KOŞULLARI</Text>
                
                <Text style={[styles.paragraph, { fontSize: 8 }]}>Güncelleme Tarihi: {dateOfForm}</Text>

                <Text style={styles.sectionTitle}>GENEL:</Text>
                <Text style={styles.paragraph}>
                    1. Kullanmakta olduğunuz web sitesi üzerinden elektronik ortamda sipariş verdiğiniz takdirde, size sunulan ön bilgilendirme formunu ve mesafeli satış sözleşmesini kabul etmiş sayılırsınız.
                    {'\n'}2. Alıcılar, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve ilgili mevzuata tabidir.
                    {'\n'}3. Kargo ücretleri alıcıya aittir.
                    {'\n'}4. Ürünler 30 gün içinde teslim edilir.
                    {'\n'}5. Ürünler eksiksiz ve belirtilen özelliklere uygun teslim edilir.
                    {'\n'}6. Ürün temin edilemezse 14 gün içinde iade yapılır.
                </Text>

                <Text style={styles.sectionTitle}>SATIN ALINAN ÜRÜN BEDELİ ÖDENMEZSE:</Text>
                <Text style={styles.paragraph}>
                    7. Ödeme yapılmazsa satıcının teslim yükümlülüğü sona erer.
                </Text>

                <Text style={styles.sectionTitle}>YETKİSİZ KART KULLANIMI:</Text>
                <Text style={styles.paragraph}>
                    8. Yetkisiz kullanımda ürün 3 gün içinde iade edilmelidir. Kargo alıcıya aittir.
                </Text>

                <Text style={styles.sectionTitle}>MÜCBİR SEBEPLER:</Text>
                <Text style={styles.paragraph}>
                    9. Mücbir sebeplerde teslimat ertelenebilir veya iptal edilerek ücret iadesi yapılır.
                </Text>

                <Text style={styles.sectionTitle}>ALICININ ÜRÜN KONTROLÜ:</Text>
                <Text style={styles.paragraph}>
                    10. Ürün teslim alınmadan önce kontrol edilmelidir. Hasarlı ürün teslim alınmamalıdır.
                </Text>

                <Text style={styles.sectionTitle}>CAYMA HAKKI:</Text>
                <Text style={styles.paragraph}>
                    11. Alıcı 14 gün içinde cayma hakkını kullanabilir.
                    {'\n'}12. Cayma Hakkı Bildirimi:
                    {'\n'}ŞİRKET: Serin Motor - Emre Serin
                    {'\n'}ADI/UNVANI: Emre Serin
                    {'\n'}ADRES: Çatalhüyük mah. asarçayı cad. no 122 1/C Karatay / KONYA
                    {'\n'}TELEFON: +905353783949
                    {'\n'}E-POSTA: emreserin78@gmail.com
                </Text>

                <Text style={styles.sectionTitle}>CAYMA HAKKI SÜRESİ:</Text>
                <Text style={styles.paragraph}>
                    13. Hizmetlerde süre sözleşme tarihinden başlar.
                    {'\n'}14. İade masrafları satıcıya aittir.
                    {'\n'}15. Yazılı bildirim zorunludur.
                </Text>

                <Text style={styles.sectionTitle}>CAYMA HAKKININ KULLANIMI:</Text>
                <Text style={styles.paragraph}>
                    16. Fatura ile birlikte iade yapılmalıdır.
                    {'\n'}17. Ürün kullanılmamış olmalıdır.
                </Text>

                <Text style={styles.sectionTitle}>İADE KOŞULLARI:</Text>
                <Text style={styles.paragraph}>
                    18. Satıcı 10 gün içinde iade yapar.
                    {'\n'}19. Ürün zarar görürse sorumluluk alıcıya aittir.
                    {'\n'}20. Kampanya indirimleri iptal edilebilir.
                </Text>

                <Text style={styles.sectionTitle}>CAYMA HAKKI KULLANILAMAYACAK ÜRÜNLER:</Text>
                <Text style={styles.paragraph}>
                    21. Hijyen ve kişisel ürünlerde iade yoktur.
                    {'\n'}22. Ambalajı açılmış ürünlerde iade kabul edilmez.
                </Text>

                <Text style={styles.sectionTitle}>TEMERRÜT:</Text>
                <Text style={styles.paragraph}>
                    23. Kredi kartı kullanımlarında banka kuralları geçerlidir.
                </Text>

                <Text style={styles.sectionTitle}>ÖDEME VE TESLİMAT:</Text>
                <Text style={styles.paragraph}>
                    24. Banka hesabı: TR94 0001 0001 6879 5109 5650 02 (Ziraat Bankası)
                    {'\n'}25. Kredi kartı ile online ödeme yapılabilir.
                </Text>
            </Page>
        </Document>
    );
};

// 4. Main Generator Function to bundle all three PDFs
export async function generateOrderContracts(props: OrderPdfProps): Promise<{
    preInfoForm: Buffer;
    distanceSalesContract: Buffer;
    cancellationRefundPolicy: Buffer;
}> {
    const [preInfoForm, distanceSalesContract, cancellationRefundPolicy] = await Promise.all([
        renderToBuffer(<PreInformationFormDocument {...props} />),
        renderToBuffer(<DistanceSalesContractDocument {...props} />),
        renderToBuffer(<CancellationRefundPolicyDocument dateStr={props.dateStr} />),
    ]);

    return {
        preInfoForm: preInfoForm as Buffer,
        distanceSalesContract: distanceSalesContract as Buffer,
        cancellationRefundPolicy: cancellationRefundPolicy as Buffer,
    };
}
