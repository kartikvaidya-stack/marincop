// frontend/src/app/api/claims/reminders/route.js
import { NextResponse } from "next/server";

export async function GET(req) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backend) {
    return NextResponse.json(
      { ok: false, error: "ProxyError", message: "NEXT_PUBLIC_BACKEND_URL missing" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const days = searchParams.get("days") || "30";

  const url = `${backend.replace(/\/$/, "")}/api/claims/reminders?days=${encodeURIComponent(days)}`;

  try {
    const r = await fetch(url, { cache: "no-store" });
    const text = await r.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "ProxyError", message: "Backend did not return JSON", raw: text.slice(0, 120) },
        { status: 502 }
      );
    }
    return NextResponse.json(json, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "ProxyError", message: e.message },
      { status: 502 }
    );
  }
}
