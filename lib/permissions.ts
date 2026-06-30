/**
 * lib/permissions.ts  —  SERVER ONLY
 *
 * Ordered permission levels: read-only < member < admin.
 *
 * Usage in a route handler:
 *   const auth = requireUser(req);
 *   if (!auth.ok) return auth.response;
 *   if (!hasMinLevel(auth.user.role, "admin")) {
 *     return NextResponse.json({ error: "Admin access required." }, { status: 403 });
 *   }
 */
import { PermissionLevel } from "@/types";

const LEVEL_ORDER: Record<PermissionLevel, number> = {
  "read-only": 0,
  "member": 1,
  "admin": 2,
};

// Maps the built-in role strings (stored on users.role) to a permission level.
const BUILTIN_ROLE_LEVEL: Record<string, PermissionLevel> = {
  Admin: "admin",
  Member: "member",
  Viewer: "read-only",
};

/**
 * Resolves the effective permission level for a user.
 * Pass the custom role's permission_level when a role_id is assigned,
 * otherwise falls back to the built-in role mapping.
 */
export function effectiveLevel(
  builtinRole: string,
  customRoleLevel?: PermissionLevel | null
): PermissionLevel {
  if (customRoleLevel) return customRoleLevel;
  return BUILTIN_ROLE_LEVEL[builtinRole] ?? "read-only";
}

/**
 * Returns true if the given role meets the minimum required level.
 * Uses only the built-in role mapping (no DB hit). For custom-role gating
 * you need to fetch the role's permission_level from the DB separately.
 */
export function hasMinLevel(builtinRole: string, minLevel: PermissionLevel): boolean {
  const actual = BUILTIN_ROLE_LEVEL[builtinRole] ?? "read-only";
  return LEVEL_ORDER[actual] >= LEVEL_ORDER[minLevel];
}

export { LEVEL_ORDER, BUILTIN_ROLE_LEVEL };
