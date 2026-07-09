import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases, trims, and hyphenates", () => {
    expect(slugify("Telephony for Retail")).toBe("telephony-for-retail");
  });
  it("strips non-alphanumeric characters", () => {
    expect(slugify("Payments & Billing (v2)")).toBe("payments-billing-v2");
  });
  it("collapses repeated separators", () => {
    expect(slugify("  Multi   Space -- Name ")).toBe("multi-space-name");
  });
});

describe("uniqueSlug", () => {
  it("returns the base slug when unused", async () => {
    const exists = jest.fn().mockResolvedValue(false);
    expect(await uniqueSlug("telephony-retail", exists)).toBe("telephony-retail");
  });
  it("appends -2, -3 on collision", async () => {
    const exists = jest.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    expect(await uniqueSlug("telephony-retail", exists)).toBe("telephony-retail-3");
  });
});
