import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import sharp from "sharp";

// Büyük PNG/JPEG'ler (ör. 5 MB slider) Next görsel küçültücüsünü takabiliyordu (telefonda slider boş kalıyordu).
// Yüklerken en fazla 2400px genişliğe indirip WebP olarak kaydediyoruz. GIF (animasyon) olduğu gibi kalır.
const MAX_WIDTH = 2400;

async function optimizeImage(buffer: Buffer, type: string): Promise<{ buffer: Buffer; ext: string } | null> {
    if (type === "image/gif") return null;
    try {
        const img = sharp(buffer, { failOn: "none" }).rotate();
        const meta = await img.metadata();
        // Zaten WebP ve küçükse dokunma (tekrar sıkıştırıp kaliteyi düşürmeyelim)
        if (type === "image/webp" && (meta.width || 0) <= MAX_WIDTH) return null;
        const out = await img
            .resize({ width: MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
        return { buffer: out, ext: "webp" };
    } catch (e) {
        console.error("Upload optimize error (orijinal kaydediliyor):", e);
        return null;
    }
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        // Use getToken for robust auth check consistent with middleware
        const token = await getToken({
            req: request,
            secret: process.env.AUTH_SECRET,
            cookieName: "next-auth.session-token", // Explicitly match the name defined in auth.ts
            secureCookie: process.env.NODE_ENV === "production",
        });

        if (!token || (token.role !== "ADMIN" && token.role !== "OPERATOR")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed." }, { status: 400 });
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json({ error: "File size exceeds 5MB limit." }, { status: 400 });
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const bytes = await file.arrayBuffer();
        let buffer: Buffer = Buffer.from(bytes);
        let ext = file.name.split(".").pop();
        const optimized = await optimizeImage(buffer, file.type);
        if (optimized) {
            buffer = optimized.buffer;
            ext = optimized.ext;
        }
        const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`;
        const filepath = path.join(uploadsDir, filename);

        // Save file
        await writeFile(filepath, buffer);

        // Return the public URL
        const url = `/uploads/${filename}`;

        return NextResponse.json({ url });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
