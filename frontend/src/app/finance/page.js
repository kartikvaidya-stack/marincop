"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function FinancePage() {
  const [claims, setClaims] = useState([]); // ALWAYS keep as array
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

  const totals = useMemo(() => {
    const rows = Array.isArray(claims) ? claims : []; // guard
    let reserve = 0,
      cashOut = 0,
      recoverableExpected = 0,
      recovered = 0,
      outstandingRecovery = 0;

    for (const c of rows) {
      const r = Number(c.reserveEstimated || 0);
      const co = Number(c.cashOut ?? c.paid ?? 0);
      const ded = Number(c.deductible || 0);
      const recExp = Number(
        c.recoverableExpected ??
          c.recoverable ??
          Math.max(0, co - ded)
      );
      const rec = Number(c.recovered || 0);
      const out = Number(
        c.outstandingRecovery ??
          c.outstanding ??
          Math.max(0, recExp - rec)
      );

      reserve += r;
      cashOut += co;
      recoverableExpected += recExp;
      recovered += rec;
      outstandingRecovery += out;
    }

    return { reserve, cashOut, recoverableExpected, recovered, outstandingRecovery };
  }, [claims]);

  const rows = Array.isArray(claims) ? claims : [];

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
        background: "#f6f8fb",
        minHeight: "100vh",
      }}
    >
      {/* Top bar */}
      <div style={{ background: "white", borderBottom: "1px solid #e6eaf2" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Marincop</div>
            <div style={{ fontSize: 12, color: "#556" }}>Nova Carriers</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/" style={{ textDecoration: "none", color: "#223" }}>
              Claims
            </Link>
            <Link
              href="/finance"
              style={{ textDecoration: "none", color: "#223", fontWeight: 700 }}
            >
              Finance
            </Link>
            <Link href="/reminders" style={{ textDecoration: "none", color: "#223" }}>
              Reminders
            </Link>
            <Link href="/insights" style={{ textDecoration: "none", color: "#223" }}>
              Insights
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Finance</div>
            <div style={{ color: "#556", fontSize: 13 }}>
              Exposure & recovery tracking (Owner view)
            </div>
          </div>
          <button
            onClick={load}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #d7deea",
              background: "white",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        {err ? (
          <div
            style={{
              background: "#fff1f1",
              border: "1px solid #ffd0d0",
              color: "#900",
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            Error: {err}
          </div>
        ) : null}

        {/* Totals cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#556" }}>Reserve</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{money(totals.reserve)}</div>
          </div>
          <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#556" }}>Cash Out</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{money(totals.cashOut)}</div>
          </div>
          <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#556" }}>Recoverable Expected</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{money(totals.recoverableExpected)}</div>
          </div>
          <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#556" }}>Recovered</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{money(totals.recovered)}</div>
          </div>
          <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#556" }}>Outstanding</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{money(totals.outstandingRecovery)}</div>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 12 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "#556" }}>
                  <th style={{ padding: "10px 8px" }}>Claim #</th>
                  <th style={{ padding: "10px 8px" }}>Vessel</th>
                  <th style={{ padding: "10px 8px" }}>Covers</th>
                  <th style={{ padding: "10px 8px" }}>Reserve</th>
                  <th style={{ padding: "10px 8px" }}>Cash Out</th>
                  <th style={{ padding: "10px 8px" }}>Recoverable</th>
                  <th style={{ padding: "10px 8px" }}>Recovered</th>
                  <th style={{ padding: "10px 8px" }}>
                    Outstanding<br />Recovery
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 12, color: "#667" }}>
                      No claims found.
                    </td>
                  </tr>
                ) : (
                  rows.map((c, idx) => {
                    const covers = Array.isArray(c.covers) ? c.covers.join(", ") : "—";
                    const co = Number(c.cashOut ?? c.paid ?? 0);
                    const recExp = Number(c.recoverableExpected ?? c.recoverable ?? Math.max(0, co - Number(c.deductible || 0)));
                    const rec = Number(c.recovered || 0);
                    const out = Number(c.outstandingRecovery ?? c.outstanding ?? Math.max(0, recExp - rec));

                    return (
                      <tr key={c.id} style={{ background: idx % 2 ? "#fbfcff" : "white" }}>
                        <td style={{ padding: "10px 8px", fontWeight: 800 }}>
                          <Link href={`/claims/${c.id}`} style={{ color: "#0b5cff", textDecoration: "none" }}>
                            {c.claimNumber || "—"}
                          </Link>
                        </td>
                        <td style={{ padding: "10px 8px" }}>{c.vesselName || "—"}</td>
                        <td style={{ padding: "10px 8px" }}>{covers}</td>
                        <td style={{ padding: "10px 8px" }}>{money(c.reserveEstimated || 0)}</td>
                        <td style={{ padding: "10px 8px" }}>{money(co)}</td>
                        <td style={{ padding: "10px 8px" }}>{money(recExp)}</td>
                        <td style={{ padding: "10px 8px" }}>{money(rec)}</td>
                        <td style={{ padding: "10px 8px" }}>{money(out)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
