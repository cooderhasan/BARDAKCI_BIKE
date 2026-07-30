import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const val = Number(searchParams.get("val")) || 1;

    const result = await prisma.product.updateMany({
      data: {
        criticalStock: val
      }
    });

    revalidatePath("/admin/products");
    revalidatePath("/admin/settings");

    return NextResponse.json({
      success: true,
      message: `Toplam ${result.count} ürünün kritik stok seviyesi ${val} olarak güncellendi.`,
      updatedCount: result.count
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const val = Number(body.val) || 1;

    const result = await prisma.product.updateMany({
      data: {
        criticalStock: val
      }
    });

    revalidatePath("/admin/products");
    revalidatePath("/admin/settings");

    return NextResponse.json({
      success: true,
      message: `Toplam ${result.count} ürünün kritik stok seviyesi ${val} olarak güncellendi.`,
      updatedCount: result.count
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
