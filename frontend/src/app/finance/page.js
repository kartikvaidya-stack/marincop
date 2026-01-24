"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./finance.module.css";

function money(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function FinancePage() {
  const [claims, setClaims] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const res = await fetch("/api/claims", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to load claims");
      setClaims(json.data || []);
    } catch (e) {
      setErr(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    let reserve = 0, cashOut = 0, recoverable = 0, recovered = 0, outstanding = 0;
    for (const c of claims) {
      const r = Number(c.reserveEstimated || 0);
      const co = Number(c.cashOut ?? c.paid ?? 0);
      const recExp = Number(c.recoverableExpected ?? Math.max(0, co - Number(c.deductible || 0)));
      const recvd = Number(c.recovered || 0);
      const out = Number(c.outstandingRecovery ?? Math.max(0, recExp - recvd));

      reserve += r;
      cashOut += co;
      recoverable += recExp;
      recovered += recvd;
      outstanding += out;
    }
    return { reserve, cashOut, recoverable, recovered, outstanding };
  }, [claims]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.brand}>Marincop</div>
          <div className={styles.subBrand}>Nova Carriers</div>
        </div>
        <nav className={styles.nav}>
          <Link className={styles.navItem} href="/">Claims</Link>
          <Link className={styles.navItem} href="/new-claim">New Claim</Link>
          <Link className={styles.navItemActive} href="/finance">Finance</Link>
          <Link className={styles.navItem} href="/reminders">Reminders</Link>
          <Link className={styles.navItem} href="/insights">Insights</Link>
        </nav>
      </header>

      <section className={styles.card}>
        <div className={styles.top}>
          <div>
            <h1 className={styles.h1}>Finance Dashboard</h1>
            <div className={styles.h2}>Owner view: cash out + recovery tracking</div>
          </div>
          <button className={styles.btn} onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {err ? <div className={styles.error}>Error: {err}</div> : null}

        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Cash Out (Paid)</div>
            <div className={styles.kpiVal}>{money(totals.cashOut)}</div>
          </div>

          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Recoverable Expected</div>
            <div className={styles.kpiVal}>{money(totals.recoverable)}</div>
          </div>

          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Recovered</div>
            <div className={styles.kpiVal}>{money(totals.recovered)}</div>
          </div>

          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Outstanding Recovery</div>
            <div className={styles.kpiVal}>{money(totals.outstanding)}</div>
          </div>

          <div className={styles.kpiMuted}>
            Reserve (Insurer): <b>{money(totals.reserve)}</b>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Claim #</th>
                <th className={styles.th}>Vessel</th>
                <th className={styles.th}>Status</th>
                <th className={`${styles.th} ${styles.num}`}>Cash Out</th>
                <th className={`${styles.th} ${styles.num}`}>Recoverable</th>
                <th className={`${styles.th} ${styles.num}`}>Recovered</th>
                <th className={`${styles.th} ${styles.num}`}>Outstanding<br/>Recovery</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 ? (
                <tr><td className={styles.td} colSpan={7}>No claims.</td></tr>
              ) : (
                claims.map((c) => (
                  <tr key={c.id} className={styles.row}>
                    <td className={styles.td}>
                      <Link className={styles.claimLink} href={`/claims/${c.id}`}>{c.claimNumber}</Link>
                    </td>
                    <td className={styles.td}>{c.vesselName || "—"}</td>
                    <td className={styles.td}>{c.progressStatus || "—"}</td>
                    <td className={`${styles.td} ${styles.num}`}>{money(c.cashOut ?? c.paid ?? 0)}</td>
                    <td className={`${styles.td} ${styles.num}`}>{money(c.recoverableExpected ?? 0)}</td>
                    <td className={`${styles.td} ${styles.num}`}>{money(c.recovered ?? 0)}</td>
                    <td className={`${styles.td} ${styles.num}`}>{money(c.outstandingRecovery ?? 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
