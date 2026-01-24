"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function fmtMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function isoToLocal(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function safeJson(resp) {
  return resp.json().catch(() => null);
}

const STATUS_OPTIONS = [
  "Notification Received",
  "Insurers Notified",
  "Survey Appointed",
  "Under Assessment",
  "Settlement Negotiation",
  "Recovery Ongoing",
  "Closed",
];

export default function ClaimDetailPage() {
  const params = useParams();
  const claimId = params?.id;

  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [savingStatus, setSavingStatus] = useState(false);
  const [savingFinance, setSavingFinance] = useState(false);

  const [statusDraft, setStatusDraft] = useState("");
  const [financeDraft, setFinanceDraft] = useState({
    currency: "USD",
    reserveEstimated: 0,
    paid: 0,
    cashOut: 0,
    deductible: 0,
    recoverableExpected: 0,
    recovered: 0,
    notes: "",
  });

  const [drafts, setDrafts] = useState([]);
  const [draftsErr, setDraftsErr] = useState("");
  const [draftsLoading, setDraftsLoading] = useState(false);

  // For safety: keep "by" stable and simple (later we can pull from Settings)
  const BY = "Kartik";

  async function loadClaim() {
    if (!claimId) {
      setErr("Missing claim id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const resp = await fetch(`/api/claims/${claimId}`, { cache: "no-store" });
      const json = await safeJson(resp);

      if (!resp.ok || !json?.ok) {
        throw new Error(json?.message || `Claim load failed (HTTP ${resp.status})`);
      }

      const c = json.data;
      setClaim(c);

      // status draft
      setStatusDraft(c?.progressStatus || "Notification Received");

      // finance draft (keep backward compatible with older schemas)
      const f = c?.finance || {};
      const currency = f.currency || c.currency || "USD";

      const reserveEstimated = Number(
        f.reserveEstimated ?? c.reserveEstimated ?? 0
      );

      // Paid / cash-out (support older "paid" and newer "cashOut")
      const paid = Number(f.paid ?? c.paid ?? 0);
      const cashOut = Number(f.cashOut ?? c.cashOut ?? paid);

      const deductible = Number(f.deductible ?? c.deductible ?? 0);

      // recovered
      const recovered = Number(
        f.recovered ?? c.recovered ?? 0
      );

      // expected recoverable (support older key names)
      const recoverableExpected = Number(
        f.recoverableExpected ??
          c.recoverableExpected ??
          f.recoverable ??
          c.recoverable ??
          Math.max(0, cashOut - deductible)
      );

      const notes = String(f.notes ?? "");

      setFinanceDraft({
        currency,
        reserveEstimated,
        paid: paid || cashOut || 0,
        cashOut: cashOut || paid || 0,
        deductible,
        recoverableExpected,
        recovered,
        notes,
      });
    } catch (e) {
      setErr(e?.message || "Claim load failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadDrafts() {
    if (!claimId) return;
    setDraftsLoading(true);
    setDraftsErr("");
    try {
      const resp = await fetch(`/api/claims/${claimId}/drafts`, { cache: "no-store" });
      const json = await safeJson(resp);
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.message || `Drafts failed (HTTP ${resp.status})`);
      }
      // expected json.data to be an array
      setDrafts(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setDrafts([]);
      setDraftsErr(e?.message || "Drafts failed");
    } finally {
      setDraftsLoading(false);
    }
  }

  useEffect(() => {
    loadClaim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  useEffect(() => {
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  const financeComputed = useMemo(() => {
    const cashOut = Number(financeDraft.cashOut ?? financeDraft.paid ?? 0);
    const deductible = Number(financeDraft.deductible || 0);
    const recovered = Number(financeDraft.recovered || 0);

    // expected recoverable (owner’s view): cash out less deductible (unless user overrides)
    const recExp = Number(
      financeDraft.recoverableExpected ??
        Math.max(0, cashOut - deductible)
    );

    const outstandingRecovery = Math.max(0, recExp - recovered);

    return { cashOut, deductible, recovered, recoverableExpected: recExp, outstandingRecovery };
  }, [financeDraft]);

  async function saveStatus() {
    if (!claimId) {
      setErr("Missing claim id.");
      return;
    }
    setSavingStatus(true);
    setErr("");
    try {
      const payload = { by: BY, progressStatus: statusDraft };

      const resp = await fetch(`/api/claims/${claimId}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await safeJson(resp);
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.message || `Status update failed (HTTP ${resp.status})`);
      }

      await loadClaim();
    } catch (e) {
      setErr(e?.message || "Status update failed");
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveFinance() {
    if (!claimId) {
      setErr("Missing claim id.");
      return;
    }

    setSavingFinance(true);
    setErr("");

    try {
      const payload = {
        by: BY,
        finance: {
          currency: financeDraft?.currency || "USD",

          // insurer reserve can remain (owner still wants to know exposure)
          reserveEstimated: Number(financeDraft?.reserveEstimated || 0),

          // owner cash-out (paid)
          paid: Number(financeDraft?.paid ?? 0),
          cashOut: Number(financeDraft?.cashOut ?? financeDraft?.paid ?? 0),

          deductible: Number(financeDraft?.deductible || 0),

          // expected recoverable (owner view)
          recoverableExpected: Number(
            financeDraft?.recoverableExpected ??
              Math.max(
                0,
                Number(financeDraft?.cashOut ?? financeDraft?.paid ?? 0) -
                  Number(financeDraft?.deductible || 0)
              )
          ),

          // recovered so far
          recovered: Number(financeDraft?.recovered || 0),

          notes: String(financeDraft?.notes || ""),
        },
      };

      const resp = await fetch(`/api/claims/${claimId}/finance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await safeJson(resp);

      if (!resp.ok || !json?.ok) {
        throw new Error(json?.message || `Finance update failed (HTTP ${resp.status})`);
      }

      await loadClaim();
    } catch (e) {
      setErr(e?.message || "Finance update failed");
    } finally {
      setSavingFinance(false);
    }
  }

  async function updateAction(actionId, patch) {
    if (!claimId) {
      setErr("Missing claim id.");
      return;
    }
    setErr("");
    try {
      const payload = { by: BY, ...patch };

      const resp = await fetch(`/api/claims/${claimId}/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await safeJson(resp);
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.message || `Action update failed (HTTP ${resp.status})`);
      }

      await loadClaim();
    } catch (e) {
      setErr(e?.message || "Action update failed");
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
        <Link href="/" style={{ textDecoration: "none" }}>← Back to claims</Link>
        <div style={{ marginTop: 12 }}>Loading claim…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
        <Link href="/" style={{ textDecoration: "none" }}>← Back to claims</Link>
        <div style={{ marginTop: 12, color: "#b00020" }}>Error: {err}</div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
        <Link href="/" style={{ textDecoration: "none" }}>← Back to claims</Link>
        <div style={{ marginTop: 12 }}>No claim loaded.</div>
      </div>
    );
  }

  const coversText = Array.isArray(claim.covers) ? claim.covers.join(", ") : "";

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <Link href="/" style={{ textDecoration: "none" }}>← Back to claims</Link>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Claim: <b>{claim.claimNumber}</b> • ID: {claim.id}
        </div>
      </div>

      <h2 style={{ marginTop: 12, marginBottom: 6 }}>
        {claim.claimNumber} — {claim.vesselName || claim?.extraction?.vesselName || "—"}
      </h2>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, opacity: 0.85 }}>
        <div><b>Status:</b> {claim.progressStatus || "—"}</div>
        <div><b>Covers:</b> {coversText || "—"}</div>
        <div><b>Date:</b> {claim.eventDateText || claim?.extraction?.eventDateText || "—"}</div>
        <div><b>Location:</b> {claim.locationText || claim?.extraction?.locationText || "—"}</div>
      </div>

      {/* Status update */}
      <div style={{
        marginTop: 18,
        padding: 14,
        border: "1px solid #e7e7ef",
        borderRadius: 12,
        background: "#fbfcff",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 600 }}>Update progress status</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Logged to status timeline + audit trail</div>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={statusDraft}
            onChange={(e) => setStatusDraft(e.target.value)}
            style={{
              padding: "10px 10px",
              borderRadius: 10,
              border: "1px solid #d9d9e6",
              background: "white",
              minWidth: 240,
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <button
            onClick={saveStatus}
            disabled={savingStatus}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #0b5cff",
              background: savingStatus ? "#dbe7ff" : "#eaf1ff",
              cursor: savingStatus ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {savingStatus ? "Saving…" : "Save status"}
          </button>
        </div>

        {/* Status timeline */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 6 }}>Status timeline</div>
          <div style={{
            border: "1px solid #ececf5",
            borderRadius: 10,
            background: "white",
            padding: 10,
            maxHeight: 180,
            overflow: "auto",
            fontSize: 12,
          }}>
            {(Array.isArray(claim.statusLog) ? claim.statusLog : []).slice().reverse().map((s, idx) => (
              <div key={idx} style={{ padding: "6px 0", borderBottom: idx === 0 ? "none" : "1px solid #f2f2f8" }}>
                <div><b>{s.status}</b> — {isoToLocal(s.at)}</div>
                <div style={{ opacity: 0.75 }}>by {s.by}{s.note ? ` • ${s.note}` : ""}</div>
              </div>
            ))}
            {(!claim.statusLog || claim.statusLog.length === 0) && (
              <div style={{ opacity: 0.7 }}>No status entries yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Finance */}
      <div style={{
        marginTop: 18,
        padding: 14,
        border: "1px solid #e7e7ef",
        borderRadius: 12,
        background: "#fbfcff",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 600 }}>Finance</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Track owner cash-out + recovery (reserve kept for exposure)
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(6, minmax(160px, 1fr))", gap: 10 }}>
          <Field label="Currency">
            <input
              value={financeDraft.currency}
              onChange={(e) => setFinanceDraft((p) => ({ ...p, currency: e.target.value }))}
              style={inputStyle}
            />
          </Field>

          <Field label="Reserve (estimate)">
            <input
              type="number"
              value={financeDraft.reserveEstimated}
              onChange={(e) => setFinanceDraft((p) => ({ ...p, reserveEstimated: e.target.value }))}
              style={inputStyle}
            />
          </Field>

          <Field label="Paid / Cash-out">
            <input
              type="number"
              value={financeDraft.cashOut}
              onChange={(e) =>
                setFinanceDraft((p) => ({ ...p, cashOut: e.target.value, paid: e.target.value }))
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Deductible">
            <input
              type="number"
              value={financeDraft.deductible}
              onChange={(e) => setFinanceDraft((p) => ({ ...p, deductible: e.target.value }))}
              style={inputStyle}
            />
          </Field>

          <Field label="Recovered so far">
            <input
              type="number"
              value={financeDraft.recovered}
              onChange={(e) => setFinanceDraft((p) => ({ ...p, recovered: e.target.value }))}
              style={inputStyle}
            />
          </Field>

          <Field label="Recoverable expected">
            <input
              type="number"
              value={financeDraft.recoverableExpected}
              onChange={(e) => setFinanceDraft((p) => ({ ...p, recoverableExpected: e.target.value }))}
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <Field label="Notes">
            <textarea
              value={financeDraft.notes}
              onChange={(e) => setFinanceDraft((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, height: "auto", paddingTop: 10 }}
            />
          </Field>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={saveFinance}
            disabled={savingFinance}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #0b5cff",
              background: savingFinance ? "#dbe7ff" : "#eaf1ff",
              cursor: savingFinance ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {savingFinance ? "Saving…" : "Save finance"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.8 }}>
            <b>Computed:</b> Expected recoverable = {fmtMoney(financeComputed.recoverableExpected)} • Outstanding recovery ={" "}
            {fmtMoney(financeComputed.outstandingRecovery)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        marginTop: 18,
        padding: 14,
        border: "1px solid #e7e7ef",
        borderRadius: 12,
        background: "#fbfcff",
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Actions</div>

        <div style={{
          border: "1px solid #ececf5",
          borderRadius: 10,
          background: "white",
          overflow: "hidden",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr 0.6fr 0.8fr 1.1fr", fontSize: 12, fontWeight: 700, background: "#f4f6ff", padding: 10 }}>
            <div>Action</div>
            <div>Owner</div>
            <div>Status</div>
            <div>Due</div>
            <div>Reminder</div>
          </div>

          {(Array.isArray(claim.actions) ? claim.actions : []).map((a) => (
            <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr 0.6fr 0.8fr 1.1fr", fontSize: 12, padding: 10, borderTop: "1px solid #f1f1f6" }}>
              <div style={{ fontWeight: 600 }}>{a.title}</div>
              <div>{a.ownerRole || "—"}</div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => updateAction(a.id, { status: "OPEN" })}
                  style={smallBtn(a.status === "OPEN")}
                >
                  OPEN
                </button>
                <button
                  onClick={() => updateAction(a.id, { status: "DONE" })}
                  style={smallBtn(a.status === "DONE")}
                >
                  DONE
                </button>
              </div>

              <div>{a.dueAt ? isoToLocal(a.dueAt) : "—"}</div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="datetime-local"
                  value={a.reminderAt ? toDatetimeLocal(a.reminderAt) : ""}
                  onChange={(e) => updateAction(a.id, { reminderAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, minWidth: 210 }}
                />
              </div>
            </div>
          ))}

          {(!claim.actions || claim.actions.length === 0) && (
            <div style={{ padding: 10, fontSize: 12, opacity: 0.7 }}>No actions yet.</div>
          )}
        </div>
      </div>

      {/* Draft templates */}
      <div style={{
        marginTop: 18,
        padding: 14,
        border: "1px solid #e7e7ef",
        borderRadius: 12,
        background: "#fbfcff",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 600 }}>Draft templates</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Templates only (AI draft generation can be added later)
          </div>
        </div>

        {draftsLoading && <div style={{ marginTop: 8, fontSize: 12 }}>Loading drafts…</div>}
        {draftsErr && <div style={{ marginTop: 8, fontSize: 12, color: "#b00020" }}>{draftsErr}</div>}

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, minmax(280px, 1fr))", gap: 12 }}>
          {(Array.isArray(drafts) ? drafts : []).map((d, idx) => (
            <div key={idx} style={{ border: "1px solid #ececf5", borderRadius: 12, background: "white", padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{d.type || "DRAFT"}</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{d.subject || "—"}</div>

              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => copyToClipboard((d.subject ? `Subject: ${d.subject}\n\n` : "") + (d.body || ""))}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #d9d9e6",
                    background: "#f7f8ff",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  Copy
                </button>
              </div>

              <pre style={{
                marginTop: 10,
                whiteSpace: "pre-wrap",
                fontSize: 12,
                background: "#fafbff",
                border: "1px solid #eef0ff",
                padding: 10,
                borderRadius: 10,
                maxHeight: 220,
                overflow: "auto",
              }}>
{d.body || ""}
              </pre>
            </div>
          ))}
        </div>

        {(!drafts || drafts.length === 0) && !draftsLoading && !draftsErr && (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>No templates available.</div>
        )}
      </div>

      {/* Audit trail */}
      <div style={{
        marginTop: 18,
        padding: 14,
        border: "1px solid #e7e7ef",
        borderRadius: 12,
        background: "#fbfcff",
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Audit trail</div>

        <div style={{
          border: "1px solid #ececf5",
          borderRadius: 10,
          background: "white",
          padding: 10,
          maxHeight: 220,
          overflow: "auto",
          fontSize: 12,
        }}>
          {(Array.isArray(claim.auditTrail) ? claim.auditTrail : []).slice().reverse().map((a, idx) => (
            <div key={idx} style={{ padding: "6px 0", borderBottom: idx === 0 ? "none" : "1px solid #f2f2f8" }}>
              <div><b>{a.action}</b> — {isoToLocal(a.at)}</div>
              <div style={{ opacity: 0.75 }}>by {a.by}{a.note ? ` • ${a.note}` : ""}</div>
            </div>
          ))}
          {(!claim.auditTrail || claim.auditTrail.length === 0) && (
            <div style={{ opacity: 0.7 }}>No audit entries yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d9d9e6",
  background: "white",
  outline: "none",
};

function smallBtn(active) {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${active ? "#0b5cff" : "#d9d9e6"}`,
    background: active ? "#eaf1ff" : "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 11,
  };
}

function toDatetimeLocal(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return "";
  }
}
