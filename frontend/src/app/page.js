"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./dashboard.module.css";

function money(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function HomePage() {
  const [claims, setClaims] = useState([]);
  const [q, setQ] = useState("");
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

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return claims;
    return claims.filter((c) => {
      const covers = Array.isArray(c.covers) ? c.covers.join(",") : "";
      return (
        String(c.claimNumber || "").toLowerCase().includes(t) ||
        String(c.vesselName || "").toLowerCase().includes(t) ||
        String(c.progressStatus || "").toLowerCase().includes(t) ||
        String(covers).toLowerCase().includes(t)
      );
    });
  }, [q, claims]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.brand}>Marincop</div>
          <div className={styles.subBrand}>Nova Carriers</div>
        </div>

        <nav className={styles.nav}>
          <Link className={styles.navItemActive} href="/">Claims</Link>
          <Link className={styles.navItem} href="/new-claim">New Claim</Link>
          <Link className={styles.navItem} href="/finance">Finance</Link>
          <Link className={styles.navItem} href="/reminders">Reminders</Link>
          <Link className={styles.navItem} href="/insights">Insights</Link>
          {/* Settings removed from nav (as per your feedback #1 earlier) */}
        </nav>
      </header>

      <section className={styles.card}>
        <div className={styles.cardTop}>
          <div>
            <h1 className={styles.h1}>Claims Dashboard</h1>
            <div className={styles.h2}>
              Marine insurance case management • templates drafting • finance exposure
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.btn} onClick={load} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className={styles.searchRow}>
          <input
            className={styles.search}
            placeholder="Search claim #, vessel, cover, status…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className={styles.envPill}>Environment: {process.env.NEXT_PUBLIC_ENV_LABEL || "Live"}</div>
        </div>

        {err ? <div className={styles.error}>Error: {err}</div> : null}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Claim #</th>
                <th className={styles.th}>Vessel</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Covers</th>

                <th className={`${styles.th} ${styles.num}`}>
                  <span className={styles.thWrap}>Reserve</span>
                </th>

                <th className={`${styles.th} ${styles.num}`}>
                  <span className={styles.thWrap}>Cash Out</span>
                </th>

                <th className={`${styles.th} ${styles.num}`}>
                  <span className={styles.thWrap}>Recoverable</span>
                </th>

                <th className={`${styles.th} ${styles.num}`}>
                  <span className={styles.thWrap}>Recovered</span>
                </th>

                <th className={`${styles.th} ${styles.num}`}>
                  <span className={styles.thWrap}>Outstanding<br />Recovery</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className={styles.td} colSpan={9}>
                    No claims found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className={styles.row}>
                    <td className={styles.td}>
                      <Link className={styles.claimLink} href={`/claims/${c.id}`}>
                        {c.claimNumber}
                      </Link>
                    </td>
                    <td className={styles.td}>{c.vesselName || "—"}</td>
                    <td className={styles.td}>{c.progressStatus || "—"}</td>
                    <td className={styles.td}>{(c.covers || []).join(", ") || "—"}</td>

                    <td className={`${styles.td} ${styles.num}`}>{money(c.reserveEstimated)}</td>
                    <td className={`${styles.td} ${styles.num}`}>{money(c.cashOut)}</td>
                    <td className={`${styles.td} ${styles.num}`}>{money(c.recoverableExpected)}</td>
                    <td className={`${styles.td} ${styles.num}`}>{money(c.recovered)}</td>
                    <td className={`${styles.td} ${styles.num}`}>{money(c.outstandingRecovery)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.tip}>
          Tip: Click the claim number to open the claim detail page.
        </div>
      </section>
    </div>
  );
}
