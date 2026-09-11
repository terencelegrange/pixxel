/**
 * lib/contracts.ts
 *
 * Shared "how urgent is this contract" computation, used by both the API
 * (filtering/counting expiring contracts) and the UI (urgency badges) so
 * the two never disagree. Nothing here is stored — status/urgency is
 * always computed at read time from the contract's own dates.
 */
export interface ContractDeadlineInput {
  endDate: string | null;
  noticePeriodDays: number | null;
  autoRenews: boolean;
}

/**
 * The date by which action is actually needed: for an auto-renewing
 * contract with a notice period, that's endDate minus noticePeriodDays
 * (miss it and it silently renews) — otherwise it's just endDate.
 */
export function getEffectiveDeadline(contract: ContractDeadlineInput): Date | null {
  if (!contract.endDate) return null;
  const end = new Date(contract.endDate);
  if (contract.autoRenews && contract.noticePeriodDays != null) {
    const deadline = new Date(end);
    deadline.setDate(deadline.getDate() - contract.noticePeriodDays);
    return deadline;
  }
  return end;
}

export type ContractUrgency = "terminated" | "overdue" | "critical" | "warning" | "active";

export interface ContractUrgencyInput extends ContractDeadlineInput {
  status: string;
}

export function getContractUrgency(contract: ContractUrgencyInput): ContractUrgency {
  if (contract.status === "Terminated") return "terminated";
  const deadline = getEffectiveDeadline(contract);
  if (!deadline) return "active";
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 30) return "critical";
  if (diffDays <= 90) return "warning";
  return "active";
}

/** True when a contract counts toward an "expiring within N days" alert/count. */
export function isExpiringWithin(contract: ContractUrgencyInput, days: number): boolean {
  if (contract.status !== "Active") return false;
  const deadline = getEffectiveDeadline(contract);
  if (!deadline) return false;
  const now = new Date();
  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= days;
}
