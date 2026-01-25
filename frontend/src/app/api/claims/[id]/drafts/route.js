// frontend/src/app/api/claims/[id]/drafts/route.js
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBase() {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) throw new Error("NEXT_PUBLIC_BACKEND_URL missing");
  return url.replace(/\/+$/, "");
}

function extractIdFromUrl(req) {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // ... /api/claims/<id>/drafts
    // find "drafts" and get the element before it
    const draftsIdx = parts.indexOf("drafts");
    if (draftsIdx > 0) {
      return parts[draftsIdx - 1];
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const claimId = extractIdFromUrl(request);
    if (!claimId) {
      return NextResponse.json(
        { ok: false, error: "BadRequest", message: "Missing claim id" },
        { status: 400 }
      );
    }

    const upstream = `${backendBase()}/api/claims/${claimId}/drafts`;

    let r;
    try {
      r = await fetch(upstream, { cache: "no-store" });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: "ProxyError", message: `Failed to fetch upstream: ${String(e)}` },
        { status: 502 }
      );
    }

    const text = await r.text();

    // Pass-through status + JSON body (or raw text if backend misbehaves)
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: r.status });
    } catch {
      return new NextResponse(text, {
        status: r.status,
        headers: { "content-type": r.headers.get("content-type") || "text/plain" },
      });
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "ServerError", message: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
