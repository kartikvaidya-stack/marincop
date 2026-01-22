import { NextResponse } from "next/server";

async function readJsonSafe(res) {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  // If server responded with JSON, parse it
  if (ct.includes("application/json")) {
    try {
      return { ok: true, json: JSON.parse(text) };
    } catch {
      return { ok: false, error: "BadJSON", message: "Backend returned invalid JSON." };
    }
  }

  // Non-JSON response (HTML/text)
  return {
    ok: false,
    error: "NonJSON",
    message: "Backend did not return JSON (likely wrong backend URL or backend is down).",
    preview: text.slice(0, 120),
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before") || "";

    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
    const url = `${base}/api/claims/reminders/due${before ? `?before=${encodeURIComponent(before)}` : ""}`;

    const r = await fetch(url, { cache: "no-store" });

    const parsed = await readJsonSafe(r);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error, message: parsed.message, preview: parsed.preview || null },
        { status: 502 }
      );
    }

    // Forward backend JSON as-is
    return NextResponse.json(parsed.json, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "ProxyError", message: e.message || "Failed to reach backend" },
      { status: 500 }
    );
  }
}
