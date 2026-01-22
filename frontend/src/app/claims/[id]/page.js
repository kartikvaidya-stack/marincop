"use client";

import { use as usePromise, useEffect, useMemo, useState } from "react";
import Link from "next/link";

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function isoNow() {
  return new Date().toISOString();
}

function safe(v, fallback = "—") {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s.length ? s : fallback;
}

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text);
}

function buildDraftsFromClaim(claim) {
  const cn = safe(claim?.claimNumber, "MC-UNKNOWN");
  const company = safe(claim?.company, "Nova Carriers");
  const createdBy = safe(claim?.createdBy, "Claims Team");

  const ex = claim?.extraction || {};
  const vessel = safe(ex?.vesselName || claim?.vesselName, "—");
  const imo = safe(ex?.imo, "—");
  const dt = safe(ex?.eventDateText, "—");
  const loc = safe(ex?.locationText, "—");
  const raw = safe(ex?.rawText, "");

  const header = `Claim Ref: ${cn}\nVessel: ${vessel}${imo !== "—" ? ` (IMO ${imo})` : ""}\nDate/Time (as advised): ${dt}\nLocation/Position: ${loc}`;
  const incidentBlock = raw ? `Initial description (as received):\n${raw}` : "Initial description: (not provided)";
  const preserve =
    `Evidence / documents to preserve:\n` +
    `- Photos/videos\n` +
    `- Deck/engine log extracts\n` +
    `- Pilot card / passage plan / VDR (as applicable)\n` +
    `- Statements (Master/crew)\n` +
    `- Port/terminal correspondence\n` +
    `- Damage report / repair quotation\n` +
    `- SOF / time records if delays arise`;

  const drafts = [];

  drafts.push({
    type: "P&I_NOTIFICATION",
    title: "P&I — Initial Notification",
    subject: `[${cn}] - ${vessel} - P&I Notification (Initial)`,
    body:
      `Dear P&I Club / Correspondents,\n\n` +
      `We hereby give initial notification of an incident that may give rise to liabilities and/or costs falling within P&I cover.\n\n` +
      `${header}\n\n` +
      `${incidentBlock}\n\n` +
      `Immediate actions taken / proposed:\n` +
      `- Evidence preservation initiated\n` +
      `- Please advise recommended next steps and whether surveyor/correspondent attendance is required\n` +
      `- Please confirm any specific reporting format / documents required\n\n` +
      `${preserve}\n\n` +
      `Kindly acknowledge receipt and advise course of action.\n\n` +
      `Best regards,\n${company}\n(${createdBy})`,
  });

  drafts.push({
    type: "H&M_NOTICE",
    title: "H&M — Notice of Damage / Claim Intimation",
    subject: `[${cn}] - ${vessel} - H&M Notice of Damage (Initial)`,
    body:
      `Dear Hull & Machinery Underwriters / Brokers,\n\n` +
      `We hereby give notice of an occurrence that may result in damage and/or costs falling within H&M cover (subject to policy terms, deductible and exclusions).\n\n` +
      `${header}\n\n` +
      `${incidentBlock}\n\n` +
      `Present understanding of damage (initial):\n` +
      `- (Describe: e.g., denting to shell plating / fender contact / scrape marks)\n` +
      `- No further details at this stage (survey pending)\n\n` +
      `Actions requested:\n` +
      `- Please acknowledge notice\n` +
      `- Please advise surveyor appointment (if required) and any reporting requirements\n\n` +
      `${preserve}\n\n` +
      `Best regards,\n${company}\n(${createdBy})`,
  });

  drafts.push({
    type: "SURVEYOR_APPOINTMENT",
    title: "Surveyor — Appointment Request",
    subject: `[${cn}] - ${vessel} - Survey Appointment Request`,
    body:
      `Dear Sir/Madam,\n\n` +
      `${company} requests your attendance / appointment as surveyor in relation to the below incident.\n\n` +
      `${header}\n\n` +
      `${incidentBlock}\n\n` +
      `Please confirm:\n` +
      `1) Earliest attendance and ETA\n` +
      `2) Information/documents required prior attendance\n` +
      `3) Expected deliverables and timeline for preliminary and final report\n\n` +
      `We will provide photographs, statements, and relevant extracts upon confirmation.\n\n` +
      `Best regards,\n${company}\n(${createdBy})`,
  });

  drafts.push({
    type: "BERTH_DAMAGE_NOTICE",
    title: "Terminal/Port — Berth / Fender Contact Notice",
    subject: `[${cn}] - ${vessel} - Notice of Incident (Berth/Terminal Contact)`,
    body:
      `Dear Terminal / Port Authority,\n\n` +
      `We refer to an incident involving ${vessel}${imo !== "—" ? ` (IMO ${imo})` : ""} on ${dt} at/near ${loc}.\n\n` +
      `${incidentBlock}\n\n` +
      `At this stage, our understanding is preliminary and subject to investigation and survey.\n\n` +
      `We request:\n` +
      `- Copies of any CCTV footage / incident logs / berth records\n` +
      `- Details of any alleged damage to berth/fender and repair estimates (if any)\n` +
      `- Contact details for your appointed representative\n\n` +
      `We will revert with further information once survey findings are available.\n\n` +
      `Best regards,\n${company}\n(${createdBy})`,
  });

  drafts.push({
    type: "CHASE_REMINDER",
    title: "Chase — Follow-up Reminder",
    subject: `[${cn}] - ${vessel} - Follow-up / Chase`,
    body:
      `Dear All,\n\n` +
      `Gentle reminder / follow-up in relation to Claim Ref ${cn} (${vessel}).\n\n` +
      `Pending item(s):\n- (e.g., survey attendance / preliminary report / final report / repair quotation / insurer feedback)\n\n` +
      `Kindly provide an update and expected timeline.\n\n` +
      `Best regards,\n${company}\n(${createdBy})`,
  });

  return drafts;
}

