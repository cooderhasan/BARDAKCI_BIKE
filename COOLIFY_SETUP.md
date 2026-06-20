# Coolify Deployment Guide

## 1. Environment Variables (Coolify Dashboard)

Coolify'da uygulamanızı oluşturduktan sonra **Environment Variables** bölümüne aşağıdakileri ekleyin:

```
# Database
DATABASE_URL=postgres://postgres:YIVjfixFdgdSPMDEm9pf7UMFfO354AggIMrJAszjyyWGKjdMfBYuj8Lzh3Rb490S@vo4gook4kcwgocwo4wgk0cgw:5432/postgres

# NextAuth (ÖNEMLİ: Güçlü bir secret oluşturun)
AUTH_SECRET=BURAYA_GUCLU_SECRET_GIRIN
NEXTAUTH_URL=https://bardakcibike.com.tr

# Upload Path
NEXT_PUBLIC_UPLOAD_PATH=/app/public/uploads
UPLOAD_PATH=/app/public/uploads
```

> **AUTH_SECRET oluşturmak için:** Terminal'de `openssl rand -base64 32` çalıştırın

---

## 2. Database Migration (İlk Deploy Sonrası)

Deploy tamamlandıktan sonra Coolify'da **Terminal** açın ve şu komutu çalıştırın:

```bash
npx prisma db push
```

Bu komut veritabanı tablolarını oluşturacak.

---

## 3. Admin Kullanıcı Oluşturma

Tablolar oluşturulduktan sonra admin kullanıcı oluşturmak için:

```bash
npx prisma db seed
```

Veya manuel olarak Prisma Studio ile:
```bash
npx prisma studio
```

---

## 4. Persistent Storage (Yüklemeler için)

Coolify'da **Persistent Storage** bölümüne ekleyin:

| Container Path | Host Path |
|----------------|-----------|
| `/app/public/uploads` | `/data/uploads` |

Bu sayede yüklenen dosyalar container restart'larında kaybolmaz.

---

## 5. Build Command

Coolify otomatik olarak Dockerfile'ı kullanacaktır. Ek bir build komutu gerekmez.

---

## Özet Checklist

- [ ] Environment variables eklendi
- [ ] Deploy tamamlandı
- [ ] `npx prisma db push` çalıştırıldı
- [ ] Admin kullanıcı oluşturuldu
- [ ] Persistent storage ayarlandı
