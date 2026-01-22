// frontend/src/app/page.js
"use client";

import { useEffect, useMemo, useState } from "react";

export default function Page() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  async function loadClaims() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/claims`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Failed to load claims");
      setClaims(json.data || []);
    } catch (e) {
      setErr(e.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClaims();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return claims;
    return claims.filter((c) => {
      const hay = [
        c.claimNumber,
        c.vesselName,
        c.progressStatus,
        ...(c.covers || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [claims, q]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.h1}>Open Claims</div>
            <div style={styles.sub}>
              View exposure and progress. Click “Refresh” after updates.
            </div>
          </div>

          <div style={styles.actionsRow}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search claim #, vessel, cover, status…"
              style={styles.search}
            />
            <button onClick={loadClaims} style={styles.btn}>
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div style={styles.state}>Loading…</div>
        ) : err ? (
          <div style={{ ...styles.state, color: "#9B1C1C" }}>
            Error: {err}
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.state}>No claims found.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Claim #</th>
                  <th style={styles.th}>Vessel</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Covers</th>
                  <th style={styles.thRight}>Reserve</th>
                  <th style={styles.thRight}>Recovered</th>
                  <th style={styles.thRight}>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} style={styles.tr}>
                    <td style={styles.tdMono}>
                      <a href={`/claims/${c.id}`} style={styles.link}>
                        {c.claimNumber}
                      </a>
                    </td>
                    <td style={styles.td}>{c.vesselName || "-"}</td>
                    <td style={styles.td}>
                      <span style={styles.badge}>{c.progressStatus}</span>
                    </td>
                    <td style={styles.td}>
                      {(c.covers || []).length ? (c.covers || []).join(", ") : "-"}
                    </td>
                    <td style={styles.tdRight}>{fmt(c.reserveEstimated)}</td>
                    <td style={styles.tdRight}>{fmt(c.recovered)}</td>
                    <td style={styles.tdRight}>{fmt(c.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={styles.note}>
        Click a claim number to open details.
      </div>
    </div>
  );
}

function fmt(n) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const styles = {
  page: { display: "grid", gap: 14 },
  card: {
    background: "#FFFFFF",
    border: "1px solid #E6EAF2",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 1px 0 rgba(10,20,40,0.03)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  h1: { fontSize: 16, fontWeight: 800 },
  sub: { marginTop: 4, fontSize: 12, color: "#51607A" },
  actionsRow: { display: "flex", gap: 10, alignItems: "center" },
  search: {
    width: 280,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E6EAF2",
    outline: "none",
    background: "#FBFCFE",
  },
  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #D9E6FF",
    background: "#EEF4FF",
    fontWeight: 700,
    cursor: "pointer",
  },
  state: {
    padding: 14,
    background: "#FBFCFE",
    border: "1px solid #EEF1F6",
    borderRadius: 14,
    color: "#51607A",
    fontSize: 13,
  },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: "#51607A",
    padding: "10px 10px",
    borderBottom: "1px solid #EEF1F6",
  },
  thRight: {
    textAlign: "right",
    fontSize: 12,
    color: "#51607A",
    padding: "10px 10px",
    borderBottom: "1px solid #EEF1F6",
  },
  tr: { borderBottom: "1px solid #EEF1F6" },
  td: { padding: "12px 10px", fontSize: 13, borderBottom: "1px solid #F2F5FA" },
  tdMono: {
    padding: "12px 10px",
    fontSize: 13,
    borderBottom: "1px solid #F2F5FA",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  tdRight: {
    padding: "12px 10px",
    fontSize: 13,
    borderBottom: "1px solid #F2F5FA",
    textAlign: "right",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#F1F6FF",
    border: "1px solid #D9E6FF",
    color: "#1F3B77",
    fontSize: 12,
    fontWeight: 700,
  },
  link: { color: "#1F3B77", textDecoration: "none", fontWeight: 800 },
  note: { fontSize: 12, color: "#7A879D", paddingLeft: 6 },
};
