export const dynamic = "force-dynamic";

function getId(ctx) {
  const p = ctx?.params;
  // Next 16 can behave weirdly; unwrap safely
  if (!p) return null;
  if (typeof p.then === "function") return null; // handled below in async
  return p.id || null;
}

async function getIdAsync(ctx) {
  const p = ctx?.params;
  if (!p) return null;
  if (typeof p.then === "function") {
    const resolved = await p;
    return resolved?.id || null;
  }
  return p.id || null;
}

export async function PATCH(req, ctx) {
  const id = (await getIdAsync(ctx)) || getId(ctx);
  if (!id) return Response.json({ ok: false, error: "BadRequest", message: "Missing claim id." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  const r = await fetch(`${base}/api/claims/${id}/finance`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const j = await r.json().catch(() => ({}));
  return Response.json(j, { status: r.status });
}
