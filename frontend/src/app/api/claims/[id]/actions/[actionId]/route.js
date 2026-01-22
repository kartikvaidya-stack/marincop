export const dynamic = "force-dynamic";

async function getParamsAsync(ctx) {
  const p = ctx?.params;
  if (!p) return {};
  if (typeof p.then === "function") return (await p) || {};
  return p;
}

export async function PATCH(req, ctx) {
  const params = await getParamsAsync(ctx);
  const id = params?.id;
  const actionId = params?.actionId;

  if (!id) return Response.json({ ok: false, error: "BadRequest", message: "Missing claim id." }, { status: 400 });
  if (!actionId) return Response.json({ ok: false, error: "BadRequest", message: "Missing action id." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  const r = await fetch(`${base}/api/claims/${id}/actions/${actionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const j = await r.json().catch(() => ({}));
  return Response.json(j, { status: r.status });
}
