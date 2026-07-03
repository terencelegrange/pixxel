import { NextResponse } from "next/server";
import logger from "@/lib/logger";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    await getDb().query("SELECT 1");
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    logger.error({ err, route: "GET /api/health" }, "request failed");
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
