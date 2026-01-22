"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function sum(arr, key) {
  return arr.reduce((a, r) => a + Number(r?.[key] || 0), 0);
}

export default function FinancePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [coverFilter, setCoverFilter] = useState("ALL");

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

  const allCoverTypes = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => (r.covers || []).forEach((c) => s.add(c)));
    return ["ALL", ...Array.from(s).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    if (coverFilter === "ALL") return rows;
    return rows.filter((r) => (r.covers || []).includes(coverFilter));
  }, [rows, coverFilter]);

  const totals = useMemo(() => {
    return {
      count: filtered.length,
      reserve: sum(filtered, "reserveEstimated"),
      recovered: sum(filtered, "recovered"),
      outstanding: sum(filtered, "outstanding"),
    };
  }, [filtered]);

  const byCover = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const covers = r.covers?.length ? r.covers : ["Unclassified"];
      covers.forEach((c) => {
        if (!map.has(c)) map.set(c, []);
        map.get(c).push(r);
      });
    });

    return Array.from(map.entries())
      .map(([cover, list]) => ({
        cover,
        count: list.length,
        reserve: sum(list, "reserveEstimated"),
        recovered: sum(list, "recovered"),
        outstanding: sum(list, "outstanding"),
      }))
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [rows]);

  const topOutstanding = useMemo(() => {
    return [...filtered].sort((a, b) => Number(b.outstanding || 0) - Number(a.outstanding || 0)).slice(0, 10);
  }, [filtered]);

  return (
    <div style={{ padding: 24, maxWidth: 1120, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Finance Dashboard</h1>
          <div style={{ color: "#667085", marginTop: 6 }}>
            Exposure overview across claims • reserves, recoveries, outstanding
          </div>
          <div style={{ color: "#98A2B3", marginTop: 4, fontSize: 13 }}>Currency: as entered per claim</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            href="/"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #D0D5DD",
              background: "#FFFFFF",
              fontWeight: 700,
              textDecoration: "none",
              color: "#101828",
            }}
          >
            ← Claims
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

      {/* Filters */}
      <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ color: "#344054", fontWeight: 800 }}>Filter:</div>
        <select
          value={coverFilter}
          onChange={(e) => setCoverFilter(e.target.value)}
          style={{
            padding: "10px 12px",
            border: "1px solid #D0D5DD",
            borderRadius: 10,
            outline: "none",
            background: "#FCFCFD",
            fontWeight: 700,
          }}
        >
          {allCoverTypes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div style={{ marginLeft: "auto", color: "#667085", fontSize: 13 }}>
          Tip: Outstanding = Reserve − Recovered (computed in backend)
        </div>
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
        </div>
      ) : null}

      {/* KPI Cards */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Card title="Claims" value={totals.count} />
        <Card title="Total Reserve" value={money(totals.reserve)} />
        <Card title="Total Recovered" value={money(totals.recovered)} />
        <Card title="Total Outstanding" value={money(totals.outstanding)} />
      </div>

      {/* By Cover */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 12 }}>
        <div style={panel}>
          <div style={panelHeader}>
            <div style={{ fontWeight: 900 }}>By Cover</div>
            <div style={{ color: "#667085", fontSize: 13 }}>All claims grouped by cover type</div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#F9FAFB", color: "#475467" }}>
                <tr>
                  <th style={th}>Cover</th>
                  <th style={thRight}>Claims</th>
                  <th style={thRight}>Reserve</th>
                  <th style={thRight}>Recovered</th>
                  <th style={thRight}>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {byCover.map((r) => (
                  <tr key={r.cover} style={{ borderTop: "1px solid #EAECF0" }}>
                    <td style={td}>{r.cover}</td>
                    <td style={tdRight}>{r.count}</td>
                    <td style={tdRight}>{money(r.reserve)}</td>
                    <td style={tdRight}>{money(r.recovered)}</td>
                    <td style={tdRight}>{money(r.outstanding)}</td>
                  </tr>
                ))}
                {byCover.length === 0 ? (
                  <tr>
                    <td style={{ padding: 16, color: "#667085" }} colSpan={5}>
                      No data.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top outstanding */}
        <div style={panel}>
          <div style={panelHeader}>
            <div style={{ fontWeight: 900 }}>Top Outstanding</div>
            <div style={{ color: "#667085", fontSize: 13 }}>Highest exposure claims</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {topOutstanding.map((c) => (
              <Link
                key={c.id}
                href={`/claims/${c.id}`}
                style={{
                  padding: 12,
                  borderTop: "1px solid #EAECF0",
                  textDecoration: "none",
                  color: "#101828",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 140, fontWeight: 900, color: "#1570EF" }}>{c.claimNumber}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{c.vesselName || "—"}</div>
                  <div style={{ color: "#667085", fontSize: 12 }}>{(c.covers || []).join(", ") || "—"}</div>
                </div>
                <div style={{ fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{money(c.outstanding)}</div>
              </Link>
            ))}
            {topOutstanding.length === 0 ? (
              <div style={{ padding: 14, color: "#667085" }}>No claims match this filter.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div
      style={{
        padding: 14,
        border: "1px solid #EAECF0",
        borderRadius: 12,
        background: "#FFFFFF",
      }}
    >
      <div style={{ color: "#667085", fontWeight: 800, fontSize: 13 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 950, color: "#101828" }}>{value}</div>
    </div>
  );
}

const panel = {
  border: "1px solid #EAECF0",
  borderRadius: 12,
  background: "#FFFFFF",
  overflow: "hidden",
};

const panelHeader = {
  padding: 14,
  borderBottom: "1px solid #EAECF0",
};

const th = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 900,
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
