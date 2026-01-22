"use client";

import { useEffect, useMemo, useState } from "react";

export default function RemindersPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // Show B: due + upcoming next 7 days
  const beforeIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  }, []);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/reminders?before=${encodeURIComponent(beforeIso)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Failed to load reminders");
      setItems(json.data || []);
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beforeIso]);

  async function snooze(item, days) {
    try {
      const res = await fetch(`/api/claims/${item.claimId}/actions/${item.actionId}/reminder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: "Kartik", snoozeDays: days }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Snooze failed");
      await load();
    } catch (e) {
      alert(e.message || "Snooze failed");
    }
  }

  const now = Date.now();
  const due = items.filter((x) => new Date(x.reminderAt).getTime() <= now);
  const upcoming = items.filter((x) => new Date(x.reminderAt).getTime() > now);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Reminders</div>
          <div style={styles.sub}>
            Due + upcoming (next 7 days). Use snooze to chase survey, settlement, documents.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="/" style={styles.linkBtn}>Back to Claims</a>
          <button onClick={load} style={styles.btn}>Refresh</button>
        </div>
      </div>

      {loading ? <div style={styles.state}>Loading…</div> : null}
      {err ? <div style={{ ...styles.state, color: "#9B1C1C" }}>Error: {err}</div> : null}

      {!loading && !err ? (
        <>
          <Section title={`Due (${due.length})`}>
            {due.length ? (
              due.map((it) => <ReminderRow key={it.actionId} it={it} snooze={snooze} due />)
            ) : (
              <div style={styles.state}>No due reminders.</div>
            )}
          </Section>

          <Section title={`Upcoming (next 7 days) (${upcoming.length})`}>
            {upcoming.length ? (
              upcoming.map((it) => <ReminderRow key={it.actionId} it={it} snooze={snooze} />)
            ) : (
              <div style={styles.state}>No upcoming reminders in next 7 days.</div>
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

function ReminderRow({ it, snooze, due }) {
  return (
    <div style={{ ...styles.row, ...(due ? styles.rowDue : {}) }}>
      <div style={{ flex: 1 }}>
        <div style={styles.rowTop}>
          <a href={`/claims/${it.claimId}`} style={styles.claimLink}>
            {it.claimNumber}
          </a>
          <span style={styles.pill}>{(it.coverTypes || []).join(", ") || "—"}</span>
        </div>
        <div style={styles.meta}>
          <b>{it.vesselName || "—"}</b> • {it.progressStatus || "—"} • Role: {it.ownerRole || "—"}
        </div>
        <div style={styles.action}>{it.actionTitle}</div>
        <div style={styles.meta}>
          Reminder: <b>{fmt(it.reminderAt)}</b> • Due: {fmt(it.dueAt)}
        </div>
      </div>

      <div style={styles.actions}>
        <a href={`/claims/${it.claimId}`} style={styles.btnSmallWhite}>Open</a>
        <button onClick={() => snooze(it, 1)} style={styles.btnSmall}>Snooze 1d</button>
        <button onClick={() => snooze(it, 3)} style={styles.btnSmall}>3d</button>
        <button onClick={() => snooze(it, 7)} style={styles.btnSmall}>7d</button>
      </div>
    </div>
  );
}

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const styles = {
  page: { display: "grid", gap: 14 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: 950 },
  sub: { marginTop: 4, fontSize: 12, color: "#51607A" },

  linkBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #EEF1F6",
    background: "#FFFFFF",
    fontWeight: 850,
    textDecoration: "none",
    color: "#1F3B77",
  },
  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #EEF1F6",
    background: "#FFFFFF",
    fontWeight: 850,
    cursor: "pointer",
  },

  card: {
    background: "#FFFFFF",
    border: "1px solid #E6EAF2",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 1px 0 rgba(10,20,40,0.03)",
  },
  cardTitle: { fontSize: 14, fontWeight: 950 },

  state: {
    padding: 14,
    background: "#FBFCFE",
    border: "1px solid #EEF1F6",
    borderRadius: 14,
    color: "#51607A",
    fontSize: 13,
  },

  row: {
    border: "1px solid #EEF1F6",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    background: "#FBFCFE",
  },
  rowDue: {
    background: "#FFF7ED",
    border: "1px solid #FED7AA",
  },

  rowTop: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  claimLink: { color: "#1F3B77", fontWeight: 950, textDecoration: "none" },
  pill: {
    padding: "4px 8px",
    borderRadius: 999,
    background: "#EEF4FF",
    border: "1px solid #D9E6FF",
    fontSize: 12,
    fontWeight: 850,
    color: "#1F3B77",
  },
  meta: { marginTop: 6, fontSize: 12, color: "#51607A" },
  action: { marginTop: 8, fontSize: 13, fontWeight: 850, color: "#23314A" },

  actions: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
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
  btnSmallWhite: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #EEF1F6",
    background: "#FFFFFF",
    fontWeight: 950,
    textDecoration: "none",
    color: "#1F3B77",
    whiteSpace: "nowrap",
  },
};
