export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const notImplemented = (what: string) =>
  json({ error: "not_implemented", what }, 501);
