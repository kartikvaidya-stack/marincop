"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function groupCount(items, keyFn) {
  const m = new Map();
  items.forEach((it) => {
    const k = keyFn(it);
    m.set(k, (m.get(k) || 0) + 1);
  });
  return Array.from(m.entries())
    .map(([k, v]) => ({ key: k, count: v }))
    .sort((a, b) => b.count - a.count);
}

function groupSum(items, keyFn, sumKey) {
  const m = new Map();
  items.forEach((it) => {
    const k = keyFn(it);
    m.set(k, (m.get(k) || 0) + Number(it?.[sumKey] || 0));
  });
  return Array.from(m.entries())
    .map(([k, v]) => ({ key: k, sum: v }))
    .sort((a, b) => b.sum - a.sum);
}

export default function InsightsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/claims", { cache: "no-store" });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.message || data?.error || `Failed (HTTP ${r.status})`);
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

  const totals = useMemo(() => {
    const reserve = rows.reduce((a, r) => a + Number(r.reserveEstimated || 0), 0);
    const recovered = rows.reduce((a, r) => a + Number(r.recovered || 0), 0);
    const outstanding = rows.reduce((a, r) => a + Number(r.outstanding || 0), 0);
    return { count: rows.length, reserve, recovered, outstanding };
  }, [rows]);

  const coverCounts = useMemo(() => {
    // each claim can have multiple covers; count each occurrence
    const flat = [];
    rows.forEach((r) => {
      const covers = r.covers?.length ? r.covers : ["Unclassified"];
      covers.forEach((c) => flat.push({ cover: c }));
    });
    return groupCount(flat, (x) => x.cover);
  }, [rows]);

  const statusCounts = useMemo(() => {
    return groupCount(rows, (r) => r.progressStatus || "—");
  }, [rows]);

  const topVessels = useMemo(() => {
    return groupSum(rows, (r) => r.vesselName || "—", "outstanding").slice(0, 8);
  }, [rows]);

  const narrative = useMemo(() => {
    if (!rows.length) return "No claims found. Create a claim from a first notification to begin tracking.";
    const topCover = coverCounts[0]?.key;
    const topStatus = statusCounts[0]?.key;
    const topVessel = topVessels[0]?.key;
    const topVesselOut = topVessels[0]?.sum || 0;

    const lines = [];
    lines.push(
      `You currently have ${rows.length} open/recorded claims with total outstanding exposure of ${money(
        totals.outstanding
      )}.`
    );
    if (topCover) lines.push(`Most frequent cover type: ${topCover}.`);
    if (topStatus) lines.push(`Most common progress status: ${topStatus}.`);
    if (topVessel && topVessel !== "—")
      lines.push(`Highest vessel exposure: ${topVessel} (${money(topVesselOut)} outstanding).`);
    lines.push("Next best action: ensure reminders are set for surveys, correspondents, and settlement follow-ups.");
    return lines.join(" ");
  }, [rows, coverCounts, statusCounts, topVessels, totals.outstanding]);

  return (
    <div style={{ padding: 24, maxWidth: 1120, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Insights</h1>
          <div style={{ color: "#667085", marginTop: 6 }}>Portfolio view • patterns • exposure drivers</div>
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

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Card title="Claims" value={totals.count} />
        <Card title="Reserve (sum)" value={money(totals.reserve)} />
        <Card title="Recovered (sum)" value={money(totals.recovered)} />
        <Card title="Outstanding (sum)" value={money(totals.outstanding)} />
      </div>

      <div style={{ marginTop: 12, ...panel }}>
        <div style={panelHeader}>
          <div style={{ fontWeight: 950 }}>Executive Summary</div>
          <div style={{ color: "#667085", fontSize: 13 }}>Auto-generated narrative (rules-based for now)</div>
        </div>
        <div style={{ padding: 14, color: "#101828", lineHeight: 1.5 }}>{narrative}</div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={panel}>
          <div style={panelHeader}>
            <div style={{ fontWeight: 950 }}>Cover Types</div>
            <div style={{ color: "#667085", fontSize: 13 }}>Frequency across claims (multi-cover counted)</div>
          </div>
          <SimpleTable
            rows={coverCounts.map((r) => ({ a: r.key, b: r.count }))}
            aHead="Cover"
            bHead="Count"
          />
        </div>

        <div style={panel}>
          <div style={panelHeader}>
            <div style={{ fontWeight: 950 }}>Progress Status</div>
            <div style={{ color: "#667085", fontSize: 13 }}>Where claims are stuck</div>
          </div>
          <SimpleTable
            rows={statusCounts.map((r) => ({ a: r.key, b: r.count }))}
            aHead="Status"
            bHead="Count"
          />
        </div>
      </div>

      <div style={{ marginTop: 12, ...panel }}>
        <div style={panelHeader}>
          <div style={{ fontWeight: 950 }}>Top Vessels by Outstanding</div>
          <div style={{ color: "#667085", fontSize: 13 }}>Exposure concentration</div>
        </div>
        <SimpleTable
          rows={topVessels.map((r) => ({ a: r.key, b: money(r.sum) }))}
          aHead="Vessel"
          bHead="Outstanding"
          bAlignRight
        />
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

function SimpleTable({ rows, aHead, bHead, bAlignRight }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#F9FAFB", color: "#475467" }}>
          <tr>
            <th style={th}>{aHead}</th>
            <th style={{ ...th, textAlign: bAlignRight ? "right" : "left" }}>{bHead}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} style={{ borderTop: "1px solid #EAECF0" }}>
              <td style={td}>{r.a}</td>
              <td style={{ ...td, textAlign: bAlignRight ? "right" : "left", fontVariantNumeric: "tabular-nums" }}>
                {r.b}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td style={{ padding: 14, color: "#667085" }} colSpan={2}>
                No data.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
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

const td = {
  padding: "12px",
  fontSize: 14,
  color: "#101828",
};
