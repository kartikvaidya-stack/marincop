"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function RemindersPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const res = await fetch("/api/claims/reminders/due", { cache: "no-store" });
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json?.message || `API error: ${res.status}`);
      }
      
      if (!json?.ok && json?.error) {
        throw new Error(json?.message || "API returned error");
      }
      
      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      setRows([]);
      setErr(e?.message || "Failed to fetch reminders.");
    }
  }

  useEffect(() => {
    load();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      load();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto", background: "#f6f8fb", minHeight: "100vh", padding: 16 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Reminders</div>
            <div style={{ color: "#556", fontSize: 13 }}>Overdue and upcoming reminders (next 30 days)</div>
          </div>
          <button onClick={load} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #d7deea", background: "white", cursor: "pointer" }}>
            Refresh
          </button>
        </div>

        {err ? (
          <div style={{ background: "#fff1f1", border: "1px solid #ffd0d0", color: "#900", padding: 12, borderRadius: 12 }}>
            Error: {err}
          </div>
        ) : null}

        <div style={{ background: "white", border: "1px solid #e6eaf2", borderRadius: 14, padding: 12 }}>
          {rows.length === 0 ? (
            <div style={{ color: "#667" }}>No due reminders right now.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 12, color: "#556" }}>
                    <th style={{ padding: "10px 8px" }}>Claim</th>
                    <th style={{ padding: "10px 8px" }}>Vessel</th>
                    <th style={{ padding: "10px 8px" }}>Action</th>
                    <th style={{ padding: "10px 8px" }}>Owner</th>
                    <th style={{ padding: "10px 8px" }}>Reminder At</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={`${r.claimId}-${r.actionId}`} style={{ background: idx % 2 ? "#fbfcff" : "white" }}>
                      <td style={{ padding: "10px 8px", fontWeight: 800 }}>
                        <Link href={`/claims/${r.claimId}`} style={{ color: "#0b5cff", textDecoration: "none" }}>
                          {r.claimNumber}
                        </Link>
                      </td>
                      <td style={{ padding: "10px 8px" }}>{r.vesselName || "—"}</td>
                      <td style={{ padding: "10px 8px" }}>{r.actionTitle || "—"}</td>
                      <td style={{ padding: "10px 8px" }}>{r.ownerRole || "—"}</td>
                      <td style={{ padding: "10px 8px" }}>{r.reminderAt || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
