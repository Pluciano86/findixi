// adminHorarioComercio.js
import { supabase, idComercio as idComercioImportado } from '../shared/supabaseClient.js';

const idComercio =
  idComercioImportado ||
  new URLSearchParams(window.location.search).get('idcomercio') ||
  new URLSearchParams(window.location.search).get('id');

// Reordenado para que i = 0 sea Lunes y i = 6 sea Domingo
const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export async function cargarHorariosComercio() {
  const container = document.getElementById("horariosContainer");
  if (!container) return;

  const { data: horarios, error } = await supabase
    .from("Horarios") // ✅ corregido
    .select("*")
    .eq("idComercio", idComercio);

  if (error) {
    console.error("Error cargando horarios:", error);
    container.innerHTML = "<p>Error al cargar horarios</p>";
    return;
  }

  container.innerHTML = "";

  for (let i = 0; i < 7; i++) {
    const diaReal = (i + 1) % 7; // Lunes=1 ... Domingo=0
    const horarioDia = horarios.find(h => h.diaSemana === diaReal) || {
      apertura: "09:00",
      cierre: "17:00",
      cerrado: false
    };

    const div = document.createElement("div");
    div.className = "flex items-center gap-4 bg-white rounded p-3 shadow";
    div.dataset.diaReal = diaReal;

    div.innerHTML = `
      <label class="w-24 font-semibold">${diasSemana[i]}</label>
      <input type="time" id="apertura-${i}" class="border rounded p-1 apertura" value="${horarioDia.apertura || "09:00"}">
      <input type="time" id="cierre-${i}" class="border rounded p-1 cierre" value="${horarioDia.cierre || "17:00"}">
      <label class="ml-4 flex items-center gap-2">
        <input type="checkbox" id="cerrado-${i}" class="cerrado" ${horarioDia.cerrado ? "checked" : ""}> Cerrado
      </label>
    `;

    container.appendChild(div);
  }
}

export async function guardarHorariosComercio() {
  for (let i = 0; i < 7; i++) {
    const apertura = document.getElementById(`apertura-${i}`).value;
    const cierre = document.getElementById(`cierre-${i}`).value;
    const cerrado = document.getElementById(`cerrado-${i}`).checked;
    const diaReal = (i + 1) % 7; // Alineado con getDay()

    const { data: existente } = await supabase
      .from("Horarios") // ✅ corregido
      .select("id")
      .eq("idComercio", idComercio)
      .eq("diaSemana", diaReal)
      .maybeSingle();

    if (existente) {
      await supabase.from("Horarios").update({ apertura, cierre, cerrado }).eq("id", existente.id);
    } else {
      await supabase.from("Horarios").insert({ idComercio, diaSemana: diaReal, apertura, cierre, cerrado });
    }
  }

  console.log("Horarios guardados ✅");
}
