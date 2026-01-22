import { NextResponse } from "next/server";

function baseUrl() {
  const raw = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function readJsonSafe(res) {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  if (ct.includes("application/json")) {
    try {
      return { ok: true, json: JSON.parse(text) };
    } catch {
      return { ok: false, error: "BadJSON", message: "Backend returned invalid JSON." };
    }
  }

  return {
    ok: false,
    error: "NonJSON",
    message:
      "Backend did not return JSON. This usually means NEXT_PUBLIC_BACKEND_URL is wrong or backend is unreachable.",
    preview: text.slice(0, 160),
  };
}

export async function GET() {
  try {
    const url = `${baseUrl()}/api/claims`;
    const r = await fetch(url, { cache: "no-store" });

    const parsed = await readJsonSafe(r);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error, message: parsed.message, preview: parsed.preview || null },
        { status: 502 }
      );
    }
    return NextResponse.json(parsed.json, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "ProxyError", message: e.message || "Failed to reach backend" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const url = `${baseUrl()}/api/claims`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const parsed = await readJsonSafe(r);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error, message: parsed.message, preview: parsed.preview || null },
        { status: 502 }
      );
    }
    return NextResponse.json(parsed.json, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "ProxyError", message: e.message || "Failed to proxy request" },
      { status: 500 }
    );
  }
}
