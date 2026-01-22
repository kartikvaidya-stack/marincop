// frontend/src/app/layout.js

export const metadata = {
  title: "Marincop | Nova Carriers",
  description: "Marine Insurance Co-Pilot for Nova Carriers",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={styles.body}>
        <div style={styles.shell}>
          <aside style={styles.sidebar}>
            <div style={styles.brandBlock}>
              <div style={styles.brandTitle}>Marincop</div>
              <div style={styles.brandSub}>Nova Carriers</div>
            </div>

            <nav style={styles.nav}>
              <a style={styles.navItem} href="/">
                Claims
              </a>
              <a style={styles.navItemMuted} href="#">
                Reminders (next)
              </a>
              <a style={styles.navItemMuted} href="#">
                Insights (next)
              </a>
              <a style={styles.navItemMuted} href="#">
                Settings (next)
              </a>
            </nav>

            <div style={styles.sidebarFooter}>
              <div style={styles.footerNote}>
                Light UI • Internal tool
              </div>
            </div>
          </aside>

          <main style={styles.main}>
            <header style={styles.topbar}>
              <div>
                <div style={styles.topTitle}>Claims Dashboard</div>
                <div style={styles.topSubtitle}>
                  Marine insurance case management • AI-assisted drafting
                </div>
              </div>
              <div style={styles.pill}>Environment: Local</div>
            </header>

            <section style={styles.content}>{children}</section>
          </main>
        </div>
      </body>
    </html>
  );
}

const styles = {
  body: {
    margin: 0,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    background: "#F7F9FC",
    color: "#0B1220",
  },
  shell: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    minHeight: "100vh",
  },
  sidebar: {
    background: "#FFFFFF",
    borderRight: "1px solid #E6EAF2",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  brandBlock: {
    padding: 14,
    border: "1px solid #E6EAF2",
    borderRadius: 14,
    background: "#FBFCFE",
  },
  brandTitle: { fontSize: 20, fontWeight: 750, letterSpacing: 0.2 },
  brandSub: { marginTop: 4, fontSize: 12, color: "#51607A" },
  nav: { display: "flex", flexDirection: "column", gap: 10 },
  navItem: {
    padding: "10px 12px",
    borderRadius: 12,
    textDecoration: "none",
    color: "#0B1220",
    background: "#EEF4FF",
    border: "1px solid #D9E6FF",
    fontWeight: 650,
  },
  navItemMuted: {
    padding: "10px 12px",
    borderRadius: 12,
    textDecoration: "none",
    color: "#7A879D",
    background: "#FFFFFF",
    border: "1px solid #EEF1F6",
  },
  sidebarFooter: { marginTop: "auto" },
  footerNote: { fontSize: 12, color: "#7A879D" },
  main: { padding: 22 },
  topbar: {
    background: "#FFFFFF",
    border: "1px solid #E6EAF2",
    borderRadius: 18,
    padding: "16px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 1px 0 rgba(10,20,40,0.03)",
  },
  topTitle: { fontSize: 18, fontWeight: 750 },
  topSubtitle: { marginTop: 4, fontSize: 12, color: "#51607A" },
  pill: {
    fontSize: 12,
    color: "#1F3B77",
    background: "#EAF1FF",
    border: "1px solid #D9E6FF",
    padding: "8px 10px",
    borderRadius: 999,
    fontWeight: 650,
  },
  content: { marginTop: 16 },
};
