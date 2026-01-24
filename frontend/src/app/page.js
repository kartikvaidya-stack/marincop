"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function HomePage() {
  const [claims, setClaims] = useState([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const res = await fetch("/api/claims", { cache: "no-store" });
      const json = await res.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      setClaims(rows);
    } catch (e) {
      setClaims([]);
      setErr("Failed to fetch claims.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return claims;
    return claims.filter((c) => {
      const covers = Array.isArray(c.covers) ? c.covers.join(",") : "";
      return (
        String(c.claimNumber || "").toLowerCase().includes(s) ||
        String(c.vesselName || "").toLowerCase().includes(s) ||
        String(c.progressStatus || "").toLowerCase().includes(s) ||
        covers.toLowerCase().includes(s)
      );
    });
  }, [claims, q]);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto", background: "#f6f8fb", minHeight: "100vh" }}>
      {/* Top bar */}
      <div style={{ background: "white", borderBottom: "1px solid #e6eaf2" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Marincop</div>
            <div style={{ fontSize: 12, color: "#556" }}>Nova Carriers • Light UI • Internal tool</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/" style={{ textDecoration: "none", color: "#223", fontWeight: 600 }}>Claims</Link>
            <Link href="/new-claim" style={{ textDecoration: "none", color: "#223" }}>New Claim</Link>
            <Link href="/finance" style={{ textDecoration: "none", color: "#223" }}>Finance</Link>
            <Link href="/reminders" style={{ textDecoration: "none", color: "#223" }}>Reminders</Link>
            <Link href="/insights" style={{ textDecoration: "none", color: "#223" }}>Insights</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Claims Dashboard</div>
            <div style={{ color: "#556", fontSize: 13 }}>Marine insurance case management • templates drafting • finance exposure</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={load} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #d7deea", background: "white", cursor: "pointer" }}>
              Refresh
            </button>
          </div>
        </div>

        {err ? (
          <div style={{ background: "#fff1f1", border: "1px solid #ffd0d0", color: "#900", padding: 12, borderRadius: 12, marginBottom: 12 }}>
            Error: {err}
          </div>
        ) : null}

        <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search claim #, vessel, cover, status…"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #d7deea", outline: "none" }}
            />
            <Link href="/new-claim" style={{ padding: "10px 12px", borderRadius: 10, background: "#0b5cff", color: "white", textDecoration: "none", fontWeight: 700 }}>
              + New Claim
            </Link>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "#556" }}>
                  <th style={{ padding: "10px 8px" }}>Claim #</th>
                  <th style={{ padding: "10px 8px" }}>Vessel</th>
                  <th style={{ padding: "10px 8px" }}>Status</th>
                  <th style={{ padding: "10px 8px" }}>Covers</th>
                  <th style={{ padding: "10px 8px" }}>Cash Out</th>
                  <th style={{ padding: "10px 8px" }}>Recovered</th>
                  <th style={{ padding: "10px 8px" }}>
                    Outstanding<br />Recovery
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 12, color: "#667" }}>No claims found.</td>
                  </tr>
                ) : (
                  filtered.map((c, idx) => {
                    const covers = Array.isArray(c.covers) ? c.covers.join(", ") : "";
                    const cashOut = c.cashOut ?? c.paid ?? 0;
                    const recovered = c.recovered ?? 0;
                    const outstanding = c.outstandingRecovery ?? c.outstanding ?? 0;

                    return (
                      <tr key={c.id} style={{ background: idx % 2 ? "#fbfcff" : "white" }}>
                        <td style={{ padding: "10px 8px", fontWeight: 800 }}>
                          <Link href={`/claims/${c.id}`} style={{ color: "#0b5cff", textDecoration: "none" }}>
                            {c.claimNumber || "—"}
                          </Link>
                        </td>
                        <td style={{ padding: "10px 8px" }}>{c.vesselName || "—"}</td>
                        <td style={{ padding: "10px 8px" }}>{c.progressStatus || "—"}</td>
                        <td style={{ padding: "10px 8px" }}>{covers || "—"}</td>
                        <td style={{ padding: "10px 8px" }}>{money(cashOut)}</td>
                        <td style={{ padding: "10px 8px" }}>{money(recovered)}</td>
                        <td style={{ padding: "10px 8px" }}>{money(outstanding)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#667" }}>
            Tip: Click the claim number to open the claim detail page.
          </div>
        </div>
      </div>
    </div>
  );
}
