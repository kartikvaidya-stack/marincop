import { NextResponse } from "next/server";

function backendBase() {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL || // fallback only
    "http://localhost:3001"
  );
}

function num(x) {
  const n = Number(x || 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  try {
    const url = `${backendBase().replace(/\/$/, "")}/api/claims`;
    const r = await fetch(url, { cache: "no-store" });
    const text = await r.text();

    let j;
    try {
      j = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "BadGateway", message: "Backend returned non-JSON", raw: text },
        { status: 502 }
      );
    }

    if (!r.ok || !j.ok) {
      return NextResponse.json(j, { status: r.status });
    }

    // Ensure consistent finance numbers for frontend
    const data = (j.data || []).map((c) => {
      const cashOut = num(c.cashOut ?? c.paid ?? c.finance?.cashOut ?? c.finance?.paid ?? 0);
      const deductible = num(c.deductible ?? c.finance?.deductible ?? 0);
      const recovered = num(c.recovered ?? c.finance?.recovered ?? 0);

      const recoverableExpected = Math.max(0, cashOut - deductible);
      const outstandingRecovery = Math.max(0, recoverableExpected - recovered);

      return {
        ...c,
        cashOut,
        deductible,
        recovered,
        recoverableExpected,
        outstandingRecovery,
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "FetchError", message: e?.message || "Failed to reach backend" },
      { status: 502 }
    );
  }
}