export default function ClaimDetailPage({ params }) {
  // Next 16: params can be a Promise in client components
  const p = params && typeof params.then === "function" ? usePromise(params) : params;
  const claimId = p?.id;

  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [statusBusy, setStatusBusy] = useState(false);
  const [financeBusy, setFinanceBusy] = useState(false);

  const [progressStatus, setProgressStatus] = useState("");
  const [finance, setFinance] = useState({
    currency: "USD",
    reserveEstimated: 0,
    deductible: 0,
    recovered: 0,
    notes: "",
  });

  const drafts = useMemo(() => {
    if (!claim) return [];
    return buildDraftsFromClaim(claim);
  }, [claim]);

  async function load() {
    if (!claimId) return;
    setErr("");
    setLoading(true);
    try {
      // IMPORTANT: use frontend API route (works on Vercel)
      const r = await fetch(`/api/claims/${claimId}`, { cache: "no-store" });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.message || data?.error || `Claim load failed (HTTP ${r.status})`);
      setClaim(data.data);

      setProgressStatus(data.data?.progressStatus || "");
      const f = data.data?.finance || {};
      setFinance({
        currency: f.currency || "USD",
        reserveEstimated: Number(f.reserveEstimated || 0),
        deductible: Number(f.deductible || 0),
        recovered: Number(f.recovered || 0),
        notes: f.notes || "",
      });
    } catch (e) {
      setErr(e?.message || "Failed to load claim");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  // NOTE: buttons below still call backend directly in earlier version.
  // We will proxy PATCH routes next (Step 9C) so these work on Vercel too.
  async function updateProgress() {
    setStatusBusy(true);
    try {
      const r = await fetch(`/api/claims/${claimId}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: "Kartik", progressStatus: progressStatus || "Updated", at: isoNow() }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.message || data?.error || `Progress update failed (HTTP ${r.status})`);
      await load();
    } catch (e) {
      alert(e?.message || "Failed to update progress");
    } finally {
      setStatusBusy(false);
    }
  }

  async function updateFinance() {
    setFinanceBusy(true);
    try {
      const r = await fetch(`/api/claims/${claimId}/finance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: "Kartik", finance }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.message || data?.error || `Finance update failed (HTTP ${r.status})`);
      await load();
    } catch (e) {
      alert(e?.message || "Failed to update finance");
    } finally {
      setFinanceBusy(false);
    }
  }

  async function updateAction(actionId, patch) {
    try {
      const r = await fetch(`/api/claims/${claimId}/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: "Kartik", ...patch }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.message || data?.error || `Action update failed (HTTP ${r.status})`);
      await load();
    } catch (e) {
      alert(e?.message || "Failed to update action");
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ color: "#667085" }}>Loading claim…</div>
      </div>
    );
  }

  if (err || !claim) {
    return (
      <div style={{ padding: 24, maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ marginBottom: 12 }}>
          <Link href="/" style={{ textDecoration: "none", fontWeight: 800, color: "#1570EF" }}>
            ← Back to claims
          </Link>
        </div>
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: "#FEF3F2",
            border: "1px solid #FDA29B",
            color: "#B42318",
            fontWeight: 800,
          }}
        >
          Error: {err || "Claim not found"}
        </div>
      </div>
    );
  }

  const ex = claim.extraction || {};
  const coverList = (claim.covers || []).join(", ") || "—";

  return (
    <div style={{ padding: 24, maxWidth: 1120, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ color: "#667085", fontWeight: 900, fontSize: 13 }}>Claim</div>
          <h1 style={{ margin: 0, fontSize: 26 }}>{claim.claimNumber}</h1>
          <div style={{ marginTop: 6, color: "#667085" }}>
            {safe(ex.vesselName || claim.vesselName)} • {safe(ex.eventDateText)} • {safe(ex.locationText)} • Covers:{" "}
            {coverList}
          </div>
        </div>

        <Link
          href="/"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #D0D5DD",
            background: "#FFFFFF",
            fontWeight: 800,
            textDecoration: "none",
            color: "#101828",
          }}
        >
          ← Back
        </Link>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={panel}>
          <div style={panelHeader}>
            <div style={{ fontWeight: 950 }}>Progress</div>
            <div style={{ color: "#667085", fontSize: 13 }}>Status log drives reminders & reporting</div>
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, alignItems: "center" }}>
              <div style={label}>Progress status</div>
              <input
                value={progressStatus}
                onChange={(e) => setProgressStatus(e.target.value)}
                placeholder="e.g., Insurers Notified / Survey Appointed / Under Review / Settled"
                style={input}
              />
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <button
                onClick={updateProgress}
                disabled={statusBusy}
                style={{
                  ...btnPrimary,
                  background: statusBusy ? "#B2DDFF" : "#1570EF",
                  cursor: statusBusy ? "not-allowed" : "pointer",
                }}
              >
                {statusBusy ? "Saving..." : "Save Progress"}
              </button>
            </div>

            <div style={{ marginTop: 12, color: "#667085", fontSize: 13 }}>
              Latest status: <b style={{ color: "#101828" }}>{safe(claim.progressStatus)}</b>
            </div>
          </div>
        </div>

        <div style={panel}>
          <div style={panelHeader}>
            <div style={{ fontWeight: 950 }}>Finance</div>
            <div style={{ color: "#667085", fontSize: 13 }}>Reserve, recovered and outstanding exposure</div>
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
              <div style={label}>Currency</div>
              <input value={finance.currency} onChange={(e) => setFinance({ ...finance, currency: e.target.value })} style={input} />

              <div style={label}>Reserve (estimate)</div>
              <input
                type="number"
                value={finance.reserveEstimated}
                onChange={(e) => setFinance({ ...finance, reserveEstimated: Number(e.target.value || 0) })}
                style={input}
              />

              <div style={label}>Deductible</div>
              <input
                type="number"
                value={finance.deductible}
                onChange={(e) => setFinance({ ...finance, deductible: Number(e.target.value || 0) })}
                style={input}
              />

              <div style={label}>Recovered</div>
              <input
                type="number"
                value={finance.recovered}
                onChange={(e) => setFinance({ ...finance, recovered: Number(e.target.value || 0) })}
                style={input}
              />

              <div style={label}>Notes</div>
              <textarea
                rows={3}
                value={finance.notes}
                onChange={(e) => setFinance({ ...finance, notes: e.target.value })}
                style={{ ...input, height: "auto" }}
              />
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={updateFinance}
                disabled={financeBusy}
                style={{
                  ...btnPrimary,
                  background: financeBusy ? "#B2DDFF" : "#1570EF",
                  cursor: financeBusy ? "not-allowed" : "pointer",
                }}
              >
                {financeBusy ? "Saving..." : "Save Finance"}
              </button>

              <div style={{ marginLeft: "auto", color: "#667085", fontSize: 13 }}>
                Outstanding: <b style={{ color: "#101828" }}>{money(claim.finance?.outstanding || 0)}</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, ...panel }}>
        <div style={panelHeader}>
          <div style={{ fontWeight: 950 }}>First Notification (Raw)</div>
          <div style={{ color: "#667085", fontSize: 13 }}>This is the “single source of truth”</div>
        </div>
        <pre style={{ margin: 0, padding: 14, whiteSpace: "pre-wrap", background: "#FCFCFD", borderTop: "1px solid #EAECF0" }}>
{safe(ex.rawText || "", "(empty)")}
        </pre>
      </div>

      <div style={{ marginTop: 12, ...panel }}>
        <div style={panelHeader}>
          <div style={{ fontWeight: 950 }}>Actions</div>
          <div style={{ color: "#667085", fontSize: 13 }}>Track tasks + reminders per claim</div>
        </div>

        <div>
          {(claim.actions || []).map((a) => (
            <div key={a.id} style={{ borderTop: "1px solid #EAECF0", padding: 14, display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900 }}>{a.title}</div>
                <div style={{ color: "#667085", fontSize: 13 }}>
                  Owner: {a.ownerRole} • Due: {a.dueAt ? new Date(a.dueAt).toLocaleString() : "—"} • Reminder:{" "}
                  {a.reminderAt ? new Date(a.reminderAt).toLocaleString() : "—"}
                </div>
                <div style={{ color: "#667085", fontSize: 13, marginTop: 6 }}>{a.notes ? `Notes: ${a.notes}` : ""}</div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span
                  style={{
                    fontWeight: 900,
                    color: a.status === "DONE" ? "#067647" : "#B54708",
                    background: a.status === "DONE" ? "#ECFDF3" : "#FFFAEB",
                    border: "1px solid #EAECF0",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                  }}
                >
                  {a.status}
                </span>

                <button onClick={() => updateAction(a.id, { status: a.status === "DONE" ? "OPEN" : "DONE" })} style={{ ...btn, fontWeight: 900 }}>
                  {a.status === "DONE" ? "Reopen" : "Mark Done"}
                </button>
              </div>
            </div>
          ))}

          {(claim.actions || []).length === 0 ? <div style={{ padding: 14, color: "#667085" }}>No actions.</div> : null}
        </div>
      </div>

      <div style={{ marginTop: 12, ...panel }}>
        <div style={panelHeader}>
          <div style={{ fontWeight: 950 }}>Draft Templates</div>
          <div style={{ color: "#667085", fontSize: 13 }}>
            Templates generated from extracted claim facts (no AI cost). Choose a draft type → copy subject/body.
          </div>
        </div>

        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {drafts.map((d) => (
              <DraftCard key={d.type} draft={d} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, color: "#98A2B3", fontSize: 12 }}>
        Note: Patch routes for Progress/Finance/Actions are next (Step 9C) to work on Vercel. Claim load + drafts now work via /api/claims/[id].
      </div>
    </div>
  );
}

function DraftCard({ draft }) {
  const fullText = `Subject: ${draft.subject}\n\n${draft.body}`;

  return (
    <div
      style={{
        width: "calc(50% - 5px)",
        minWidth: 420,
        border: "1px solid #EAECF0",
        borderRadius: 12,
        background: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 12, borderBottom: "1px solid #EAECF0", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 950, flex: 1 }}>{draft.title}</div>
        <button onClick={() => copyToClipboard(fullText)} style={{ ...btn, fontWeight: 900 }}>
          Copy
        </button>
      </div>

      <div style={{ padding: 12, background: "#FCFCFD" }}>
        <div style={{ color: "#344054", fontWeight: 900, fontSize: 12 }}>Subject</div>
        <div style={{ marginTop: 6, fontWeight: 800, color: "#101828" }}>{draft.subject}</div>

        <div style={{ marginTop: 12, color: "#344054", fontWeight: 900, fontSize: 12 }}>Body</div>
        <pre style={{ marginTop: 6, marginBottom: 0, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.35 }}>
{draft.body}
        </pre>
      </div>
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

const label = { color: "#344054", fontWeight: 900, fontSize: 13 };

const input = {
  padding: "10px 12px",
  border: "1px solid #D0D5DD",
  borderRadius: 10,
  outline: "none",
  background: "#FCFCFD",
};

const btn = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #D0D5DD",
  background: "#FFFFFF",
  cursor: "pointer",
};

const btnPrimary = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #175CD3",
  background: "#1570EF",
  color: "#FFFFFF",
  cursor: "pointer",
  fontWeight: 900,
};
