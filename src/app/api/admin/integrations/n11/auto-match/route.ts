import { NextResponse } from "next/server";
import { autoMatchN11ProductsAction } from "@/app/admin/(protected)/integrations/n11/actions";

export async function GET() {
  const result = await autoMatchN11ProductsAction();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await autoMatchN11ProductsAction();
  return NextResponse.json(result);
}
