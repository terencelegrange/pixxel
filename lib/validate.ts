/**
 * lib/validate.ts  —  SERVER ONLY
 *
 * Parses and validates a request body against a Zod schema.
 * Returns either the typed data or a ready-made 400 NextResponse.
 *
 * Usage:
 *   const result = await validate(req, CreateUserSchema);
 *   if (!result.ok) return result.response;
 *   const { data } = result;  // fully typed, trimmed, unknown keys stripped
 */
import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";

type ValidateResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function validate<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidateResult<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = (result.error as ZodError).issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return {
      ok: false,
      response: NextResponse.json(
        { error: issues[0]?.message ?? "Validation failed.", issues },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: result.data };
}
