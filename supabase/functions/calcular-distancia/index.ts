import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  // 🔁 Manejar OPTIONS para preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }

  try {
    const { origen, destinos } = await req.json();

    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", origen);
    url.searchParams.set("destinations", destinos);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("units", "metric");

    // 👇 Aquí está el fix
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
    url.searchParams.set("key", apiKey);

    console.log("🌐 URL final:", url.toString());

    const response = await fetch(url.toString());
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      status: 500,
    });
  }
});