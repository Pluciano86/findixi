import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

type EventoFecha = {
  idevento: number | null;
  fecha: string | null;
};

type ResultadoLimpieza = {
  totalEventosRevisados: number;
  eventosExpirados: number;
  eliminados: number;
  fechaReferenciaPR: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no definidas");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const TIMEZONE = "America/Puerto_Rico";

function fechaHoyPuertoRico(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function dividirEnChunks<T>(items: T[], size = 100): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function eliminarRegistros(tabla: "eventoFechas" | "eventos", ids: number[]): Promise<void> {
  if (!ids.length) return;
  for (const lote of dividirEnChunks(ids)) {
    const { error } = await supabase
      .from(tabla)
      .delete()
      .in(tabla === "eventoFechas" ? "idevento" : "id", lote);

    if (error) {
      throw new Error(`Error al eliminar en ${tabla}: ${error.message}`);
    }
  }
}

async function limpiarEventosExpirados(): Promise<ResultadoLimpieza> {
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase no está configurado para esta función");
  }

  const hoyPR = fechaHoyPuertoRico();
  console.log(`🚀 Iniciando limpieza de eventos expirados usando fecha PR: ${hoyPR}`);

  const { data, error } = await supabase
    .from("eventoFechas")
    .select("idevento, fecha");

  if (error) {
    throw new Error(`No se pudieron obtener las fechas de eventos: ${error.message}`);
  }

  const ultimaFechaPorEvento = new Map<number, string>();

  (data as EventoFecha[] | null)?.forEach((registro) => {
    if (!registro.idevento || !registro.fecha) return;
    const actual = ultimaFechaPorEvento.get(registro.idevento);
    if (!actual || registro.fecha > actual) {
      ultimaFechaPorEvento.set(registro.idevento, registro.fecha);
    }
  });

  const eventosExpirados = Array.from(ultimaFechaPorEvento.entries())
    .filter(([, fechaFinal]) => fechaFinal < hoyPR)
    .map(([id]) => id);

  if (!eventosExpirados.length) {
    console.log("✨ No se encontraron eventos expirados para eliminar.");
    return {
      totalEventosRevisados: ultimaFechaPorEvento.size,
      eventosExpirados: 0,
      eliminados: 0,
      fechaReferenciaPR: hoyPR,
    };
  }

  console.log(`🧹 Eliminando ${eventosExpirados.length} eventos expirados...`);
  await eliminarRegistros("eventoFechas", eventosExpirados);
  await eliminarRegistros("eventos", eventosExpirados);

  return {
    totalEventosRevisados: ultimaFechaPorEvento.size,
    eventosExpirados: eventosExpirados.length,
    eliminados: eventosExpirados.length,
    fechaReferenciaPR: hoyPR,
  };
}

serve(async (_req: Request): Promise<Response> => {
  try {
    const resultado = await limpiarEventosExpirados();
    return new Response(JSON.stringify({ ok: true, resultado }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("💥 Error en limpiar_eventos_expirados:", error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
