"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";

export async function updateCustomerStatus(
    customerId: string,
    status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED",
    role?: "CUSTOMER" | "DEALER"
) {
    await requireAdmin();
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    await prisma.user.update({
        where: { id: customerId },
        data: {
            status,
            ...(role && { role }),
        },
    });

    // Log the action
    await prisma.adminLog.create({
        data: {
            adminId: session.user.id,
            action: "UPDATE_CUSTOMER_STATUS",
            entityType: "User",
            entityId: customerId,
            newData: { status, role },
        },
    });

    revalidatePath("/admin/customers");
}

export async function updateCustomerDiscountGroup(
    customerId: string,
    discountGroupId: string
) {
    await requireAdmin();
    try {
        const session = await auth();
        if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
            throw new Error("Unauthorized");
        }

        const customer = await prisma.user.findUnique({
            where: { id: customerId },
            select: { discountGroupId: true, role: true },
        });

        let newData;

        if (discountGroupId === "null" || !discountGroupId) {
            // Revert to Standard Customer
            await prisma.user.update({
                where: { id: customerId },
                data: {
                    discountGroupId: null,
                    role: "CUSTOMER"
                },
            });
            newData = { discountGroupId: null, role: "CUSTOMER" };
        } else {
            // Upgrade to Dealer
            await prisma.user.update({
                where: { id: customerId },
                data: {
                    discountGroupId,
                    role: "DEALER"
                },
            });
            newData = { discountGroupId, role: "DEALER" };
        }

        // Log the action
        await prisma.adminLog.create({
            data: {
                adminId: session.user.id,
                action: "UPDATE_DISCOUNT_GROUP",
                entityType: "User",
                entityId: customerId,
                oldData: { discountGroupId: customer?.discountGroupId, role: customer?.role },
                newData: newData,
            },
        });

        revalidatePath("/admin/customers");
        return { success: true };
    } catch (error) {
        console.error("Discount group update error:", error);
        return { success: false, error: error instanceof Error ? error.message : "İskonto grubu güncellenemedi." };
    }
}

export async function createCustomer(data: {
    name: string;
    companyName: string;
    taxNumber: string;
    email: string;
    phone: string;
    password: string;
    discountGroupId: string;
}) {
    await requireAdmin();
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    const { name, companyName, taxNumber, email, phone, password, discountGroupId } = data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        return { success: false, error: "Bu e-posta adresi ile kayıtlı bir kullanıcı zaten var." };
    }

    const hashedPassword = await hash(password, 12);

    const newUser = await prisma.user.create({
        data: {
            email,
            passwordHash: hashedPassword,
            name,
            companyName,
            taxNumber,
            phone,
            role: "DEALER", // Manuel eklenenler direkt bayi olsun
            status: "APPROVED", // ve direkt onaylı
            discountGroupId: discountGroupId || null,
        },
    });

    // ... existing code ...

    revalidatePath("/admin/customers");
    return { success: true };
}

export async function updateCustomerCreditLimit(
    customerId: string,
    creditLimit: number
) {
    await requireAdmin();
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    const previousUser = await prisma.user.findUnique({
        where: { id: customerId },
        select: { creditLimit: true }
    });

    await prisma.user.update({
        where: { id: customerId },
        data: {
            creditLimit,
        },
    });

    // Log the action
    await prisma.adminLog.create({
        data: {
            adminId: session.user.id,
            action: "UPDATE_CREDIT_LIMIT",
            entityType: "User",
            entityId: customerId,
            oldData: { creditLimit: previousUser?.creditLimit ? Number(previousUser.creditLimit) : 0 },
            newData: { creditLimit },
        },
    });

    revalidatePath("/admin/customers");
    return { success: true };
}

export async function getCustomerTransactions(userId: string) {
    await requireAdmin();
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    const transactions = await prisma.currentAccountTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
    });

    return transactions.map(t => ({
        ...t,
        amount: Number(t.amount),
    }));
}

export async function addCustomerTransaction(data: {
    userId: string;
    type: "DEBIT" | "CREDIT";
    amount: number;
    description: string;
    documentNo?: string;
    processType: "ADJUSTMENT" | "OPENING_BALANCE" | "PAYMENT";
}) {
    await requireAdmin();
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    const { userId, type, amount, description, documentNo, processType } = data;

    // Create transaction
    await prisma.currentAccountTransaction.create({
        data: {
            userId,
            type,
            processType,
            amount,
            description,
            documentNo,
            createdBy: session.user.email,
        },
    });

    // Update user balance/risk limits if needed (Current debt is calculated dynamically usually, 
    // but if we had a cached field we would update it here. 
    // The previous implementation seems to calculate on the fly or might need a schema update if we store 'currentDebt'.)
    // *Correction*: The User model doesn't ANYWHERE have 'currentDebt'. It's likely calculated in the query.
    // So just adding the transaction is enough for now, assuming the fetch logic sums it up.

    // Log action
    await prisma.adminLog.create({
        data: {
            adminId: session.user.id,
            action: "ADD_MANUAL_TRANSACTION",
            entityType: "User",
            entityId: userId,
            newData: data as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
    });

    revalidatePath("/admin/customers");
    return { success: true };
}
