/**
 * lib/audit.ts  —  SERVER ONLY
 *
 * Writes a record to audit_log for every CREATE / UPDATE / DELETE action.
 * Import and call this from API route handlers after the main DB operation.
 */
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditEntry {
  tableName: string;
  recordId: string;
  action: AuditAction;
  performedById: string;
  performedByName: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const db = getDb();
  await db.execute(
    `INSERT INTO audit_log
       (id, table_name, record_id, action, performed_by_id, performed_by_name, old_values, new_values)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      entry.tableName,
      entry.recordId,
      entry.action,
      entry.performedById,
      entry.performedByName,
      entry.oldValues ? JSON.stringify(entry.oldValues) : null,
      entry.newValues ? JSON.stringify(entry.newValues) : null,
    ]
  );
}
