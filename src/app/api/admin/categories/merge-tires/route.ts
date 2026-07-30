import { NextResponse } from "next/server";
import { mergeTireCategoriesAction } from "@/app/admin/(protected)/categories/actions";

export async function GET() {
  const result = await mergeTireCategoriesAction();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await mergeTireCategoriesAction();
  return NextResponse.json(result);
}
