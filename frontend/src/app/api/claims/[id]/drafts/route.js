export const dynamic = "force-dynamic";

async function getIdAsync(ctx) {
  const p = ctx?.params;
  if (!p) return null;
  if (typeof p.then === "function") {
    const resolved = await p;
    return resolved?.id || null;
  }
  return p.id || null;
}

export async function GET(_req, ctx) {
  const id = await getIdAsync(ctx);
  if (!id) {
    return Response.json(
      { ok: false, error: "BadRequest", message: "Missing claim id." },
      { status: 400 }
    );
  }

  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  const r = await fetch(`${base}/api/claims/${id}/drafts`, {
    cache: "no-store",
  });

  const j = await r.json().catch(() => ({}));
  return Response.json(j, { status: r.status });
}
