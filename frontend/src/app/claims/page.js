"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

async function apiGet(url) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json: j };
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = (q || "").toLowerCase().trim();
    if (!s) return claims;
    return claims.filter((c) => {
      const covers = Array.isArray(c.covers) ? c.covers.join(",") : "";
      return (
        String(c.claimNumber || "").toLowerCase().includes(s) ||
        String(c.vesselName || "").toLowerCase().includes(s) ||
        String(c.progressStatus || "").toLowerCase().includes(s) ||
        String(covers).toLowerCase().includes(s)
      );
    });
  }, [claims, q]);

  async function refresh() {
    setLoading(true);
    setErr("");
    const r = await apiGet("/api/claims");
    if (!r.ok) {
      setErr(r.json?.message || `Failed to load claims (HTTP ${r.status})`);
      setClaims([]);
      setLoading(false);
      return;
    }
    setClaims(r.json?.data || []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", background: "#f7f9fc", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Claims Dashboard</div>
          <div style={{ color: "#5b6b86", marginTop: 4 }}>
            Marine insurance case management • templates drafting • finance exposure
          </div>
        </div>
        <Link
          href="/new"
          style={{
            border: "1px solid #d9e2ef",
            background: "#eaf1ff",
            padding: "10px 12px",
            borderRadius: 12,
            textDecoration: "none",
            fontWeight: 700,
            color: "#1c2b4a",
          }}
        >
          + New Claim
        </Link>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search claim #, vessel, cover, status…"
          style={{
            flex: "1 1 320px",
            padding: 10,
            borderRadius: 12,
            border: "1px solid #d9e2ef",
            background: "white",
          }}
        />
        <button
          onClick={refresh}
          style={{
            border: "1px solid #d9e2ef",
            background: "white",
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#5b6b86" }}>
        Environment: {process.env.NEXT_PUBLIC_BACKEND_URL ? "Live" : "Local"}
      </div>

      {err ? (
        <div style={{ marginTop: 12, color: "#b00020", background: "#fff1f1", border: "1px solid #ffd1d1", padding: 10, borderRadius: 12 }}>
          Error: {err}
        </div>
      ) : null}

      <div style={{ marginTop: 16, background: "white", border: "1px solid #e6edf7", borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>Open Claims</div>
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#5b6b86" }}>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eef3fb" }}>Claim #</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eef3fb" }}>Vessel</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eef3fb" }}>Status</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eef3fb" }}>Covers</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eef3fb" }}>Reserve</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eef3fb" }}>Recovered</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eef3fb" }}>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, color: "#5b6b86" }}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, color: "#5b6b86" }}>
                    No claims found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f6fb" }}>
                      <Link href={`/claims/${c.id}`} style={{ color: "#1b5cff", textDecoration: "none", fontWeight: 800 }}>
                        {c.claimNumber}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f6fb" }}>{c.vesselName || "—"}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f6fb" }}>{c.progressStatus || "—"}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f6fb" }}>
                      {Array.isArray(c.covers) ? c.covers.join(", ") : "—"}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f6fb" }}>{money(c.reserveEstimated)}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f6fb" }}>{money(c.recovered)}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f6fb" }}>{money(c.outstanding)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#5b6b86" }}>
          Tip: Click the claim number to open the claim detail page.
        </div>
      </div>
    </div>
  );
}
