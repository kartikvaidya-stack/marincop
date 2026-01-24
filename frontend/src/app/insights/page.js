"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "../dashboard.module.css";

function money(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function safeStr(x) {
  return x == null ? "" : String(x);
}

function toDateStr(x) {
  try {
    return new Date(x).toLocaleString();
  } catch {
    return safeStr(x) || "—";
  }
}

function coverKey(covers) {
  if (!covers || covers.length === 0) return "—";
  return covers.join(", ");
}

function normVessel(name) {
  const v = safeStr(name).trim();
  return v ? v : "Unknown vessel";
}

export default function InsightsPage() {
  const [claims, setClaims] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const r = await fetch("/api/claims", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.message || `Failed (HTTP ${r.status})`);
      setClaims(j.data || []);
    } catch (e) {
      setErr(e?.message || "Failed to load insights");
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const computed = useMemo(() => {
    const openClaims = claims.filter((c) => safeStr(c.progressStatus).toLowerCase() !== "closed");

    const totals = {
      count: claims.length,
      openCount: openClaims.length,
      cashOut: 0,
      deductible: 0,
      recovered: 0,
      recoverableExpected: 0,
      outstandingRecovery: 0,
    };

    for (const c of claims) {
      totals.cashOut += Number(c.cashOut || 0);
      totals.deductible += Number(c.deductible || 0);
      totals.recovered += Number(c.recovered || 0);
      totals.recoverableExpected += Number(c.recoverableExpected || 0);
      totals.outstandingRecovery += Number(c.outstandingRecovery || 0);
    }

    const topOutstanding = [...claims]
      .sort((a, b) => Number(b.outstandingRecovery || 0) - Number(a.outstandingRecovery || 0))
      .slice(0, 5);

    const topCashOut = [...claims]
      .sort((a, b) => Number(b.cashOut || 0) - Number(a.cashOut || 0))
      .slice(0, 5);

    const newest = [...claims]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 1)[0];

    const largestOutstandingClaim = topOutstanding[0] || null;
    const largestCashOutClaim = topCashOut[0] || null;

    // By cover bucket
    const coverMap = new Map();
    for (const c of claims) {
      const key = coverKey(c.covers);
      const prev =
        coverMap.get(key) || { cover: key, count: 0, cashOut: 0, recovered: 0, outstandingRecovery: 0 };
      prev.count += 1;
      prev.cashOut += Number(c.cashOut || 0);
      prev.recovered += Number(c.recovered || 0);
      prev.outstandingRecovery += Number(c.outstandingRecovery || 0);
      coverMap.set(key, prev);
    }
    const byCover = Array.from(coverMap.values()).sort((a, b) => b.outstandingRecovery - a.outstandingRecovery);

    // Vessel concentration
    const vesselMap = new Map();
    for (const c of claims) {
      const v = normVessel(c.vesselName);
      const prev =
        vesselMap.get(v) || { vessel: v, count: 0, cashOut: 0, recovered: 0, outstandingRecovery: 0 };
      prev.count += 1;
      prev.cashOut += Number(c.cashOut || 0);
      prev.recovered += Number(c.recovered || 0);
      prev.outstandingRecovery += Number(c.outstandingRecovery || 0);
      vesselMap.set(v, prev);
    }
    const topVessels = Array.from(vesselMap.values())
      .sort((a, b) => b.outstandingRecovery - a.outstandingRecovery)
      .slice(0, 5);

    const highestVessel = topVessels[0] || null;

    // Status funnel
    const statusMap = new Map();
    for (const c of claims) {
      const s = safeStr(c.progressStatus || "—") || "—";
      statusMap.set(s, (statusMap.get(s) || 0) + 1);
    }
    const byStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // Incident keywords (if present)
    const kwMap = new Map();
    for (const c of claims) {
      const kws = c?.extraction?.incidentKeywords;
      if (Array.isArray(kws)) {
        for (const k of kws) {
          const kk = safeStr(k).trim().toLowerCase();
          if (!kk) continue;
          kwMap.set(kk, (kwMap.get(kk) || 0) + 1);
        }
      }
    }
    const topKeywords = Array.from(kwMap.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      totals,
      openClaims,
      topOutstanding,
      topCashOut,
      byCover,
      topVessels,
      highestVessel,
      newest,
      largestOutstandingClaim,
      largestCashOutClaim,
      byStatus,
      topKeywords,
    };
  }, [claims]);

  const { totals } = computed;

  function ClaimLink({ c, children }) {
    if (!c?.id) return <span>{children}</span>;
    return <Link href={`/claims/${c.id}`}>{children}</Link>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.top}>
          <div>
            <div className={styles.title}>Insights</div>
            <div className={styles.sub}>
              Portfolio overview • Nova Carriers • Owner view (Cash Out / Recoverable / Recovery)
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className={styles.btn} href="/">
              ← Back
            </Link>
            <button className={styles.btnPrimary} onClick={load}>
              Refresh
            </button>
          </div>
        </div>

        {loading ? <div>Loading…</div> : null}
        {err ? <div className={styles.error}>Error: {err}</div> : null}

        {!loading && !err ? (
          <>
            {/* KPI cards */}
            <div className={styles.kpiGrid2}>
              <div className={styles.kpiCard2}>
                <div className={styles.kpiLabel}>Open Claims</div>
                <div className={styles.kpiValue}>{totals.openCount}</div>
                <div className={styles.kpiHint}>of {totals.count} total</div>
              </div>

              <div className={styles.kpiCard2}>
                <div className={styles.kpiLabel}>Cash Out (Paid)</div>
                <div className={styles.kpiValue}>{money(totals.cashOut)}</div>
                <div className={styles.kpiHint}>Owner cash outflow</div>
              </div>

              <div className={styles.kpiCard2}>
                <div className={styles.kpiLabel}>Recoverable (Expected)</div>
                <div className={styles.kpiValue}>{money(totals.recoverableExpected)}</div>
                <div className={styles.kpiHint}>Cash Out − Deductible</div>
              </div>

              <div className={styles.kpiCard2}>
                <div className={styles.kpiLabel}>Recovered</div>
                <div className={styles.kpiValue}>{money(totals.recovered)}</div>
                <div className={styles.kpiHint}>Already recovered</div>
              </div>

              <div className={styles.kpiCard2}>
                <div className={styles.kpiLabel}>Outstanding Recovery</div>
                <div className={styles.kpiValue}>{money(totals.outstandingRecovery)}</div>
                <div className={styles.kpiHint}>Expected − Recovered</div>
              </div>
            </div>

            {/* Highlights */}
            <div className={styles.twoCol}>
              <div className={styles.panelCard}>
                <div className={styles.panelHead}>
                  <div className={styles.panelTitle}>Highlights</div>
                  <div className={styles.badgeSoft}>Top risks</div>
                </div>

                <div className={styles.hlList}>
                  <div className={styles.hlItem}>
                    <div className={styles.hlLabel}>Largest Outstanding</div>
                    <div className={styles.hlValue}>
                      {computed.largestOutstandingClaim ? (
                        <>
                          <ClaimLink c={computed.largestOutstandingClaim}>
                            {computed.largestOutstandingClaim.claimNumber}
                          </ClaimLink>{" "}
                          <span className={styles.muted}>•</span>{" "}
                          <span className={styles.hlMeta}>{normVessel(computed.largestOutstandingClaim.vesselName)}</span>
                          <div className={styles.hlMoney}>{money(computed.largestOutstandingClaim.outstandingRecovery)}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>

                  <div className={styles.hlItem}>
                    <div className={styles.hlLabel}>Largest Cash Out</div>
                    <div className={styles.hlValue}>
                      {computed.largestCashOutClaim ? (
                        <>
                          <ClaimLink c={computed.largestCashOutClaim}>
                            {computed.largestCashOutClaim.claimNumber}
                          </ClaimLink>{" "}
                          <span className={styles.muted}>•</span>{" "}
                          <span className={styles.hlMeta}>{normVessel(computed.largestCashOutClaim.vesselName)}</span>
                          <div className={styles.hlMoney}>{money(computed.largestCashOutClaim.cashOut)}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>

                  <div className={styles.hlItem}>
                    <div className={styles.hlLabel}>Vessel with Highest Exposure</div>
                    <div className={styles.hlValue}>
                      {computed.highestVessel ? (
                        <>
                          <div className={styles.hlMeta}>{computed.highestVessel.vessel}</div>
                          <div className={styles.hlMoney}>{money(computed.highestVessel.outstandingRecovery)}</div>
                          <div className={styles.kpiHint}>
                            {computed.highestVessel.count} claim(s) • Cash Out {money(computed.highestVessel.cashOut)}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>

                  <div className={styles.hlItem}>
                    <div className={styles.hlLabel}>Most Recent Claim</div>
                    <div className={styles.hlValue}>
                      {computed.newest ? (
                        <>
                          <ClaimLink c={computed.newest}>{computed.newest.claimNumber}</ClaimLink>{" "}
                          <span className={styles.muted}>•</span>{" "}
                          <span className={styles.hlMeta}>{toDateStr(computed.newest.createdAt)}</span>
                          <div className={styles.kpiHint}>{normVessel(computed.newest.vesselName)}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.panelCard}>
                <div className={styles.panelHead}>
                  <div className={styles.panelTitle}>Mix</div>
                  <div className={styles.badgeSoft}>Coverage + status</div>
                </div>

                <div className={styles.mixGrid}>
                  <div>
                    <div className={styles.mixTitle}>By Cover (Top)</div>
                    <div className={styles.mixList}>
                      {computed.byCover.slice(0, 5).map((r) => (
                        <div key={r.cover} className={styles.mixRow}>
                          <div className={styles.mixKey}>
                            <span className={styles.badge}>{r.cover}</span>
                          </div>
                          <div className={styles.mixNums}>
                            <span className={styles.mixNum}>#{r.count}</span>
                            <span className={styles.mixMoney}>{money(r.outstandingRecovery)}</span>
                          </div>
                        </div>
                      ))}
                      {computed.byCover.length === 0 ? <div className={styles.muted}>No data.</div> : null}
                    </div>
                  </div>

                  <div>
                    <div className={styles.mixTitle}>By Status</div>
                    <div className={styles.mixList}>
                      {computed.byStatus.slice(0, 6).map((r) => (
                        <div key={r.status} className={styles.mixRow}>
                          <div className={styles.mixKey}>
                            <span className={styles.badgeSoft2}>{r.status}</span>
                          </div>
                          <div className={styles.mixNums}>
                            <span className={styles.mixNum}>#{r.count}</span>
                          </div>
                        </div>
                      ))}
                      {computed.byStatus.length === 0 ? <div className={styles.muted}>No data.</div> : null}
                    </div>
                  </div>
                </div>

                {computed.topKeywords.length > 0 ? (
                  <>
                    <div className={styles.divider} />
                    <div className={styles.mixTitle}>Incident Keywords</div>
                    <div className={styles.tagWrap}>
                      {computed.topKeywords.map((k) => (
                        <span key={k.keyword} className={styles.tag}>
                          {k.keyword} <span className={styles.tagCount}>{k.count}</span>
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* Tables */}
            <div className={styles.sectionTitle}>Top Claims by Outstanding Recovery</div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Claim #</th>
                    <th>Vessel</th>
                    <th>Status</th>
                    <th>Covers</th>
                    <th>Cash Out</th>
                    <th>Recovered</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {computed.topOutstanding.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/claims/${c.id}`}>{c.claimNumber}</Link>
                      </td>
                      <td>{normVessel(c.vesselName)}</td>
                      <td>{c.progressStatus || "—"}</td>
                      <td>{coverKey(c.covers)}</td>
                      <td>{money(c.cashOut)}</td>
                      <td>{money(c.recovered)}</td>
                      <td>
                        <b>{money(c.outstandingRecovery)}</b>
                      </td>
                    </tr>
                  ))}
                  {computed.topOutstanding.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.muted}>
                        No claims.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div style={{ height: 14 }} />

            <div className={styles.sectionTitle}>Top Vessels by Outstanding Recovery</div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Vessel</th>
                    <th># Claims</th>
                    <th>Cash Out</th>
                    <th>Recovered</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {computed.topVessels.map((v) => (
                    <tr key={v.vessel}>
                      <td>{v.vessel}</td>
                      <td>{v.count}</td>
                      <td>{money(v.cashOut)}</td>
                      <td>{money(v.recovered)}</td>
                      <td>
                        <b>{money(v.outstandingRecovery)}</b>
                      </td>
                    </tr>
                  ))}
                  {computed.topVessels.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.muted}>
                        No data.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
