import { NextResponse } from "next/server";

function backendBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export async function PATCH(req, { params }) {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ ok: false, error: "BadRequest", message: "Missing claim id" }, { status: 400 });
    }

    const payload = await req.json().catch(() => ({}));

    const r = await fetch(`${backendBaseUrl()}/api/claims/${id}/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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
