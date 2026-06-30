import { NextRequest, NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";
import mysql from "mysql2/promise";
import { requireUser } from "@/lib/require-user";

const ATTACHMENT_NAME = "architecture-diagram.png";

async function uploadAttachment(
  pageId: string,
  pngBase64: string,
  auth: string,
  baseUrl: string
): Promise<boolean> {
  try {
    const base64Data = pngBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const blob = new Blob([buffer], { type: "image/png" });
    const form = new FormData();
    form.append("file", blob, ATTACHMENT_NAME);
    form.append("comment", "Architecture diagram from Pixxel");
    const res = await fetch(`${baseUrl}/wiki/rest/api/content/${pageId}/child/attachment`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "X-Atlassian-Token": "no-check",
      },
      body: form,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildBody(asset: mysql.RowDataPacket, withImage: boolean): string {
  const imageBlock = withImage
    ? `<h3>Architecture</h3><ac:image ac:align="center" ac:width="760"><ri:attachment ri:filename="${ATTACHMENT_NAME}" /></ac:image>`
    : "";
  return `<h2>Asset Details</h2>
<table><tbody>
<tr><th>Name</th><td>${asset.name}</td></tr>
<tr><th>Short Code</th><td>${asset.short_code ?? "—"}</td></tr>
<tr><th>Type</th><td>${asset.type}</td></tr>
<tr><th>Category</th><td>${asset.category}</td></tr>
<tr><th>Lifecycle</th><td>${asset.lifecycle_status}</td></tr>
<tr><th>Business Owner</th><td>${asset.business_owner ?? "—"}</td></tr>
<tr><th>Technical Owner</th><td>${asset.technical_owner ?? "—"}</td></tr>
</tbody></table>
${asset.description ? `<h2>Description</h2><p>${asset.description}</p>` : ""}
${imageBlock}
${asset.notes ? `<h2>Notes</h2><p>${asset.notes}</p>` : ""}
<p><em>Last synced from Pixxel EA Repository.</em></p>`;
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  await setupDatabase();
  const db = getDb();
  const { assetId, pageTitle, parentPageId, diagramPng } = await req.json();

  // Fetch Confluence settings
  const [settingRows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT `key`, `value` FROM app_settings WHERE `key` IN ('confluence.base_url','confluence.api_token','confluence.user_email','confluence.space_key')"
  );
  const cfg: Record<string, string> = {};
  settingRows.forEach((r) => { cfg[r.key] = r.value ?? ""; });

  const baseUrl = cfg["confluence.base_url"]?.replace(/\/$/, "");
  const apiToken = cfg["confluence.api_token"];
  const userEmail = cfg["confluence.user_email"];
  const spaceKey = cfg["confluence.space_key"];

  if (!baseUrl || !apiToken || !userEmail || !spaceKey) {
    return NextResponse.json({ error: "Confluence not configured. Go to Settings → Integrations." }, { status: 400 });
  }

  // Fetch asset
  const [assets] = await db.execute<mysql.RowDataPacket[]>("SELECT * FROM assets WHERE id = ?", [assetId]);
  if (!assets.length) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  const asset = assets[0];

  const confluenceAuth = Buffer.from(`${userEmail}:${apiToken}`).toString("base64");
  const title = pageTitle?.trim() || asset.name;

  // Check if page already exists
  const searchRes = await fetch(
    `${baseUrl}/wiki/rest/api/content?spaceKey=${encodeURIComponent(spaceKey)}&title=${encodeURIComponent(title)}&expand=version`,
    { headers: { Authorization: `Basic ${confluenceAuth}`, Accept: "application/json" } }
  );
  const searchData = await searchRes.json();

  let pageId: string;
  let version: number;
  let confluenceUrl: string;

  if (searchData.results?.length > 0) {
    const existing = searchData.results[0];
    pageId = existing.id;
    version = (existing.version?.number ?? 1) + 1;
    confluenceUrl = `${baseUrl}/wiki/spaces/${spaceKey}/pages/${pageId}`;
  } else {
    // Create page with placeholder body to obtain a page ID for attachment upload
    const payload: Record<string, unknown> = {
      type: "page",
      title,
      space: { key: spaceKey },
      body: { storage: { value: "<p>Syncing from Pixxel…</p>", representation: "storage" } },
    };
    if (parentPageId) payload.ancestors = [{ id: parentPageId }];
    const createRes = await fetch(`${baseUrl}/wiki/rest/api/content`, {
      method: "POST",
      headers: { Authorization: `Basic ${confluenceAuth}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      return NextResponse.json({ error: `Confluence create failed: ${err}` }, { status: 500 });
    }
    const created = await createRes.json();
    pageId = created.id;
    version = 2;
    confluenceUrl = `${baseUrl}/wiki/spaces/${spaceKey}/pages/${pageId}`;
  }

  // Upload diagram attachment (non-fatal on failure)
  let hasImage = false;
  if (diagramPng) {
    hasImage = await uploadAttachment(pageId, diagramPng, confluenceAuth, baseUrl);
  }

  // PUT final body (with or without image)
  const body = buildBody(asset, hasImage);
  const updateRes = await fetch(`${baseUrl}/wiki/rest/api/content/${pageId}`, {
    method: "PUT",
    headers: { Authorization: `Basic ${confluenceAuth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      version: { number: version },
      title,
      type: "page",
      body: { storage: { value: body, representation: "storage" } },
    }),
  });
  if (!updateRes.ok) {
    const err = await updateRes.text();
    return NextResponse.json({ error: `Confluence update failed: ${err}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: confluenceUrl, title });
}
