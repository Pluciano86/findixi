const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

Deno.serve(() =>
  new Response(
    JSON.stringify({
      ok: false,
      code: "coupons_disabled",
      error: "La mensajería de cupones está deshabilitada.",
    }),
    { status: 410, headers },
  )
);
