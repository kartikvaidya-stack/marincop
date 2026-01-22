import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before") || "";

    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
    const url = `${base}/api/claims/reminders/due${before ? `?before=${encodeURIComponent(before)}` : ""}`;

    const r = await fetch(url, { cache: "no-store" });
    const json = await r.json();
    return NextResponse.json(json, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "ProxyError", message: e.message || "Failed to reach backend" },
      { status: 500 }
    );
  }
}
