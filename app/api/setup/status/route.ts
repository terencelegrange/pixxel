import { NextResponse } from "next/server";
import { isSetupComplete } from "@/lib/setup";

export async function GET() {
  return NextResponse.json({ complete: isSetupComplete() });
}
