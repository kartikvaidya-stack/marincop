"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(x) {
  const v = n(x);
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function FinancePage() {
  const [claims, setClaims] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/claims", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`);
      setClaims(Array.isArray(j.data) ? j.data : []);
    } catch (e) {
      setErr(e.message || "Failed to load finance");
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    let reserve = 0,
      cashOut = 0,
      deductible = 0,
      recoverableExpected = 0,
      recovered = 0,
      outstandingRecovery = 0;

    const list = Array.isArray(claims) ? claims : [];

    for (const c of list) {
      const fin = c.finance || {};

      const r = n(c.reserveEstimated ?? fin.reserveEstimated);
      const co = n(c.cashOut ?? c.paid ?? fin.cashOut ?? fin.paid);
      const ded = n(c.deductible ?? fin.deductible);
      const recExp = n(
        c.recoverableExpected ??
          c.recoverable ??
          fin.recoverableExpected ??
          fin.recoverable ??
          Math.max(0, co - ded)
      );
      const recd = n(c.recovered ?? fin.recovered);
      const out = n(
        c.outstandingRecovery ??
          c.outstanding ??
          fin.outstandingRecovery ??
          fin.outstanding ??
          Math.max(0, recExp - recd)
      );

      reserve += r;
      cashOut += co;
      deductible += ded;
      recoverableExpected += recExp;
      recovered += recd;
      outstandingRecovery += out;
    }

    return { reserve, cashOut, deductible, recoverableExpected, recovered, outstandingRecovery };
  }, [claims]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Finance</h1>
            <div style={{ color: "#556", fontSize: 13, marginTop: 4 }}>
              Cash-out, recoverable expected, recovered, and outstanding recovery across all claims.
            </div>
          </div>

          <button
            onClick={load}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        {err ? (
          <div style={{ marginTop: 14, padding: 12, background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 12 }}>
            <b style={{ color: "#9f1239" }}>Error:</b> {err}
          </div>
        ) : null}

        {loading ? <div style={{ marginTop: 14, color: "#666" }}>Loading...</div> : null}

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <Card title="Cash Out (Owner paid)" value={money(totals.cashOut)} />
          <Card title="Recoverable Expected" value={money(totals.recoverableExpected)} />
          <Card title="Recovered" value={money(totals.recovered)} />
          <Card title="Outstanding Recovery" value={money(totals.outstandingRecovery)} />
          <Card title="Deductible Total" value={money(totals.deductible)} />
          <Card title="Reserve (reference)" value={money(totals.reserve)} />
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #eee", background: "#fafafa" }}>
              <b>Claims</b>
            </div>

            <div style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#555", fontSize: 12 }}>
                    <th style={th}>Claim #</th>
                    <th style={th}>Vessel</th>
                    <th style={th}>Cash Out</th>
                    <th style={th}>Recoverable Expected</th>
                    <th style={th}>Recovered</th>
                    <th style={th}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(claims) ? claims : []).map((c, idx) => {
                    const fin = c.finance || {};
                    const co = n(c.cashOut ?? c.paid ?? fin.cashOut ?? fin.paid);
                    const ded = n(c.deductible ?? fin.deductible);
                    const recExp = n(
                      c.recoverableExpected ??
                        c.recoverable ??
                        fin.recoverableExpected ??
                        fin.recoverable ??
                        Math.max(0, co - ded)
                    );
                    const recd = n(c.recovered ?? fin.recovered);
                    const out = n(
                      c.outstandingRecovery ??
                        c.outstanding ??
                        fin.outstandingRecovery ??
                        fin.outstanding ??
                        Math.max(0, recExp - recd)
                    );

                    return (
                      <tr key={c.id || idx} style={{ borderTop: "1px solid #f2f2f2" }}>
                        <td style={td}>
                          <Link href={`/claims/${c.id}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                            {c.claimNumber || c.id}
                          </Link>
                        </td>
                        <td style={td}>{c.vesselName || fin.vesselName || "-"}</td>
                        <td style={td}>{money(co)}</td>
                        <td style={td}>{money(recExp)}</td>
                        <td style={td}>{money(recd)}</td>
                        <td style={td}>{money(out)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {Array.isArray(claims) && claims.length === 0 ? (
                <div style={{ padding: 12, color: "#666" }}>No claims found.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <Link href="/" style={{ color: "#0b5" }}>Back to claims</Link>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
      <div style={{ color: "#666", fontSize: 12 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const th = { padding: "10px 12px", whiteSpace: "nowrap" };
const td = { padding: "10px 12px", verticalAlign: "top" };
