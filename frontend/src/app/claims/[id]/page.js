"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

function fmtMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

async function apiGet(url) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json: j };
}

async function apiPatch(url, body) {
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json: j };
}

async function apiPost(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json: j };
}

export default function ClaimDetailPage() {
  const params = useParams();
  const router = useRouter();

  // IMPORTANT: in Next 15/16 app router, useParams is the safest way for client pages
  const claimId = useMemo(() => {
    const id = params?.id;
    return Array.isArray(id) ? id[0] : id;
  }, [params]);

  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Finance form state
  const [currency, setCurrency] = useState("USD");
  const [reserveEstimated, setReserveEstimated] = useState("");
  const [deductible, setDeductible] = useState("");
  const [recovered, setRecovered] = useState("");
  const [financeNotes, setFinanceNotes] = useState("");

  // Drafts
  const [drafts, setDrafts] = useState([]);
  const [draftsErr, setDraftsErr] = useState("");

  async function load() {
    if (!claimId) {
      setErr("Missing claim id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");

    const r = await apiGet(`/api/claims/${claimId}`);
    if (!r.ok) {
      setErr(`Claim load failed (HTTP ${r.status})`);
      setLoading(false);
      return;
    }

    const c = r.json?.data;
    setClaim(c);

    const fin = c?.finance || {};
    setCurrency(fin.currency || "USD");
    setReserveEstimated(String(fin.reserveEstimated ?? ""));
    setDeductible(String(fin.deductible ?? ""));
    setRecovered(String(fin.recovered ?? ""));
    setFinanceNotes(fin.notes || "");

    setLoading(false);
  }

  async function loadDrafts() {
    if (!claimId) return;
    setDraftsErr("");
    const r = await apiGet(`/api/claims/${claimId}/drafts`);
    if (!r.ok) {
      setDraftsErr(`Drafts failed (HTTP ${r.status})`);
      return;
    }
    setDrafts(r.json?.data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  useEffect(() => {
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  async function saveFinance() {
    if (!claimId) {
      alert("Missing claim id.");
      return;
    }
    const payload = {
      by: "Kartik",
      finance: {
        currency: currency || "USD",
        reserveEstimated: Number(reserveEstimated || 0),
        deductible: Number(deductible || 0),
        recovered: Number(recovered || 0),
        notes: financeNotes || "",
      },
    };

    const r = await apiPatch(`/api/claims/${claimId}/finance`, payload);
    if (!r.ok) {
      alert(r.json?.message || `Save finance failed (HTTP ${r.status})`);
      return;
    }
    await load();
  }

  async function updateProgress(newStatus) {
    if (!claimId) {
      alert("Missing claim id.");
      return;
    }
    const r = await apiPatch(`/api/claims/${claimId}/progress`, {
      by: "Kartik",
      progressStatus: newStatus,
    });
    if (!r.ok) {
      alert(r.json?.message || `Progress update failed (HTTP ${r.status})`);
      return;
    }
    await load();
  }

  async function updateAction(actionId, nextStatus) {
    if (!claimId) {
      alert("Missing claim id.");
      return;
    }
    const r = await apiPatch(`/api/claims/${claimId}/actions/${actionId}`, {
      by: "Kartik",
      status: nextStatus,
    });
    if (!r.ok) {
      alert(r.json?.message || `Action update failed (HTTP ${r.status})`);
      return;
    }
    await load();
    await loadDrafts();
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied.");
    } catch {
      alert("Copy failed. Try manual copy.");
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <a href="/claims">← Back to claims</a>
        <div style={{ marginTop: 16 }}>Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <a href="/claims">← Back to claims</a>
        <div style={{ marginTop: 16, color: "#b00020" }}>Error: {err}</div>
      </div>
    );
  }

  const extraction = claim?.extraction || {};
  const classification = claim?.classification || {};
  const covers = (classification.covers || []).map((c) => c.type).join(", ") || "—";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", background: "#f7f9fc", minHeight: "100vh" }}>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => router.push("/claims")} style={{ border: "1px solid #d9e2ef", background: "white", padding: "8px 10px", borderRadius: 8 }}>
          ← Back to claims
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16, alignItems: "start" }}>
        <div style={{ background: "white", border: "1px solid #e6edf7", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: "#5b6b86" }}>Claim</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{claim?.claimNumber}</div>
              <div style={{ marginTop: 6, color: "#2b3a55" }}>
                <b>Vessel:</b> {extraction.vesselName || "—"}{" "}
                {extraction.imo ? <span style={{ color: "#5b6b86" }}>(IMO {extraction.imo})</span> : null}
              </div>
              <div style={{ marginTop: 4, color: "#2b3a55" }}>
                <b>Date:</b> {extraction.eventDateText || "—"} &nbsp; <b>Location:</b> {extraction.locationText || "—"}
              </div>
              <div style={{ marginTop: 4, color: "#2b3a55" }}>
                <b>Status:</b> {claim?.progressStatus || "—"} &nbsp; <b>Covers:</b> {covers}
              </div>

              {/* AI badge */}
              <div style={{ marginTop: 8, fontSize: 12, color: "#5b6b86" }}>
                AI extraction:{" "}
                {extraction.ai?.used ? (
                  <span>
                    used ({extraction.ai?.model || "model"}) • confidence:{" "}
                    {typeof extraction.ai?.confidence === "number" ? extraction.ai.confidence.toFixed(2) : "—"}
                  </span>
                ) : (
                  <span>not used</span>
                )}
              </div>
            </div>

            <div style={{ minWidth: 260 }}>
              <div style={{ fontSize: 12, color: "#5b6b86" }}>Update progress</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {["Notification Received", "Insurers Notified", "Survey Appointed", "Reserved", "Settled", "Closed"].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateProgress(s)}
                    style={{
                      border: "1px solid #d9e2ef",
                      background: s === claim?.progressStatus ? "#eaf1ff" : "white",
                      padding: "8px 10px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: "#5b6b86", marginBottom: 6 }}>First notification (raw)</div>
            <pre style={{ whiteSpace: "pre-wrap", background: "#f3f6fb", border: "1px solid #e6edf7", padding: 12, borderRadius: 12, margin: 0 }}>
              {extraction.rawText || ""}
            </pre>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Actions</div>
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              {(claim?.actions || []).map((a) => (
                <div key={a.id} style={{ border: "1px solid #e6edf7", borderRadius: 12, padding: 10, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: "#5b6b86" }}>
                        {a.ownerRole} • due {a.dueAt ? new Date(a.dueAt).toLocaleString() : "—"} • reminder{" "}
                        {a.reminderAt ? new Date(a.reminderAt).toLocaleString() : "—"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ fontSize: 12, padding: "6px 10px", borderRadius: 999, border: "1px solid #d9e2ef" }}>
                        {a.status}
                      </span>
                      {a.status === "OPEN" ? (
                        <button onClick={() => updateAction(a.id, "DONE")} style={{ border: "1px solid #d9e2ef", background: "#e8fff1", padding: "6px 10px", borderRadius: 10 }}>
                          Mark done
                        </button>
                      ) : (
                        <button onClick={() => updateAction(a.id, "OPEN")} style={{ border: "1px solid #d9e2ef", background: "#fff7e8", padding: "6px 10px", borderRadius: 10 }}>
                          Re-open
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: "white", border: "1px solid #e6edf7", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Finance</div>
            <div style={{ fontSize: 12, color: "#5b6b86", marginTop: 6 }}>
              Reserve: {fmtMoney(claim?.finance?.reserveEstimated)} • Recovered: {fmtMoney(claim?.finance?.recovered)} • Outstanding:{" "}
              {fmtMoney(claim?.finance?.outstanding)}
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label style={{ fontSize: 12, color: "#5b6b86" }}>
                Currency
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ width: "100%", marginTop: 4, padding: 10, borderRadius: 10, border: "1px solid #d9e2ef" }} />
              </label>

              <label style={{ fontSize: 12, color: "#5b6b86" }}>
                Reserve Estimated
                <input value={reserveEstimated} onChange={(e) => setReserveEstimated(e.target.value)} style={{ width: "100%", marginTop: 4, padding: 10, borderRadius: 10, border: "1px solid #d9e2ef" }} />
              </label>

              <label style={{ fontSize: 12, color: "#5b6b86" }}>
                Deductible
                <input value={deductible} onChange={(e) => setDeductible(e.target.value)} style={{ width: "100%", marginTop: 4, padding: 10, borderRadius: 10, border: "1px solid #d9e2ef" }} />
              </label>

              <label style={{ fontSize: 12, color: "#5b6b86" }}>
                Recovered
                <input value={recovered} onChange={(e) => setRecovered(e.target.value)} style={{ width: "100%", marginTop: 4, padding: 10, borderRadius: 10, border: "1px solid #d9e2ef" }} />
              </label>

              <label style={{ fontSize: 12, color: "#5b6b86" }}>
                Notes
                <textarea value={financeNotes} onChange={(e) => setFinanceNotes(e.target.value)} rows={4} style={{ width: "100%", marginTop: 4, padding: 10, borderRadius: 10, border: "1px solid #d9e2ef" }} />
              </label>

              <button onClick={saveFinance} style={{ border: "1px solid #d9e2ef", background: "#eaf1ff", padding: "10px 12px", borderRadius: 12, fontWeight: 600 }}>
                Save finance
              </button>
            </div>
          </div>

          <div style={{ background: "white", border: "1px solid #e6edf7", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Draft templates</div>
            {draftsErr ? <div style={{ marginTop: 8, color: "#b00020" }}>{draftsErr}</div> : null}

            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {(drafts || []).map((d, i) => (
                <div key={`${d.type}-${i}`} style={{ border: "1px solid #e6edf7", borderRadius: 12, padding: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#5b6b86" }}>{d.type}</div>
                  <div style={{ marginTop: 6, fontWeight: 600 }}>{d.subject}</div>
                  <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, background: "#f3f6fb", padding: 10, borderRadius: 10, border: "1px solid #e6edf7" }}>
                    {d.body}
                  </pre>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button onClick={() => copyToClipboard(d.subject)} style={{ border: "1px solid #d9e2ef", background: "white", padding: "8px 10px", borderRadius: 10 }}>
                      Copy subject
                    </button>
                    <button onClick={() => copyToClipboard(d.body)} style={{ border: "1px solid #d9e2ef", background: "white", padding: "8px 10px", borderRadius: 10 }}>
                      Copy body
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <button onClick={loadDrafts} style={{ border: "1px solid #d9e2ef", background: "white", padding: "10px 12px", borderRadius: 12 }}>
                Refresh drafts
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
