'use server'
import { requireAdmin } from "@/lib/admin-guard";

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const contactSchema = z.object({
    name: z.string().min(2, "Ad soyad en az 2 karakter olmalıdır"),
    email: z.string().email("Geçerli bir e-posta adresi giriniz"),
    subject: z.string().optional(),
    message: z.string().min(10, "Mesajınız en az 10 karakter olmalıdır"),
})

export type ContactState = {
    success?: boolean
    error?: string
    message?: string
}

export async function submitContactForm(prevState: ContactState, formData: FormData): Promise<ContactState> {
    // 1. Honeypot Kontrolü
    const hpField = formData.get("hp_field")
    if (hpField && hpField.toString().length > 0) {
        console.warn("Spam detected: Honeypot field filled")
        return { error: "Spam koruması tetiklendi." }
    }

    // 2. Zaman Kontrolü (En az 3 saniye)
    const loadTime = formData.get("form_load_time")
    if (loadTime) {
        const duration = Date.now() - parseInt(loadTime.toString())
        if (duration < 3000) {
            console.warn("Spam detected: Form submitted too fast", duration)
            return { error: "Lütfen formu doldurmadan önce biraz bekleyin." }
        }
    }

    // 3. Turnstile (Captcha) Doğrulaması
    const turnstileToken = formData.get("cf-turnstile-response")
    if (!turnstileToken) {
        return { error: "Lütfen robot olmadığınızı doğrulayın." }
    }

    try {
        const verifyResponse = await fetch(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `secret=${encodeURIComponent(process.env.TURNSTILE_SECRET_KEY!)}&response=${encodeURIComponent(turnstileToken.toString())}`,
            }
        )

        const verifyData = await verifyResponse.json()
        if (!verifyData.success) {
            console.warn("Turnstile verification failed:", verifyData)
            return { error: "Güvenlik doğrulaması başarısız oldu." }
        }
    } catch (error) {
        console.error("Turnstile fetch error:", error)
        return { error: "Güvenlik servisine ulaşılamadı." }
    }

    const parsed = contactSchema.safeParse({
        name: formData.get("name"),
        email: formData.get("email"),
        subject: formData.get("subject"),
        message: formData.get("message"),
    })

    if (!parsed.success) {
        return { error: parsed.error.issues[0].message }
    }

    try {
        await prisma.contactMessage.create({
            data: {
                name: parsed.data.name,
                email: parsed.data.email,
                subject: parsed.data.subject,
                message: parsed.data.message,
            },
        })

        return { success: true, message: "Mesajınız başarıyla gönderildi. En kısa sürede size dönüş yapacağız." }
    } catch (error) {
        console.error("Contact submission error:", error)
        return { error: "Bir hata oluştu, lütfen daha sonra tekrar deneyin." }
    }
}

export async function getContactMessages() {
    await requireAdmin();
    return await prisma.contactMessage.findMany({
        orderBy: { createdAt: "desc" },
    })
}

export async function markMessageAsRead(id: string) {
    await requireAdmin();
    try {
        await prisma.contactMessage.update({
            where: { id },
            data: { isRead: true }
        })
        revalidatePath("/admin/messages")
        return { success: true }
    } catch (error) {
        console.error("Mark read error:", error)
        return { success: false }
    }
}

export async function deleteMessage(id: string) {
    await requireAdmin();
    try {
        await prisma.contactMessage.delete({
            where: { id }
        })
        revalidatePath("/admin/messages")
        return { success: true }
    } catch (error) {
        console.error("Delete message error:", error)
        return { success: false }
    }
}
