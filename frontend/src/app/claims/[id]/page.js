"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ClaimDetailPage() {
  const params = useParams();
  const claimId = params?.id;

  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  const [progressStatus, setProgressStatus] = useState("");
  const [finance, setFinance] = useState({
    currency: "USD",
    reserveEstimated: 0,
    deductible: 0,
    recovered: 0,
    notes: "",
  });

  async function loadClaim() {
    if (!claimId) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/claims/${claimId}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Failed to load claim");

      setClaim(json.data);
      setProgressStatus(json.data.progressStatus || "");
      setFinance({
        currency: json.data.finance?.currency || "USD",
        reserveEstimated: json.data.finance?.reserveEstimated || 0,
        deductible: json.data.finance?.deductible || 0,
        recovered: json.data.finance?.recovered || 0,
        notes: json.data.finance?.notes || "",
      });
    } catch (e) {
      setErr(e.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!claimId) return;
    loadClaim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  async function markActionDone(actionId) {
    try {
      const res = await fetch(`/api/claims/${claimId}/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          by: "Kartik",
          status: "DONE",
          notes: "Marked done from UI",
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Failed to update action");
      await loadClaim();
    } catch (e) {
      alert(e.message || "Action update failed");
    }
  }

  async function saveFinance() {
    try {
      const res = await fetch(`/api/claims/${claimId}/finance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          by: "Kartik",
          finance: {
            currency: finance.currency,
            reserveEstimated: Number(finance.reserveEstimated || 0),
            deductible: Number(finance.deductible || 0),
            recovered: Number(finance.recovered || 0),
            notes: finance.notes || "",
          },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Failed to update finance");
      await loadClaim();
      alert("Finance updated");
    } catch (e) {
      alert(e.message || "Finance update failed");
    }
  }

  async function saveProgress() {
    try {
      const res = await fetch(`/api/claims/${claimId}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          by: "Kartik",
          progressStatus,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Failed to update progress");
      await loadClaim();
      alert("Progress updated");
    } catch (e) {
      alert(e.message || "Progress update failed");
    }
  }

  async function generateDrafts() {
    setDrafts([]);
    setDraftsLoading(true);
    try {
      const res = await fetch(`/api/claims/${claimId}/drafts`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Failed to generate drafts");
      setDrafts(json.data || []);
    } catch (e) {
      alert(e.message || "Draft generation failed");
    } finally {
      setDraftsLoading(false);
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied");
    } catch {
      alert("Copy failed (browser permissions).");
    }
  }

  if (!claimId) return <div style={styles.state}>Loading route…</div>;
  if (loading) return <div style={styles.state}>Loading claim…</div>;

  if (err)
    return (
      <div style={{ ...styles.state, color: "#9B1C1C" }}>
        Error: {err}
        <div style={{ marginTop: 10 }}>
          <a href="/" style={styles.link}>
            ← Back to claims
          </a>
        </div>
      </div>
    );

  const ex = claim?.extraction || {};
  const covers = (claim?.classification?.covers || []).map((c) => c.type).filter(Boolean);

  return (
    <div style={styles.page}>
      <div style={styles.topRow}>
        <a href="/" style={styles.link}>
          ← Back to claims
        </a>
        <button onClick={loadClaim} style={styles.btn}>
          Refresh
        </button>
      </div>

      <div style={styles.headerCard}>
        <div>
          <div style={styles.claimNo}>{claim.claimNumber}</div>
          <div style={styles.meta}>
            <div>
              <span style={styles.k}>Vessel:</span> {ex.vesselName || "-"}
            </div>
            <div>
              <span style={styles.k}>Date:</span> {ex.eventDateText || "-"}
            </div>
            <div>
              <span style={styles.k}>Location:</span> {ex.locationText || "-"}
            </div>
          </div>

          <div style={styles.pills}>
            {covers.length ? (
              covers.map((c) => (
                <span key={c} style={styles.pill}>
                  {c}
                </span>
              ))
            ) : (
              <span style={styles.pillMuted}>No cover classified</span>
            )}
          </div>
        </div>

        <div>
          <div style={styles.smallLabel}>Progress status</div>
          <div style={styles.inlineRow}>
            <input
              value={progressStatus}
              onChange={(e) => setProgressStatus(e.target.value)}
              style={styles.input}
              placeholder="e.g. Insurers Notified / Survey Appointed / Settled"
            />
            <button onClick={saveProgress} style={styles.btnPrimary}>
              Save
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={styles.smallLabel}>Outstanding (server)</div>
            <div style={styles.money}>
              {(claim.finance?.outstanding ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Actions</div>
          <div style={styles.cardSub}>Mark tasks done and keep the case moving.</div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {(claim.actions || []).map((a) => (
              <div key={a.id} style={styles.actionRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.actionTitle}>{a.title}</div>
                  <div style={styles.actionMeta}>
                    Role: {a.ownerRole} • Due: {fmtDate(a.dueAt)} • Status:{" "}
                    <b>{a.status}</b>
                  </div>
                </div>

                {a.status !== "DONE" ? (
                  <button onClick={() => markActionDone(a.id)} style={styles.btnSmall}>
                    Mark DONE
                  </button>
                ) : (
                  <span style={styles.doneBadge}>DONE</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Finance</div>
            <div style={styles.cardSub}>Update reserve, deductible, recovery.</div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <Field label="Currency">
                <input
                  value={finance.currency}
                  onChange={(e) => setFinance({ ...finance, currency: e.target.value })}
                  style={styles.input}
                />
              </Field>

              <Field label="Reserve Estimated">
                <input
                  type="number"
                  value={finance.reserveEstimated}
                  onChange={(e) => setFinance({ ...finance, reserveEstimated: e.target.value })}
                  style={styles.input}
                />
              </Field>

              <Field label="Deductible">
                <input
                  type="number"
                  value={finance.deductible}
                  onChange={(e) => setFinance({ ...finance, deductible: e.target.value })}
                  style={styles.input}
                />
              </Field>

              <Field label="Recovered">
                <input
                  type="number"
                  value={finance.recovered}
                  onChange={(e) => setFinance({ ...finance, recovered: e.target.value })}
                  style={styles.input}
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={finance.notes}
                  onChange={(e) => setFinance({ ...finance, notes: e.target.value })}
                  style={{ ...styles.input, height: 90, resize: "vertical" }}
                />
              </Field>

              <button onClick={saveFinance} style={styles.btnPrimary}>
                Save Finance
              </button>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardTitle}>AI Drafts</div>
            <div style={styles.cardSub}>Generate drafts and copy in one click.</div>

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <button onClick={generateDrafts} style={styles.btnPrimary}>
                Generate Drafts
              </button>
              {draftsLoading ? (
                <div style={{ ...styles.smallLabel, alignSelf: "center" }}>
                  Generating…
                </div>
              ) : null}
            </div>

            {drafts.length ? (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {drafts.map((d, idx) => (
                  <div key={idx} style={styles.draftBox}>
                    <div style={styles.draftTop}>
                      <div>
                        <div style={styles.draftType}>{d.type}</div>
                        <div style={styles.draftSubject}>{d.subject}</div>
                      </div>
                      <button
                        onClick={() => copyText(`Subject: ${d.subject}\n\n${d.body}`)}
                        style={styles.btnSmall}
                      >
                        Copy
                      </button>
                    </div>
                    <pre style={styles.pre}>{d.body}</pre>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ ...styles.state, marginTop: 12 }}>No drafts yet.</div>
            )}
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Audit Trail</div>
        <div style={styles.cardSub}>Chronological actions.</div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {(claim.auditTrail || []).slice().reverse().map((a, idx) => (
            <div key={idx} style={styles.auditRow}>
              <div style={styles.auditAt}>{fmtDate(a.at)}</div>
              <div style={styles.auditMain}>
                <b>{a.action}</b> — {a.note}
                <div style={styles.auditBy}>by {a.by}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>First Notification (Raw)</div>
        <pre style={styles.pre}>{ex.rawText || "-"}</pre>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={styles.smallLabel}>{label}</div>
      {children}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const styles = {
  page: { display: "grid", gap: 14 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  link: { color: "#1F3B77", textDecoration: "none", fontWeight: 800 },

  headerCard: {
    background: "#FFFFFF",
    border: "1px solid #E6EAF2",
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    boxShadow: "0 1px 0 rgba(10,20,40,0.03)",
  },
  claimNo: { fontSize: 18, fontWeight: 950 },
  meta: { marginTop: 8, display: "grid", gap: 4, fontSize: 13, color: "#23314A" },
  k: { color: "#51607A", fontWeight: 800 },

  pills: { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" },
  pill: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "#F1F6FF",
    border: "1px solid #D9E6FF",
    color: "#1F3B77",
    fontSize: 12,
    fontWeight: 900,
  },
  pillMuted: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "#FBFCFE",
    border: "1px solid #EEF1F6",
    color: "#7A879D",
    fontSize: 12,
    fontWeight: 800,
  },

  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },

  card: {
    background: "#FFFFFF",
    border: "1px solid #E6EAF2",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 1px 0 rgba(10,20,40,0.03)",
  },
  cardTitle: { fontSize: 14, fontWeight: 950 },
  cardSub: { marginTop: 4, fontSize: 12, color: "#51607A" },

  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #EEF1F6",
    background: "#FFFFFF",
    fontWeight: 850,
    cursor: "pointer",
  },
  btnPrimary: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #D9E6FF",
    background: "#EEF4FF",
    fontWeight: 950,
    cursor: "pointer",
    color: "#1F3B77",
  },
  btnSmall: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #D9E6FF",
    background: "#EEF4FF",
    fontWeight: 950,
    cursor: "pointer",
    color: "#1F3B77",
    whiteSpace: "nowrap",
  },

  inlineRow: { display: "flex", gap: 10, alignItems: "center" },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E6EAF2",
    outline: "none",
    background: "#FBFCFE",
    fontSize: 13,
  },
  smallLabel: { fontSize: 12, color: "#51607A", fontWeight: 900 },

  state: {
    padding: 14,
    background: "#FBFCFE",
    border: "1px solid #EEF1F6",
    borderRadius: 14,
    color: "#51607A",
    fontSize: 13,
  },

  actionRow: {
    border: "1px solid #EEF1F6",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    gap: 12,
    alignItems: "center",
    background: "#FBFCFE",
  },
  actionTitle: { fontSize: 13, fontWeight: 950 },
  actionMeta: { marginTop: 4, fontSize: 12, color: "#51607A" },
  doneBadge: {
    padding: "8px 10px",
    borderRadius: 999,
    background: "#ECFDF3",
    border: "1px solid #A7F3D0",
    color: "#065F46",
    fontSize: 12,
    fontWeight: 950,
  },

  money: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: 950,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },

  draftBox: {
    border: "1px solid #EEF1F6",
    borderRadius: 14,
    padding: 12,
    background: "#FBFCFE",
  },
  draftTop: { display: "flex", justifyContent: "space-between", gap: 10 },
  draftType: { fontSize: 12, fontWeight: 950, color: "#1F3B77" },
  draftSubject: { marginTop: 4, fontSize: 12, color: "#23314A", fontWeight: 900 },

  pre: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    border: "1px solid #EEF1F6",
    background: "#FFFFFF",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },

  auditRow: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: 10,
    padding: 10,
    border: "1px solid #EEF1F6",
    borderRadius: 14,
    background: "#FBFCFE",
  },
  auditAt: {
    fontSize: 12,
    color: "#51607A",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  auditMain: { fontSize: 13, color: "#23314A" },
  auditBy: { marginTop: 4, fontSize: 12, color: "#7A879D" },
};
