"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../dashboard.module.css";

function fmt(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt);
  }
}

export default function RemindersPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setErr("");

      // ✅ Use Next API proxy (no NEXT_PUBLIC_BACKEND_URL needed)
      const r = await fetch("/api/claims/reminders/due", { cache: "no-store" });
      const j = await r.json();

      if (!r.ok || !j.ok) throw new Error(j.message || `Failed (HTTP ${r.status})`);
      setRows(j.data || []);
    } catch (e) {
      setErr(e?.message || "Failed to load reminders");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.top}>
          <div>
            <div className={styles.title}>Reminders</div>
            <div className={styles.sub}>Upcoming / due reminders from actions</div>
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

        {!loading && !err && rows.length === 0 ? (
          <div className={styles.muted}>No reminders due.</div>
        ) : null}

        {!loading && !err && rows.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Claim #</th>
                  <th>Vessel</th>
                  <th>Status</th>
                  <th>Action</th>
                  <th>Owner</th>
                  <th>Reminder</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={`${x.claimId}-${x.actionId}`}>
                    <td>
                      <Link href={`/claims/${x.claimId}`}>{x.claimNumber || x.claimId}</Link>
                    </td>
                    <td>{x.vesselName || "—"}</td>
                    <td>{x.progressStatus || "—"}</td>
                    <td>{x.actionTitle || "—"}</td>
                    <td>{x.ownerRole || "—"}</td>
                    <td>{fmt(x.reminderAt)}</td>
                    <td>{fmt(x.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
