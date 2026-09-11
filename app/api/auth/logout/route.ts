import { NextRequest, NextResponse } from "next/server";
import { isSecureRequest } from "@/lib/cookie-secure";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("authToken", "", {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
