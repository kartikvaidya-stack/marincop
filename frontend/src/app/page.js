"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function HomePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/claims", { cache: "no-store" });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        throw new Error(data?.message || data?.error || `Failed to load claims (HTTP ${r.status})`);
      }
      setRows(data.data || []);
    } catch (e) {
      setErr(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      return (
        (r.claimNumber || "").toLowerCase().includes(s) ||
        (r.vesselName || "").toLowerCase().includes(s) ||
        (r.progressStatus || "").toLowerCase().includes(s) ||
        (r.locationText || "").toLowerCase().includes(s) ||
        (r.covers || []).join(",").toLowerCase().includes(s)
      );
    });
  }, [q, rows]);

  return (
    <div style={{ padding: 24, maxWidth: 1120, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Claims Dashboard</h1>
          <div style={{ color: "#667085", marginTop: 6 }}>
            Marine insurance case management • AI-assisted drafting
          </div>
          <div style={{ color: "#98A2B3", marginTop: 4, fontSize: 13 }}>Environment: Local</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            href="/new-claim"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #175CD3",
              background: "#1570EF",
              color: "#fff",
              fontWeight: 800,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            + New Claim
          </Link>

          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #D0D5DD",
              background: "#FFFFFF",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search claim #, vessel, cover, status…"
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #D0D5DD",
            borderRadius: 10,
            outline: "none",
            background: "#FCFCFD",
          }}
        />
      </div>

      {/* Error */}
      {err ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            background: "#FEF3F2",
            border: "1px solid #FDA29B",
            color: "#B42318",
            fontWeight: 700,
          }}
        >
          Error: {err}
          <div style={{ marginTop: 6, fontWeight: 600, color: "#7A271A" }}>
            If running locally, ensure backend is reachable.
          </div>
        </div>
      ) : null}

      {/* Table */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid #EAECF0",
          borderRadius: 12,
          overflow: "hidden",
          background: "#FFFFFF",
        }}
      >
        <div style={{ padding: 14, borderBottom: "1px solid #EAECF0" }}>
          <div style={{ fontWeight: 800, color: "#101828" }}>Open Claims</div>
          <div style={{ color: "#667085", marginTop: 4, fontSize: 13 }}>
            View exposure and progress. Click a claim number to open details.
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#F9FAFB", color: "#475467" }}>
              <tr>
                <th style={th}>Claim #</th>
                <th style={th}>Vessel</th>
                <th style={th}>Status</th>
                <th style={th}>Covers</th>
                <th style={thRight}>Reserve</th>
                <th style={thRight}>Recovered</th>
                <th style={thRight}>Outstanding</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #EAECF0" }}>
                  <td style={td}>
                    <Link
                      href={`/claims/${r.id}`}
                      style={{ color: "#1570EF", fontWeight: 800, textDecoration: "none" }}
                    >
                      {r.claimNumber}
                    </Link>
                  </td>
                  <td style={td}>{r.vesselName || "—"}</td>
                  <td style={td}>{r.progressStatus || "—"}</td>
                  <td style={td}>{(r.covers || []).join(", ") || "—"}</td>
                  <td style={tdRight}>{money(r.reserveEstimated)}</td>
                  <td style={tdRight}>{money(r.recovered)}</td>
                  <td style={tdRight}>{money(r.outstanding)}</td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td style={{ padding: 16, color: "#667085" }} colSpan={7}>
                    No claims found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 800,
};

const thRight = {
  ...th,
  textAlign: "right",
};

const td = {
  padding: "12px",
  fontSize: 14,
  color: "#101828",
};

const tdRight = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};
