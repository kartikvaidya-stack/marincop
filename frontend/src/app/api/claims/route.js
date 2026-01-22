export const dynamic = "force-dynamic";

function backendBase() {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
}

// List claims
export async function GET() {
  const base = backendBase();
  const r = await fetch(`${base}/api/claims`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  return Response.json(j, { status: r.status });
}

// Create claim
export async function POST(req) {
  const base = backendBase();
  const body = await req.json().catch(() => ({}));

  const r = await fetch(`${base}/api/claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const j = await r.json().catch(() => ({}));
  return Response.json(j, { status: r.status });
}
