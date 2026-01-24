import { NextResponse } from "next/server";

function backendBase() {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL || // fallback only
    "http://localhost:3001"
  );
}

export async function GET() {
  try {
    const url = `${backendBase().replace(/\/$/, "")}/api/claims/reminders/due`;
    const r = await fetch(url, { cache: "no-store" });
    const text = await r.text();

    // backend should return json; guard anyway
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: r.status });
    } catch {
      return NextResponse.json(
        { ok: false, error: "BadGateway", message: "Backend returned non-JSON", raw: text },
        { status: 502 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "FetchError", message: e?.message || "Failed to reach backend" },
      { status: 502 }
    );
  }
}
