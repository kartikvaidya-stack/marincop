"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function sum(arr, fn) {
  return arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0);
}
function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function InsightsPage() {
  const [claims, setClaims] = useState([]);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const res = await fetch("/api/claims", { cache: "no-store" });
      const json = await res.json();
      setClaims(Array.isArray(json?.data) ? json.data : []);
    } catch {
      setClaims([]);
      setErr("Failed to fetch claims.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    const cashOut = sum(claims, (c) => c.cashOut ?? c.paid ?? 0);
    const recovered = sum(claims, (c) => c.recovered ?? 0);
    const outstanding = sum(claims, (c) => c.outstandingRecovery ?? c.outstanding ?? 0);

    const coverCounts = {};
    for (const c of claims) {
      const covers = Array.isArray(c.covers) ? c.covers : [];
      covers.forEach((cv) => (coverCounts[cv] = (coverCounts[cv] || 0) + 1));
    }
    const topCover = Object.entries(coverCounts).sort((a, b) => b[1] - a[1])[0];

    const largest = [...claims].sort((a, b) => (b.cashOut ?? b.paid ?? 0) - (a.cashOut ?? a.paid ?? 0))[0] || null;

    const byVessel = {};
    for (const c of claims) {
      const v = c.vesselName || "—";
      const vCash = Number(c.cashOut ?? c.paid ?? 0) || 0;
      byVessel[v] = (byVessel[v] || 0) + vCash;
    }
    const topVessel = Object.entries(byVessel).sort((a, b) => b[1] - a[1])[0];

    return { cashOut, recovered, outstanding, topCover, largest, topVessel };
  }, [claims]);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto", background: "#f6f8fb", minHeight: "100vh" }}>
      <div style={{ background: "white", borderBottom: "1px solid #e6eaf2" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 16px", display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Marincop</div>
            <div style={{ fontSize: 12, color: "#556" }}>Nova Carriers</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/" style={{ textDecoration: "none", color: "#223", fontWeight: 600 }}>Claims</Link>
            <Link href="/finance" style={{ textDecoration: "none", color: "#223" }}>Finance</Link>
            <Link href="/reminders" style={{ textDecoration: "none", color: "#223" }}>Reminders</Link>
            <Link href="/insights" style={{ textDecoration: "none", color: "#223", fontWeight: 700 }}>Insights</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Insights</div>
            <div style={{ color: "#556", fontSize: 13 }}>Portfolio view of claims, cash-out and recovery</div>
          </div>
          <button onClick={load} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #d7deea", background: "white", cursor: "pointer" }}>
            Refresh
          </button>
        </div>

        {err ? (
          <div style={{ background: "#fff1f1", border: "1px solid #ffd0d0", color: "#900", padding: 12, borderRadius: 12 }}>
            Error: {err}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
          <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#556" }}>Total Cash Out</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{money(metrics.cashOut)}</div>
          </div>
          <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#556" }}>Total Recovered</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{money(metrics.recovered)}</div>
          </div>
          <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#556" }}>Outstanding Recovery</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{money(metrics.outstanding)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Highlights</div>
            <div style={{ color: "#334", fontSize: 13, lineHeight: 1.6 }}>
              <div><b>Most common cover:</b> {metrics.topCover ? `${metrics.topCover[0]} (${metrics.topCover[1]})` : "—"}</div>
              <div><b>Vessel with highest cash-out:</b> {metrics.topVessel ? `${metrics.topVessel[0]} (${money(metrics.topVessel[1])})` : "—"}</div>
              <div><b>Largest single claim:</b> {metrics.largest ? `${metrics.largest.claimNumber} (${metrics.largest.vesselName || "—"})` : "—"}</div>
            </div>
          </div>

          <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Largest claim (quick link)</div>
            {metrics.largest ? (
              <Link href={`/claims/${metrics.largest.id}`} style={{ textDecoration: "none", color: "#0b5cff", fontWeight: 900 }}>
                Open {metrics.largest.claimNumber}
              </Link>
            ) : (
              <div style={{ color: "#667" }}>No claims yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
