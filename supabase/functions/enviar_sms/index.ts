const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

Deno.serve(() =>
  new Response(
    JSON.stringify({
      ok: false,
      code: "endpoint_retired",
      error: "Este endpoint de mensajería fue retirado.",
    }),
    { status: 410, headers },
  )
);
