// public/js/detectarMunicipio.js
import { supabase } from "../shared/supabaseClient.js";

/**
 * Detecta el municipio del usuario, primero usando el ZIP code si está disponible.
 * Si no hay ZIP o no se encuentra, usa las coordenadas como respaldo.
 */
export async function detectarMunicipioUsuario({ lat, lon, zip = null }) {
  try {
    // Si tenemos ZIP, intentar buscarlo directamente en la tabla CódigosPostales
    if (zip) {
      const { data: codigoData, error: errorZip } = await supabase
        .from("CodigosPostales")
        .select("Municipio")
        .eq("Codigo", zip)
        .single();

      if (!errorZip && codigoData?.Municipio) {
        console.log("📍 Municipio detectado por ZIP:", codigoData.Municipio);
        return codigoData.Municipio;
      }
    }

    // Si no hay ZIP o falló la búsqueda, usar coordenadas como respaldo
    if (lat && lon) {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
      );
      if (!response.ok) throw new Error("Error al consultar Nominatim");

      const data = await response.json();
      const municipio =
        data.address.town ||
        data.address.city ||
        data.address.village ||
        data.address.county ||
        null;

      console.log("📍 Municipio detectado por coordenadas:", municipio);
      return municipio;
    }

    console.warn("⚠️ No se pudo detectar municipio (sin ZIP ni coordenadas)");
    return null;
  } catch (err) {
    console.error("❌ Error al detectar municipio:", err.message);
    return null;
  }
}