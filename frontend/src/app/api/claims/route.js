import { NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

function backendUrl(path) {
  if (!BACKEND) throw new Error("NEXT_PUBLIC_BACKEND_URL missing");
  const base = BACKEND.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function json(data, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

// GET /api/claims  -> proxy to backend /api/claims
export async function GET() {
  try {
    const r = await fetch(backendUrl("/api/claims"), { cache: "no-store" });
    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return json({ ok: false, error: "ProxyError", message: e?.message || "Failed to fetch" }, 500);
  }
}

// POST /api/claims  -> proxy to backend POST /api/claims
export async function POST(req) {
  try {
    const body = await req.json();

    const r = await fetch(backendUrl("/api/claims"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return json({ ok: false, error: "ProxyError", message: e?.message || "Failed to create claim" }, 500);
  }
}
