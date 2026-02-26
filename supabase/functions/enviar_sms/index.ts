import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const baseHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido. Usa POST." }),
      {
        status: 405,
        headers: {
          ...baseHeaders,
          "Allow": "POST",
        },
      },
    );
  }

  let payload: { telefono?: string; mensaje?: string } = {};
  try {
    payload = await req.json();
  } catch (_err) {
    return new Response(
      JSON.stringify({ error: "Cuerpo inválido. Debe ser JSON." }),
      { status: 400, headers: baseHeaders },
    );
  }

  const telefono = payload.telefono?.trim();
  const mensaje = payload.mensaje?.trim();

  if (!telefono || !mensaje) {
    return new Response(
      JSON.stringify({
        error: "Parámetros incompletos. Se requieren 'telefono' y 'mensaje'.",
      }),
      { status: 400, headers: baseHeaders },
    );
  }

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "";

  console.log("DEBUG Twilio vars:", {
  accountSid,
  authToken,
  fromNumber,
});

  if (!accountSid || !authToken || !fromNumber) {
    return new Response(
      JSON.stringify({
        error:
          "Configuración de Twilio incompleta. Verifica las variables de entorno.",
      }),
      { status: 500, headers: baseHeaders },
    );
  }

  const twilioUrl =
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const formBody = new URLSearchParams({
    From: fromNumber,
    To: telefono,
    Body: mensaje,
  });

  const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

  try {
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    });

    const responseBody = await twilioResponse.json().catch(() => ({}));

    if (!twilioResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Twilio rechazó la solicitud.",
          detalle: responseBody,
        }),
        {
          status: twilioResponse.status,
          headers: baseHeaders,
        },
      );
    }

    return new Response(
      JSON.stringify({
        exito: true,
        destino: telefono,
        twilioSid: responseBody?.sid ?? null,
      }),
      { status: 200, headers: baseHeaders },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "No se pudo contactar el servicio de Twilio.",
        detalle: err.message,
      }),
      { status: 500, headers: baseHeaders },
    );
  }
});
