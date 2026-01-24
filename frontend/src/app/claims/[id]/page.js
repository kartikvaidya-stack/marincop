"use client";

import Link from "next/link";
import React, { use, useEffect, useMemo, useState } from "react";
import styles from "./detail.module.css";

function money(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const STATUS_OPTIONS = [
  "Notification Received",
  "Insurers Notified",
  "Survey Appointed",
  "Under Review",
  "Settlement Agreed",
  "Paid",
  "Recovery Ongoing",
  "Closed",
];

export default function ClaimDetailPage({ params }) {
  // ✅ Next.js 16: params may be a Promise in some runtimes
  const resolvedParams = typeof params?.then === "function" ? use(params) : params;
  const claimId = resolvedParams?.id;

  const [claim, setClaim] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // Status update
  const [status, setStatus] = useState("Notification Received");
  const [statusBy, setStatusBy] = useState("Kartik");
  const [statusSaving, setStatusSaving] = useState(false);

  // Finance
  const [financeBy, setFinanceBy] = useState("Kartik");
  const [currency, setCurrency] = useState("USD");
  const [reserveEstimated, setReserveEstimated] = useState(0);
  const [cashOut, setCashOut] = useState(0); // Owner cash out (paid)
  const [deductible, setDeductible] = useState(0);
  const [recovered, setRecovered] = useState(0);
  const [financeNotes, setFinanceNotes] = useState("");
  const [financeSaving, setFinanceSaving] = useState(false);

  // Actions
  const [actionSavingId, setActionSavingId] = useState("");
  const [actionReminder, setActionReminder] = useState({}); // { actionId: "YYYY-MM-DDTHH:mm" }

  // Drafts
  const [drafts, setDrafts] = useState([]);
  const [draftErr, setDraftErr] = useState("");

  const recoverableExpected = useMemo(
    () => Math.max(0, Number(cashOut || 0) - Number(deductible || 0)),
    [cashOut, deductible]
  );
  const outstandingRecovery = useMemo(
    () => Math.max(0, Number(recoverableExpected || 0) - Number(recovered || 0)),
    [recoverableExpected, recovered]
  );

  async function loadAll() {
    try {
      setLoading(true);
      setErr("");
      setDraftErr("");

      // Claim
      const res = await fetch(`/api/claims/${claimId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || `Claim load failed (HTTP ${res.status})`);
      }

      const c = json.data;
      setClaim(c);

      // Status
      setStatus(c.progressStatus || "Notification Received");

      // Finance (support both "paid" and "cashOut")
      const f = c.finance || {};
      setCurrency(f.currency || "USD");
      setReserveEstimated(Number(f.reserveEstimated || 0));
      setCashOut(Number(f.cashOut ?? f.paid ?? 0));
      setDeductible(Number(f.deductible || 0));
      setRecovered(Number(f.recovered || 0));
      setFinanceNotes(String(f.notes || ""));

      // Drafts
      const dRes = await fetch(`/api/claims/${claimId}/drafts`, { cache: "no-store" });
      const dJson = await dRes.json();
      if (dRes.ok && dJson.ok) setDrafts(dJson.data || []);
      else setDraftErr(dJson.message || `Drafts failed (HTTP ${dRes.status})`);
    } catch (e) {
      setErr(e?.message || "Failed to load claim");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!claimId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  async function saveStatus() {
    try {
      setStatusSaving(true);
      setErr("");

      const res = await fetch(`/api/claims/${claimId}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: statusBy, progressStatus: status }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to update status");
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Failed to update status");
    } finally {
      setStatusSaving(false);
    }
  }

  async function saveFinance() {
    try {
      setFinanceSaving(true);
      setErr("");

      const res = await fetch(`/api/claims/${claimId}/finance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          by: financeBy,
          finance: {
            currency,
            reserveEstimated: Number(reserveEstimated || 0),
            cashOut: Number(cashOut || 0),
            paid: Number(cashOut || 0), // backward compatible
            deductible: Number(deductible || 0),
            recovered: Number(recovered || 0),
            notes: financeNotes,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to save finance");
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Failed to save finance");
    } finally {
      setFinanceSaving(false);
    }
  }

  async function patchAction(actionId, patch) {
    try {
      setActionSavingId(actionId);
      setErr("");

      const res = await fetch(`/api/claims/${claimId}/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: "Kartik", ...patch }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to update action");
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Failed to update action");
    } finally {
      setActionSavingId("");
    }
  }

  if (!claimId) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <Link className={styles.back} href="/">← Back to claims</Link>
          <div className={styles.error}>Error: Missing claim id.</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <Link className={styles.back} href="/">← Back to claims</Link>
          <div>Loading…</div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <Link className={styles.back} href="/">← Back to claims</Link>
          <div className={styles.error}>Error: {err}</div>
        </div>
      </div>
    );
  }

  const vessel = claim?.extraction?.vesselName || claim?.vesselName || "—";
  const covers =
    (claim?.classification?.covers || []).map((x) => x.type).join(", ") ||
    (claim?.covers || []).join(", ") ||
    "—";

  const statusLog = Array.isArray(claim?.statusLog) ? claim.statusLog : [];

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link className={styles.back} href="/">← Back to claims</Link>

        <div className={styles.top}>
          <div>
            <div className={styles.title}>{claim.claimNumber}</div>
            <div className={styles.sub}>Vessel: {vessel} • Covers: {covers}</div>
          </div>
          <button className={styles.btn} onClick={loadAll}>Refresh</button>
        </div>

        <div className={styles.grid}>
          {/* Status + timeline */}
          <section className={styles.panel}>
            <div className={styles.panelTitle}>Status</div>

            <div className={styles.row}>
              <div className={styles.label}>Current</div>
              <div className={styles.value}>{claim.progressStatus || "—"}</div>
            </div>

            <div className={styles.row}>
              <div className={styles.label}>Update to</div>
              <select className={styles.input} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className={styles.row}>
              <div className={styles.label}>By</div>
              <input className={styles.input} value={statusBy} onChange={(e) => setStatusBy(e.target.value)} />
            </div>

            <button className={styles.btnPrimary} onClick={saveStatus} disabled={statusSaving}>
              {statusSaving ? "Saving…" : "Save status"}
            </button>

            <div className={styles.divider} />

            <div className={styles.panelTitleSmall}>Timeline</div>

            {statusLog.length === 0 ? (
              <div className={styles.muted}>No status history yet.</div>
            ) : (
              <div className={styles.timeline}>
                {statusLog
                  .slice()
                  .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                  .map((e, idx) => (
                    <div className={styles.timelineRow} key={idx}>
                      <div className={styles.timelineDot} />
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineTop}>
                          <div className={styles.timelineStatus}>{e.status}</div>
                          <div className={styles.timelineAt}>{new Date(e.at).toLocaleString()}</div>
                        </div>
                        <div className={styles.timelineMeta}>
                          by <b>{e.by || "—"}</b>
                        </div>
                        {e.note ? <div className={styles.timelineNote}>{e.note}</div> : null}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* Finance */}
          <section className={styles.panel}>
            <div className={styles.panelTitle}>Finance (Owner view)</div>

            <div className={styles.financeGrid}>
              <label className={styles.field}>
                <span>Currency</span>
                <input className={styles.input} value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </label>

              <label className={styles.field}>
                <span>Reserve (insurer)</span>
                <input className={styles.input} type="number" value={reserveEstimated} onChange={(e) => setReserveEstimated(e.target.value)} />
              </label>

              <label className={styles.field}>
                <span>Cash Out (paid by owner)</span>
                <input className={styles.input} type="number" value={cashOut} onChange={(e) => setCashOut(e.target.value)} />
              </label>

              <label className={styles.field}>
                <span>Deductible</span>
                <input className={styles.input} type="number" value={deductible} onChange={(e) => setDeductible(e.target.value)} />
              </label>

              <label className={styles.field}>
                <span>Recovered</span>
                <input className={styles.input} type="number" value={recovered} onChange={(e) => setRecovered(e.target.value)} />
              </label>

              <label className={styles.field}>
                <span>Recoverable (Cash Out − Deductible)</span>
                <input className={styles.input} value={money(recoverableExpected)} readOnly />
              </label>

              <label className={styles.field}>
                <span>Outstanding Recovery</span>
                <input className={styles.input} value={money(outstandingRecovery)} readOnly />
              </label>

              <label className={styles.field}>
                <span>By</span>
                <input className={styles.input} value={financeBy} onChange={(e) => setFinanceBy(e.target.value)} />
              </label>
            </div>

            <label className={styles.fieldFull}>
              <span>Notes</span>
              <textarea className={styles.textarea} rows={3} value={financeNotes} onChange={(e) => setFinanceNotes(e.target.value)} />
            </label>

            <button className={styles.btnPrimary} onClick={saveFinance} disabled={financeSaving}>
              {financeSaving ? "Saving…" : "Save finance"}
            </button>
          </section>

          {/* Actions */}
          <section className={styles.panelWide}>
            <div className={styles.panelTitle}>Actions</div>

            {(claim.actions || []).length === 0 ? (
              <div className={styles.muted}>No actions.</div>
            ) : (
              <div className={styles.actionsList}>
                {(claim.actions || []).map((a) => (
                  <div className={styles.actionRow} key={a.id}>
                    <div className={styles.actionMain}>
                      <div className={styles.actionTitle}>{a.title}</div>
                      <div className={styles.actionMeta}>
                        Role: {a.ownerRole || "—"} • Due: {a.dueAt ? new Date(a.dueAt).toLocaleString() : "—"} • Status: <b>{a.status}</b>
                      </div>
                      {a.notes ? <div className={styles.actionNotes}>{a.notes}</div> : null}
                      {a.reminderAt ? (
                        <div className={styles.actionReminder}>
                          Reminder: <b>{new Date(a.reminderAt).toLocaleString()}</b>
                        </div>
                      ) : null}
                    </div>

                    <div className={styles.actionControls}>
                      <button
                        className={styles.btn}
                        disabled={actionSavingId === a.id}
                        onClick={() => patchAction(a.id, { status: a.status === "DONE" ? "OPEN" : "DONE" })}
                      >
                        {a.status === "DONE" ? "Re-open" : "Mark DONE"}
                      </button>

                      <input
                        className={styles.inputSmall}
                        type="datetime-local"
                        value={actionReminder[a.id] || ""}
                        onChange={(e) => setActionReminder((p) => ({ ...p, [a.id]: e.target.value }))}
                        title="Set reminder"
                      />

                      <button
                        className={styles.btn}
                        disabled={actionSavingId === a.id}
                        onClick={() => {
                          const v = actionReminder[a.id];
                          if (!v) return;
                          const iso = new Date(v).toISOString();
                          patchAction(a.id, { reminderAt: iso });
                        }}
                      >
                        Set reminder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Drafts */}
          <section className={styles.panelWide}>
            <div className={styles.panelTitle}>Draft templates</div>

            {draftErr ? <div className={styles.error}>Drafts: {draftErr}</div> : null}

            {drafts.length === 0 ? (
              <div className={styles.muted}>No drafts available.</div>
            ) : (
              <div className={styles.drafts}>
                {drafts.map((d, idx) => (
                  <div key={idx} className={styles.draftCard}>
                    <div className={styles.draftHead}>
                      <div className={styles.draftType}>{d.type}</div>
                      <button
                        className={styles.btn}
                        onClick={() => navigator.clipboard.writeText(`Subject: ${d.subject}\n\n${d.body}`)}
                      >
                        Copy
                      </button>
                    </div>
                    <div className={styles.draftSubj}>{d.subject}</div>
                    <pre className={styles.draftBody}>{d.body}</pre>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
