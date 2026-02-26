import { serve } from "https://deno.land/std/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const jsonHeaders = {
  "Content-Type": "application/json",
  ...corsHeaders,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        ...corsHeaders,
      },
    });
  }

  try {
    const body = await req.json();
    const { telefono, nombreUsuario, nombreComercio, fecha, hora } = body;
    if (!telefono || !nombreUsuario || !nombreComercio || !fecha || !hora) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: jsonHeaders });
    }
    console.log("[send-sms-cupon] Payload recibido:", body);

    const apiKey = Deno.env.get("TELNYX_API_KEY");
    const fromNumber = Deno.env.get("TELNYX_NUMBER");

    if (!apiKey || !fromNumber) {
      return new Response(JSON.stringify({ error: "Missing Telnyx env vars" }), { status: 500, headers: jsonHeaders });
    }

    const text = `Saludos ${nombreUsuario}! Acabas de redimir tu cUPón en ${nombreComercio} hoy ${fecha} a las ${hora}. Gracias por ser parte del Corillo UP aquí EnPeErre.`;

    const resp = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromNumber,
        to: telefono,
        text,
      }),
    });

    const responseText = await resp.text();
    let responseBody: unknown = responseText;
    try {
      responseBody = JSON.parse(responseText);
    } catch (_err) {
      // Mantener texto sin parsear
    }
    console.log("[send-sms-cupon] Telnyx status:", resp.status);
    console.log("[send-sms-cupon] Telnyx response:", responseBody);

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "Telnyx request failed", status: resp.status, body: responseBody }), {
        status: resp.status,
        headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify(responseBody), { status: 200, headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: jsonHeaders });
  }
});
