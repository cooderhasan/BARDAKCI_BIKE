'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { submitContactForm } from "@/app/actions/contact"
import { toast } from "sonner"
import { Turnstile } from '@marsidev/react-turnstile'

export function ContactForm() {
    const [pending, setPending] = useState(false)
    const [token, setToken] = useState<string>('')
    const formRef = useRef<HTMLFormElement>(null)
    const loadTimeRef = useRef<number>(Date.now())

    useEffect(() => {
        loadTimeRef.current = Date.now()
    }, [])

    async function handleSubmit(formData: FormData) {
        setPending(true)
        try {
            // Cannot pass prevState directly easily with simple action call without useFormState/useActionState
            // We'll just call the action directly for simplicity or wrap it.
            // But wait, my action signature is (prevState, formData).
            // Let's adjust usage or wrapper.

            formData.append('cf-turnstile-response', token)
            formData.append('form_load_time', loadTimeRef.current.toString())

            const result = await submitContactForm({}, formData)

            if (result.success) {
                toast.success(result.message)
                // Optional: reset form
                const form = document.querySelector('form') as HTMLFormElement
                form?.reset()
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error("Bir hata oluştu")
        } finally {
            setPending(false)
        }
    }

    return (
        <form action={handleSubmit} ref={formRef} className="flex flex-col h-full space-y-5">
            {/* Honeypot Field - Gizli alan */}
            <div style={{ display: 'none' }} aria-hidden="true">
                <input
                    type="text"
                    name="hp_field"
                    tabIndex={-1}
                    autoComplete="off"
                />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="name">Ad Soyad</Label>
                    <Input id="name" name="name" placeholder="Adınız Soyadınız" required className="h-11" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">E-posta</Label>
                    <Input id="email" name="email" type="email" placeholder="ornek@sirket.com" required className="h-11" />
                </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input id="phone" name="phone" type="tel" placeholder="05XX XXX XX XX" className="h-11" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="subject">Konu</Label>
                    <Input id="subject" name="subject" placeholder="Mesajınızın konusu" className="h-11" />
                </div>
            </div>
            <div className="space-y-2 flex-1 flex flex-col">
                <Label htmlFor="message">Mesaj</Label>
                <Textarea
                    id="message"
                    name="message"
                    placeholder="Mesajınızı buraya yazınız..."
                    required
                    minLength={10}
                    className="resize-none flex-1 min-h-[250px]"
                />
            </div>

            <div className="flex justify-center py-2">
                <Turnstile
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                    onSuccess={(token) => setToken(token)}
                    onExpire={() => setToken('')}
                    onError={() => setToken('')}
                />
            </div>

            <Button
                className="w-full bg-[#17457C] hover:bg-[#0f3460] text-white"
                size="lg"
                disabled={pending || !token}
            >
                {pending ? "Gönderiliyor..." : "Mesaj Gönder"}
            </Button>
        </form>
    )
}
