const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

Deno.serve(() =>
  new Response(
    JSON.stringify({
      ok: false,
      code: "endpoint_retired",
      error: "Esta limpieza antigua fue retirada; los eventos se administran por el workflow vigente.",
    }),
    { status: 410, headers },
  )
);
