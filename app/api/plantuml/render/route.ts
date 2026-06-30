import { NextRequest, NextResponse } from "next/server";
import zlib from "zlib";
import { requireUser } from "@/lib/require-user";

function encodePlantUML(source: string): string {
  const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
  const deflated = zlib.deflateRawSync(Buffer.from(source, "utf-8"));
  let result = "";
  for (let i = 0; i < deflated.length; i += 3) {
    const b0 = deflated[i], b1 = deflated[i + 1] ?? 0, b2 = deflated[i + 2] ?? 0;
    result += ALPHABET[b0 >> 2];
    result += ALPHABET[((b0 & 3) << 4) | (b1 >> 4)];
    result += ALPHABET[((b1 & 15) << 2) | (b2 >> 6)];
    result += ALPHABET[b2 & 63];
  }
  return result;
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { source } = await req.json();
  if (!source) return NextResponse.json({ error: "No source" }, { status: 400 });
  try {
    const encoded = encodePlantUML(source);
    const res = await fetch(`https://www.plantuml.com/plantuml/svg/${encoded}`, {
      headers: { Accept: "image/svg+xml" },
    });
    if (!res.ok) return NextResponse.json({ error: "PlantUML render failed" }, { status: 502 });
    const svg = await res.text();
    return NextResponse.json({ svg });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
