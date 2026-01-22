import { NextResponse } from "next/server";

function backendBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

// Robust: get the last path segment as the id
function extractIdFromUrl(req) {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // ... /api/claims/<id>
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

export async function GET(req) {
  try {
    const id = extractIdFromUrl(req);

    if (!id || id === "claims") {
      return NextResponse.json({ ok: false, error: "BadRequest", message: "Missing claim id" }, { status: 400 });
    }

    const r = await fetch(`${backendBaseUrl()}/api/claims/${id}`, { cache: "no-store" });
    const data = await r.json().catch(() => null);

    if (!r.ok || !data) {
      return NextResponse.json(
        { ok: false, error: "UpstreamError", message: data?.message || `Upstream failed (HTTP ${r.status})` },
        { status: r.status || 502 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "ServerError", message: e?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
