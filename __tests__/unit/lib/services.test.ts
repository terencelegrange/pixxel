import { getComposedService } from "@/lib/services";

describe("getComposedService", () => {
  it("returns null when the service row is not found", async () => {
    const execute = jest.fn().mockResolvedValueOnce([[], []]);
    const result = await getComposedService({ execute } as any, "mysql", { id: "missing" });
    expect(result).toBeNull();
  });

  it("composes the service with its ordered members", async () => {
    const serviceRow = {
      id: "s1", name: "Telephony", slug: "telephony", description: null,
      status: "Active", tier_id: null, tier_name: null, domain_id: null, domain_name: null,
      business_owner: null, technical_owner: null,
      created_by_id: "u1", created_by_name: "Alice",
      created_at: new Date("2026-01-01"), updated_at: new Date("2026-01-01"),
    };
    const memberRows = [
      { asset_id: "a1", asset_name: "Twilio", asset_type: "SaaS", asset_icon: "Phone",
        lifecycle_status: "Production", tier_name: "Gold", role: "Core", notes: null },
    ];
    const execute = jest.fn()
      .mockResolvedValueOnce([[serviceRow], []])
      .mockResolvedValueOnce([memberRows, []]);
    const result = await getComposedService({ execute } as any, "mysql", { id: "s1" });
    expect(result?.slug).toBe("telephony");
    expect(result?.members).toHaveLength(1);
    expect(result?.members[0].role).toBe("Core");
  });
});
