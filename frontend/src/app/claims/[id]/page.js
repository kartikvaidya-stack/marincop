"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const money = (n) => {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const isoLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const fromLocalToIso = (local) => {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

export default function ClaimDetailPage() {
  const params = useParams();
  const claimId = params?.id;

  const [claim, setClaim] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const apiBase = "/api"; // frontend proxy routes

  // Finance form
  const [by, setBy] = useState("Kartik");
  const [currency, setCurrency] = useState("USD");
  const [reserveEstimated, setReserveEstimated] = useState("");
  const [paid, setPaid] = useState("");
  const [deductible, setDeductible] = useState("");
  const [notes, setNotes] = useState("");
  const [savingFinance, setSavingFinance] = useState(false);
  const [financeMsg, setFinanceMsg] = useState("");

  async function load() {
    if (!claimId) {
      setErr("Missing claim id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const res = await fetch(`${apiBase}/claims/${claimId}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.message || `Claim load failed (HTTP ${res.status})`);

      setClaim(json.data);

      const f = json.data.finance || {};
      setCurrency(f.currency || "USD");
      setReserveEstimated(f.reserveEstimated ?? f.reserveEstimated === 0 ? String(f.reserveEstimated) : "");
      setPaid(f.paid ?? f.paid === 0 ? String(f.paid) : "");
      setDeductible(f.deductible ?? f.deductible === 0 ? String(f.deductible) : "");
      setNotes(f.notes || "");

      // drafts
      const dr = await fetch(`${apiBase}/claims/${claimId}/drafts`, { cache: "no-store" });
      const dj = await dr.json().catch(() => ({}));
      if (dr.ok && dj.ok) setDrafts(dj.data || []);
      else setDrafts([]);
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  const computed = useMemo(() => {
    const r = Number(reserveEstimated || 0);
    const p = Number(paid || 0);
    const d = Number(deductible || 0);
    const recoverable = Math.max(0, p - d);
    const outstanding = Math.max(0, r - p);
    return { r, p, d, recoverable, outstanding };
  }, [reserveEstimated, paid, deductible]);

  async function saveFinance() {
    if (!claimId) return;
    setSavingFinance(true);
    setFinanceMsg("");

    try {
      const res = await fetch(`${apiBase}/claims/${claimId}/finance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          by,
          finance: {
            currency,
            reserveEstimated: Number(reserveEstimated || 0),
            paid: Number(paid || 0),
            deductible: Number(deductible || 0),
            notes,
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.message || `Save failed (HTTP ${res.status})`);

      setFinanceMsg("Saved ✅");
      await load();
    } catch (e) {
      setFinanceMsg(`Save failed: ${e.message}`);
    } finally {
      setSavingFinance(false);
    }
  }

  async function toggleAction(actionId, nextStatus) {
    if (!claimId) return;
    try {
      const res = await fetch(`${apiBase}/claims/${claimId}/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          by,
          status: nextStatus,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.message || `Action update failed (HTTP ${res.status})`);
      await load();
    } catch (e) {
      alert(e.message || "Action update failed");
    }
  }

  async function saveReminder(actionId, reminderLocal) {
    if (!claimId) return;
    const reminderAt = fromLocalToIso(reminderLocal);
    try {
      const res = await fetch(`${apiBase}/claims/${claimId}/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          by,
          reminderAt,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.message || `Reminder save failed (HTTP ${res.status})`);
      await load();
    } catch (e) {
      alert(e.message || "Reminder save failed");
    }
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text || "");
      alert("Copied ✅");
    } catch {
      alert("Copy failed (browser blocked clipboard)");
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <Link href="/" style={styles.back}>← Back to claims</Link>
        <div style={styles.card}>Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={styles.page}>
        <Link href="/" style={styles.back}>← Back to claims</Link>
        <div style={styles.card}>Error: {err}</div>
      </div>
    );
  }

  const covers = (claim?.classification?.covers || []).map((c) => c.type).join(", ") || "—";
  const vessel = claim?.extraction?.vesselName || "—";

  return (
    <div style={styles.page}>
      <Link href="/" style={styles.back}>← Back to claims</Link>

      <div style={styles.headerRow}>
        <div>
          <div style={styles.h1}>{claim.claimNumber}</div>
          <div style={styles.sub}>Vessel: <b>{vessel}</b> • Covers: {covers}</div>
          <div style={styles.sub2}>Status: <b>{claim.progressStatus}</b></div>
        </div>
        <button style={styles.refreshBtn} onClick={load}>Refresh</button>
      </div>

      <div style={styles.grid2}>
        {/* Finance */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Finance</div>
          <div style={styles.small}>Reserve can remain. Paid is gross. Recoverable = Paid − Deductible.</div>

          <div style={styles.formGrid}>
            <label style={styles.label}>By</label>
            <input style={styles.input} value={by} onChange={(e) => setBy(e.target.value)} />

            <label style={styles.label}>Currency</label>
            <input style={styles.input} value={currency} onChange={(e) => setCurrency(e.target.value)} />

            <label style={styles.label}>Reserve (Estimated)</label>
            <input style={styles.input} value={reserveEstimated} onChange={(e) => setReserveEstimated(e.target.value)} placeholder="e.g. 50000" />

            <label style={styles.label}>Paid (Gross)</label>
            <input style={styles.input} value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="e.g. 12000" />

            <label style={styles.label}>Deductible</label>
            <input style={styles.input} value={deductible} onChange={(e) => setDeductible(e.target.value)} placeholder="e.g. 25000" />
          </div>

          <div style={styles.kpiRow}>
            <div style={styles.kpiBox}>
              <div style={styles.kpiLabel}>Recoverable</div>
              <div style={styles.kpiValue}>{money(computed.recoverable)}</div>
            </div>
            <div style={styles.kpiBox}>
              <div style={styles.kpiLabel}>Outstanding</div>
              <div style={styles.kpiValue}>{money(computed.outstanding)}</div>
            </div>
          </div>

          <label style={styles.label}>Notes</label>
          <textarea style={styles.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div style={styles.rowBetween}>
            <button style={styles.primaryBtn} onClick={saveFinance} disabled={savingFinance}>
              {savingFinance ? "Saving…" : "Save Finance"}
            </button>
            <div style={styles.msg}>{financeMsg}</div>
          </div>
        </div>

        {/* Drafts */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Draft templates</div>
          <div style={styles.small}>Templates only (AI drafting comes later). Click Copy.</div>

          {drafts.length === 0 ? (
            <div style={styles.small}>No drafts found.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {drafts.map((d, idx) => (
                <div key={`${d.type}-${idx}`} style={styles.draftBox}>
                  <div style={styles.draftHead}>
                    <div>
                      <div style={styles.draftType}>{d.type}</div>
                      <div style={styles.draftSubj}>{d.subject}</div>
                    </div>
                    <button style={styles.copyBtn} onClick={() => copy(`Subject: ${d.subject}\n\n${d.body}`)}>
                      Copy
                    </button>
                  </div>
                  <pre style={styles.pre}>{d.body}</pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={styles.cardWide}>
          <div style={styles.cardTitle}>Actions</div>
          <div style={styles.small}>
            Mark actions Open/DONE and set reminders. Reminders appear in the Reminders tab when due.
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {(claim.actions || []).map((a) => (
              <div key={a.id} style={styles.actionRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.actionTitle}>{a.title}</div>
                  <div style={styles.actionMeta}>
                    Owner: {a.ownerRole} • Status: <b>{a.status}</b> • Due:{" "}
                    {a.dueAt ? new Date(a.dueAt).toLocaleString() : "—"}
                    {a.reminderAt ? ` • Reminder: ${new Date(a.reminderAt).toLocaleString()}` : ""}
                  </div>

                  <div style={styles.reminderRow}>
                    <span style={styles.remLabel}>Set reminder:</span>
                    <input
                      type="datetime-local"
                      style={styles.input}
                      defaultValue={isoLocal(a.reminderAt)}
                      onBlur={(e) => saveReminder(a.id, e.target.value)}
                    />
                    <span style={styles.remHint}>Click outside to save</span>
                  </div>
                </div>

                <div style={styles.actionBtns}>
                  {a.status !== "DONE" ? (
                    <button style={styles.doneBtn} onClick={() => toggleAction(a.id, "DONE")}>Mark DONE</button>
                  ) : (
                    <button style={styles.openBtn} onClick={() => toggleAction(a.id, "OPEN")}>Reopen</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  page: { padding: 24, background: "#f6f8fb", minHeight: "100vh", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" },
  back: { display: "inline-block", marginBottom: 14, color: "#1f4b99", textDecoration: "none" },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  h1: { fontSize: 22, fontWeight: 750, color: "#0f172a" },
  sub: { marginTop: 6, color: "#334155" },
  sub2: { marginTop: 4, color: "#475569", fontSize: 13 },
  refreshBtn: { border: "1px solid #cbd5e1", background: "#fff", padding: "10px 12px", borderRadius: 10, cursor: "pointer" },

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, boxShadow: "0 1px 8px rgba(15,23,42,0.06)" },
  cardWide: { gridColumn: "1 / span 2", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, boxShadow: "0 1px 8px rgba(15,23,42,0.06)" },

  cardTitle: { fontWeight: 750, marginBottom: 6, color: "#0f172a" },
  small: { fontSize: 12, color: "#64748b", marginBottom: 10 },

  formGrid: { display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, alignItems: "center" },
  label: { fontSize: 12, color: "#475569" },
  input: { border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, outline: "none" },
  textarea: { width: "100%", minHeight: 90, border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, marginTop: 6, outline: "none" },

  kpiRow: { display: "flex", gap: 10, marginTop: 12, marginBottom: 10 },
  kpiBox: { flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 10 },
  kpiLabel: { fontSize: 12, color: "#64748b" },
  kpiValue: { marginTop: 4, fontSize: 18, fontWeight: 800, color: "#0f172a" },

  rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  primaryBtn: { background: "#2563eb", color: "#fff", border: "none", padding: "10px 12px", borderRadius: 10, cursor: "pointer", fontWeight: 650 },
  msg: { fontSize: 12, color: "#334155" },

  draftBox: { border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#fbfdff" },
  draftHead: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8 },
  draftType: { fontWeight: 800, color: "#0f172a", fontSize: 12 },
  draftSubj: { fontSize: 12, color: "#475569", marginTop: 4 },
  copyBtn: { border: "1px solid #cbd5e1", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" },
  pre: { whiteSpace: "pre-wrap", margin: 0, fontSize: 12, color: "#0f172a", lineHeight: 1.35 },

  actionRow: { display: "flex", gap: 12, padding: 10, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fbfdff" },
  actionTitle: { fontWeight: 650, color: "#0f172a" },
  actionMeta: { marginTop: 4, fontSize: 12, color: "#64748b" },
  actionBtns: { display: "flex", alignItems: "center" },
  doneBtn: { background: "#16a34a", color: "#fff", border: "none", padding: "10px 12px", borderRadius: 10, cursor: "pointer", fontWeight: 650 },
  openBtn: { background: "#0f172a", color: "#fff", border: "none", padding: "10px 12px", borderRadius: 10, cursor: "pointer", fontWeight: 650 },

  reminderRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" },
  remLabel: { fontSize: 12, color: "#334155" },
  remHint: { fontSize: 12, color: "#64748b" },
};
