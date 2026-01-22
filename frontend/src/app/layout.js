import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Marincop — Nova Carriers",
  description: "Marine Insurance Co-Pilot (Internal)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#F7F9FC", color: "#101828" }}>
        <TopBar />
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>{children}</div>
      </body>
    </html>
  );
}

function TopBar() {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(247, 249, 252, 0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid #EAECF0",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 950, letterSpacing: 0.2 }}>Marincop</div>
            <div style={{ color: "#667085", fontSize: 12 }}>Nova Carriers</div>
          </div>

          <div style={{ display: "flex", gap: 10, marginLeft: 18, flexWrap: "wrap" }}>
            <NavLink href="/">Claims</NavLink>
            <NavLink href="/new-claim">New Claim</NavLink>
            <NavLink href="/finance">Finance</NavLink>
            <NavLink href="/reminders">Reminders</NavLink>
            <NavLink href="/insights">Insights</NavLink>
            <span style={pillMuted}>Settings (next)</span>
          </div>

          <div style={{ marginLeft: "auto", color: "#667085", fontSize: 12 }}>
            Light UI • Internal tool
          </div>
        </div>
      </div>
    </div>
  );
}

function NavLink({ href, children }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "#101828",
        fontWeight: 800,
        fontSize: 13,
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid #D0D5DD",
        background: "#FFFFFF",
      }}
    >
      {children}
    </Link>
  );
}

const pillMuted = {
  color: "#667085",
  fontWeight: 800,
  fontSize: 13,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px dashed #D0D5DD",
  background: "#FFFFFF",
};
