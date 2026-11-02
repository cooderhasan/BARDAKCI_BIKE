"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { registerSchema } from "@/lib/validations";

export async function registerUser(formData: FormData) {
    try {
        const rawData = {
            name: formData.get("name") as string,
            email: formData.get("email") as string,
            password: formData.get("password") as string,
            confirmPassword: formData.get("confirmPassword") as string,
            companyName: formData.get("companyName") ? (formData.get("companyName") as string) : undefined,
            taxNumber: formData.get("taxNumber") ? (formData.get("taxNumber") as string) : undefined,
            phone: formData.get("phone") as string,
            address: formData.get("address") as string,
            city: formData.get("city") as string,
            district: formData.get("district") as string,
        };

        // Validate data
        const validation = registerSchema.safeParse(rawData);
        if (!validation.success) {
            const firstError = validation.error.issues[0]?.message || "Geçersiz veri girişi.";
            return { success: false, error: firstError };
        }

        const validatedData = validation.data;

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: validatedData.email },
        });

        if (existingUser) {
            return { success: false, error: "Bu e-posta adresi zaten kullanılıyor." };
        }

        // Hash password
        const passwordHash = await bcrypt.hash(validatedData.password, 12);

        // Get default discount group (Standart Bayi - 0%)
        let discountGroupId: string | null = null;
        if (!!validatedData.companyName && !!validatedData.taxNumber) {
            const defaultGroup = await prisma.discountGroup.findFirst({
                where: { discountRate: 0, isActive: true },
            });
            discountGroupId = defaultGroup?.id || null;
        }

        // Create user
        const isCorporate = !!validatedData.companyName && !!validatedData.taxNumber;

        await prisma.user.create({
            data: {
                email: validatedData.email,
                passwordHash,
                name: validatedData.name,
                companyName: validatedData.companyName || null,
                taxNumber: validatedData.taxNumber || null,
                phone: validatedData.phone,
                address: validatedData.address,
                city: validatedData.city,
                district: validatedData.district,
                role: isCorporate ? "DEALER" : "CUSTOMER",
                status: isCorporate ? "PENDING" : "APPROVED",
                discountGroupId: discountGroupId,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("REGISTRATION_ERROR:", error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : "Beklenmedik bir hata oluştu. Lütfen tekrar deneyiniz." 
        };
    }
}

