"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewClaimPage() {
  const router = useRouter();

  const [createdBy, setCreatedBy] = useState("Kartik");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = useMemo(() => {
    return createdBy.trim().length > 0 && text.trim().length >= 20 && !busy;
  }, [createdBy, text, busy]);

  async function onSubmit() {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createdBy: createdBy.trim(),
          firstNotificationText: text.trim(),
        }),
      });

      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        const msg = data?.message || data?.error || `Failed to create claim (HTTP ${r.status}).`;
        throw new Error(msg);
      }

      const claimId = data?.data?.id;
      if (!claimId) throw new Error("Created claim but missing id in response.");
      router.push(`/claims/${claimId}`);
    } catch (e) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>New Claim</h1>
          <span style={{ color: "#667085" }}>
            Paste first notification - AI extracts - claim created
          </span>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #EAECF0",
            borderRadius: 12,
            background: "#FFFFFF",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12 }}>
            <label style={{ color: "#344054", fontWeight: 600, paddingTop: 8 }}>
              Created by
            </label>
            <input
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              placeholder="Your name"
              style={{
                padding: "10px 12px",
                border: "1px solid #D0D5DD",
                borderRadius: 10,
                outline: "none",
                background: "#FCFCFD",
              }}
            />

            <label style={{ color: "#344054", fontWeight: 600, paddingTop: 8 }}>
              First notification
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Paste here (email/WhatsApp/SMS). Messy text is OK."}
              rows={14}
              style={{
                width: "100%",
                padding: 12,
                border: "1px solid #D0D5DD",
                borderRadius: 10,
                outline: "none",
                background: "#FCFCFD",
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
                lineHeight: 1.35,
              }}
            />
          </div>

          {err ? (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: "#FEF3F2",
                border: "1px solid #FDA29B",
                color: "#B42318",
                fontWeight: 600,
              }}
            >
              {err}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <button
              onClick={() => router.push("/")}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #D0D5DD",
                background: "#FFFFFF",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Back
            </button>

            <button
              disabled={!canSubmit}
              onClick={onSubmit}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #175CD3",
                background: canSubmit ? "#1570EF" : "#B2DDFF",
                color: "#FFFFFF",
                cursor: canSubmit ? "pointer" : "not-allowed",
                fontWeight: 700,
                minWidth: 160,
              }}
            >
              {busy ? "Creating..." : "Create Claim"}
            </button>

            <div style={{ marginLeft: "auto", color: "#667085", fontSize: 13, paddingTop: 10 }}>
              Tip: include vessel name, IMO, date/time, location, incident description.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
