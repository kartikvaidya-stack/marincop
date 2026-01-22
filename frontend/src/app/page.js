"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function HomePage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/claims", { cache: "no-store" });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.message || data?.error || `Failed (HTTP ${r.status})`);
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      setErr(e?.message || "Failed to fetch claims");
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
    return rows.filter((c) => {
      const claimNumber = (c.claimNumber || "").toLowerCase();
      const vessel = (c.vesselName || "").toLowerCase();
      const status = (c.progressStatus || "").toLowerCase();
      const covers = (c.covers || []).join(",").toLowerCase();
      return (
        claimNumber.includes(s) ||
        vessel.includes(s) ||
        status.includes(s) ||
        covers.includes(s)
      );
    });
  }, [rows, q]);

  return (
    <div style={{ padding: 24, maxWidth: 1120, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Claims Dashboard</h1>
          <div style={{ color: "#667085", marginTop: 6 }}>
            Marine insurance case management • templates drafting • finance exposure
          </div>
        </div>

        <Link
          href="/new-claim"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#1570EF",
            color: "white",
            fontWeight: 900,
            textDecoration: "none",
            border: "1px solid #175CD3",
          }}
        >
          + New Claim
        </Link>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
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

        <button
          onClick={load}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #D0D5DD",
            background: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 14, color: "#667085", fontSize: 13 }}>
        Environment: <b>Live</b>
      </div>

      {err ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            background: "#FEF3F2",
            border: "1px solid #FDA29B",
            color: "#B42318",
            fontWeight: 900,
          }}
        >
          Error: {err}
        </div>
      ) : null}

      <div style={{ marginTop: 12, border: "1px solid #EAECF0", borderRadius: 12, overflow: "hidden", background: "white" }}>
        <div style={{ padding: 14, borderBottom: "1px solid #EAECF0", fontWeight: 950 }}>
          Open Claims
        </div>

        {loading ? (
          <div style={{ padding: 14, color: "#667085" }}>Loading…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FCFCFD", borderBottom: "1px solid #EAECF0" }}>
                <Th>Claim #</Th>
                <Th>Vessel</Th>
                <Th>Status</Th>
                <Th>Covers</Th>
                <Th align="right">Reserve</Th>
                <Th align="right">Recovered</Th>
                <Th align="right">Outstanding</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #EAECF0" }}>
                  <Td>
                    {/* IMPORTANT: link by UUID id (NOT claimNumber) */}
                    <Link
                      href={`/claims/${c.id}`}
                      style={{ fontWeight: 950, color: "#1570EF", textDecoration: "none" }}
                    >
                      {c.claimNumber}
                    </Link>
                  </Td>
                  <Td>{c.vesselName || "—"}</Td>
                  <Td>{c.progressStatus || "—"}</Td>
                  <Td>{(c.covers || []).join(", ") || "—"}</Td>
                  <Td align="right">{money(c.reserveEstimated || 0)}</Td>
                  <Td align="right">{money(c.recovered || 0)}</Td>
                  <Td align="right">{money(c.outstanding || 0)}</Td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <Td colSpan={7} style={{ color: "#667085" }}>
                    No claims found.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 10, color: "#98A2B3", fontSize: 12 }}>
        Tip: Click the <b>claim number</b> to open the claim detail page.
      </div>
    </div>
  );
}

function Th({ children, align }) {
  return (
    <th
      style={{
        textAlign: align || "left",
        padding: 12,
        fontSize: 12,
        color: "#667085",
        fontWeight: 900,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align, colSpan, style }) {
  return (
    <td
      colSpan={colSpan}
      style={{
        textAlign: align || "left",
        padding: 12,
        fontSize: 13,
        color: "#101828",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
