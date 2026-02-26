import axios from "axios";
import fs from "fs";
import { createObjectCsvWriter } from "csv-writer";
import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.GOOGLE_API_KEY;

// === CONFIGURACIÓN ===
const municipios = ["Adjuntas", "Aguada", "Aguadilla", "Aguas Buenas", "Aibonito", "Añasco", "Arecibo", "Arroyo"];
const categorias = ["Restaurantes", "Coffee Shops", "Panaderías", "Pubs", "Food Trucks", "Postres", "Playgrounds", "Discotecas", "Barras"];
const excluirFastFood = ["McDonald", "Burger King", "Subway", "Wendy", "KFC", "Popeyes", "Church", "Domino", "Pizza Hut", "Taco Bell"];

const csvWriter = createObjectCsvWriter({
  path: "comercios.csv",
  header: [
    { id: "nombre", title: "nombre" },
    { id: "telefono", title: "telefono" },
    { id: "direccion", title: "direccion" },
    { id: "latitud", title: "latitud" },
    { id: "longitud", title: "longitud" },
    { id: "municipio", title: "municipio" },
    { id: "categoria", title: "categoria" },
  ],
});

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscarComercios() {
  const resultados = [];

  for (const municipio of municipios) {
    for (const categoria of categorias) {
      console.log(`🔎 Buscando ${categoria} en ${municipio}...`);
      const query = `${categoria} en ${municipio} Puerto Rico -fast food`;

      let nextPageToken = null;
      let count = 0;

      do {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          query
        )}&key=${API_KEY}${nextPageToken ? `&pagetoken=${nextPageToken}` : ""}`;

        try {
          const { data } = await axios.get(url);
          if (!data.results) break;

          for (const lugar of data.results) {
            if (
              lugar.business_status !== "OPERATIONAL" ||
              excluirFastFood.some((f) => lugar.name.toLowerCase().includes(f.toLowerCase()))
            )
              continue;

            resultados.push({
              nombre: lugar.name,
              telefono: "", // opcional: agregar luego con Place Details
              direccion: lugar.formatted_address || "",
              latitud: lugar.geometry?.location?.lat || "",
              longitud: lugar.geometry?.location?.lng || "",
              municipio,
              categoria,
            });

            count++;
            if (count >= 200) break;
          }

          nextPageToken = data.next_page_token;
          if (nextPageToken) {
            console.log("⏳ Esperando para la siguiente página...");
            await delay(2500);
          }
        } catch (err) {
          console.error("❌ Error en solicitud:", err.message);
          break;
        }
      } while (nextPageToken && count < 200);

      console.log(`✅ ${count} ${categoria.toLowerCase()} encontrados en ${municipio}.`);
    }
  }

  await csvWriter.writeRecords(resultados);
  console.log(`\n📁 Archivo generado con ${resultados.length} comercios totales.`);
}

buscarComercios();