import axios from "axios";
import fs from "fs";
import { createObjectCsvWriter } from "csv-writer";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error("ERROR: Missing GOOGLE_API_KEY");
  process.exit(1);
}

const SEARCH_CATEGORIES = [
  "Salones de Belleza",
  "Barberias",
  "Spas",
  "Esteticas",
  "Dispensarios",
  "Gimnasios",
  "Boutiques",
];

const MAX_RESULTS_PER_CATEGORY = 200;
const SEARCH_DELAY_MS = 2500;
const DETAILS_DELAY_MS = 120;
const DETAILS_CONCURRENCY = 4;

const DETAILS_CACHE_FILE = "cache_places_details_pr.json";
const OUTPUT_MAIN = "comercios_belleza_salud_pr.csv";
const OUTPUT_SUBCATS = "comercios_subcategorias_sugeridas.csv";
const OUTPUT_SUBCAT_CATALOG = "subcategorias_catalogo_sugerido.csv";
const OUTPUT_FILTERED = "comercios_descartados_filtro_actividad.csv";

const MAIN_CATEGORY_PRIORITY = new Map(
  SEARCH_CATEGORIES.map((category, index) => [category, index])
);

const TYPE_TO_SUBCATEGORY = new Map([
  ["beauty_salon", "Salon de Belleza"],
  ["hair_care", "Cuidado Capilar"],
  ["barber_shop", "Barberia"],
  ["spa", "Spa"],
  ["massage_therapist", "Masajes"],
  ["nail_salon", "Unas"],
  ["skin_care_clinic", "Cuidado de Piel"],
  ["gym", "Gimnasio General"],
  ["health", "Bienestar"],
  ["clothing_store", "Ropa"],
  ["shoe_store", "Calzado"],
  ["jewelry_store", "Accesorios"],
  ["store", "Tienda"],
]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function extractMunicipioFromAddressComponents(addressComponents = []) {
  if (!Array.isArray(addressComponents)) return "";

  const byPriority = [
    "locality",
    "administrative_area_level_3",
    "administrative_area_level_2",
    "sublocality",
    "postal_town",
  ];

  for (const targetType of byPriority) {
    const match = addressComponents.find((component) =>
      Array.isArray(component?.types) && component.types.includes(targetType)
    );
    if (match?.long_name) return match.long_name.trim();
  }

  return "";
}

function extractMunicipioFromAddressLine(address = "") {
  const parts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return "";

  const withoutCountry = parts.filter(
    (part) => !/(puerto rico|pr)$/i.test(part)
  );

  const withoutPostalCode = withoutCountry.filter(
    (part) => !/^\d{5}(?:-\d{4})?$/.test(part)
  );

  return withoutPostalCode.length >= 2
    ? withoutPostalCode[withoutPostalCode.length - 1]
    : "";
}

function buildCategoryQueries(category) {
  return [
    `${category} en Puerto Rico`,
    `${category} Puerto Rico`,
  ];
}

function loadDetailsCache() {
  if (!fs.existsSync(DETAILS_CACHE_FILE)) return {};
  try {
    const raw = fs.readFileSync(DETAILS_CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch (_) {
    // ignore and start with empty cache
  }
  return {};
}

function saveDetailsCache(cache) {
  fs.writeFileSync(DETAILS_CACHE_FILE, JSON.stringify(cache), "utf8");
}

function hasType(typeList, value) {
  return Array.isArray(typeList) && typeList.includes(value);
}

function inferMainCategory({ name, types = [], matchedCategories = [] }) {
  const n = normalizeText(name);

  if (hasType(types, "gym") || /(gym|fitness|crossfit|box)/.test(n)) return "Gimnasios";
  if (hasType(types, "barber_shop") || /(barber|barberia|barberia)/.test(n)) return "Barberias";
  if (hasType(types, "spa") || /\bspa\b/.test(n)) return "Spas";
  if (hasType(types, "pharmacy") && /(dispensary|cannabis|cbd|thc|medicinal)/.test(n)) return "Dispensarios";
  if (/(dispensary|cannabis|cbd|thc|medicinal)/.test(n)) return "Dispensarios";
  if (hasType(types, "skin_care_clinic") || /(estetica|esteticas|esthetic|esthetics|facial|skin)/.test(n)) return "Esteticas";
  if (
    hasType(types, "beauty_salon") ||
    hasType(types, "hair_care") ||
    hasType(types, "nail_salon") ||
    /(salon|salones|belleza|beauty|nails|lashes|cejas)/.test(n)
  ) {
    return "Salones de Belleza";
  }
  if (
    /(boutique|moda|fashion)/.test(n) ||
    hasType(types, "clothing_store") ||
    hasType(types, "shoe_store") ||
    hasType(types, "jewelry_store")
  ) {
    return "Boutiques";
  }

  if (matchedCategories.length > 0) {
    return [...matchedCategories].sort((a, b) => {
      const pa = MAIN_CATEGORY_PRIORITY.get(a);
      const pb = MAIN_CATEGORY_PRIORITY.get(b);
      return (Number.isFinite(pa) ? pa : 999) - (Number.isFinite(pb) ? pb : 999);
    })[0];
  }

  return "";
}

function hasCannabisKeyword(value) {
  const n = normalizeText(value);
  return /(dispensary|cannabis|cbd|thc|medicinal|marihuana|marijuana|weed)/.test(n);
}

function inferKeywordSubcategories(category, name) {
  const n = normalizeText(name);
  const result = new Set();

  if (category === "Salones de Belleza") {
    if (/(nail|unas|uñas|manicure|pedicure)/.test(n)) result.add("Unas");
    if (/(lash|pestana|pestaña|ceja|brow)/.test(n)) result.add("Lashes y Cejas");
    if (/(hair|capilar|color|salon|salones|beauty)/.test(n)) result.add("Cabello");
    if (/(makeup|maquillaje)/.test(n)) result.add("Maquillaje");
  } else if (category === "Barberias") {
    if (/(fade|barber|barberia|barbershop)/.test(n)) result.add("Cortes");
    if (/(beard|barba)/.test(n)) result.add("Barba");
  } else if (category === "Spas") {
    if (/(massage|masaje)/.test(n)) result.add("Masajes");
    if (/(facial|skin)/.test(n)) result.add("Faciales");
    if (/(wellness|relax)/.test(n)) result.add("Wellness");
  } else if (category === "Esteticas") {
    if (/(facial|skin|estetica|esthetic)/.test(n)) result.add("Faciales");
    if (/(laser|depil)/.test(n)) result.add("Depilacion");
    if (/(body|corporal)/.test(n)) result.add("Tratamientos Corporales");
  } else if (category === "Dispensarios") {
    if (/(cannabis|dispensary|thc|cbd|medicinal)/.test(n)) result.add("Cannabis Medicinal");
    if (/(delivery)/.test(n)) result.add("Delivery");
  } else if (category === "Gimnasios") {
    if (/(crossfit)/.test(n)) result.add("Crossfit");
    if (/(box|boxing)/.test(n)) result.add("Boxeo");
    if (/(yoga)/.test(n)) result.add("Yoga");
    if (/(pilates)/.test(n)) result.add("Pilates");
    if (/(fitness|gym)/.test(n)) result.add("Fitness");
  } else if (category === "Boutiques") {
    if (/(kids|nino|niña|infantil)/.test(n)) result.add("Ropa Infantil");
    if (/(shoe|zapato|calzado)/.test(n)) result.add("Calzado");
    if (/(jewel|joyeria|accesorios|accessories)/.test(n)) result.add("Accesorios");
    if (/(moda|fashion|boutique|ropa)/.test(n)) result.add("Moda");
  }

  return result;
}

function inferSubcategories({ category, types = [], name = "" }) {
  const result = new Set();

  for (const type of types) {
    const mapped = TYPE_TO_SUBCATEGORY.get(type);
    if (mapped) result.add(mapped);
  }

  for (const keywordSubcat of inferKeywordSubcategories(category, name)) {
    result.add(keywordSubcat);
  }

  if (result.size === 0) result.add("General");
  return result;
}

async function searchPlacesForCategory(category) {
  const collected = [];
  const queries = buildCategoryQueries(category);

  for (const query of queries) {
    let nextPageToken = null;
    let localCount = 0;

    do {
      const url = "https://maps.googleapis.com/maps/api/place/textsearch/json";
      const params = {
        query,
        key: API_KEY,
      };
      if (nextPageToken) params.pagetoken = nextPageToken;

      try {
        const { data } = await axios.get(url, { params, timeout: 20000 });

        if (data.status === "ZERO_RESULTS") break;
        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
          console.warn(
            `[search:${category}] status=${data.status} query="${query}" next=${Boolean(nextPageToken)}`
          );
          break;
        }

        for (const place of data.results || []) {
          if (!place?.place_id) continue;
          collected.push({
            place_id: place.place_id,
            name: place.name || "",
            formatted_address: place.formatted_address || "",
            lat: place.geometry?.location?.lat ?? "",
            lng: place.geometry?.location?.lng ?? "",
            business_status: place.business_status || "",
            permanently_closed: place.permanently_closed === true,
            types: Array.isArray(place.types) ? place.types : [],
            matched_category: category,
            query,
          });
          localCount++;
          if (localCount >= MAX_RESULTS_PER_CATEGORY) break;
        }

        nextPageToken = data.next_page_token || null;
        if (nextPageToken && localCount < MAX_RESULTS_PER_CATEGORY) {
          await delay(SEARCH_DELAY_MS);
        }
      } catch (error) {
        console.warn(`[search:${category}] request error: ${error.message}`);
        break;
      }
    } while (nextPageToken && localCount < MAX_RESULTS_PER_CATEGORY);
  }

  return collected;
}

async function fetchPlaceDetails(placeId) {
  const url = "https://maps.googleapis.com/maps/api/place/details/json";
  const params = {
    place_id: placeId,
    fields:
      "place_id,name,formatted_address,address_components,geometry,business_status,formatted_phone_number,types",
    key: API_KEY,
  };

  const { data } = await axios.get(url, { params, timeout: 20000 });
  if (data.status !== "OK" || !data.result) {
    throw new Error(`details status=${data.status}`);
  }
  return data.result;
}

async function runWithConcurrency(items, worker, concurrency = 4) {
  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  }

  const runners = [];
  for (let i = 0; i < Math.max(1, concurrency); i++) runners.push(runner());
  await Promise.all(runners);
}

async function main() {
  console.log("Starting discovery phase...");

  const placeMap = new Map();

  for (const category of SEARCH_CATEGORIES) {
    console.log(`Searching category: ${category}`);
    const found = await searchPlacesForCategory(category);
    console.log(`  raw candidates: ${found.length}`);

    for (const place of found) {
      const existing = placeMap.get(place.place_id);
      if (!existing) {
        placeMap.set(place.place_id, {
          place_id: place.place_id,
          name: place.name,
          formatted_address: place.formatted_address,
          lat: place.lat,
          lng: place.lng,
          business_status: place.business_status,
          permanently_closed: place.permanently_closed,
          types: Array.isArray(place.types) ? [...place.types] : [],
          matched_categories: new Set([place.matched_category]),
          source_queries: new Set([place.query]),
        });
        continue;
      }
      existing.matched_categories.add(place.matched_category);
      existing.source_queries.add(place.query);
      const mergedTypes = new Set([...(existing.types || []), ...(place.types || [])]);
      existing.types = [...mergedTypes];
      if (!existing.name && place.name) existing.name = place.name;
      if (!existing.formatted_address && place.formatted_address) {
        existing.formatted_address = place.formatted_address;
      }
      if (!existing.lat && place.lat !== "") existing.lat = place.lat;
      if (!existing.lng && place.lng !== "") existing.lng = place.lng;
      if (!existing.business_status && place.business_status) {
        existing.business_status = place.business_status;
      }
      if (!existing.permanently_closed && place.permanently_closed) {
        existing.permanently_closed = true;
      }
    }
  }

  const uniquePlaces = [...placeMap.values()];
  console.log(`Unique place_id count: ${uniquePlaces.length}`);

  console.log("Starting details phase...");
  const detailsCache = loadDetailsCache();
  let cacheWrites = 0;

  const acceptedRows = [];
  const subcatRows = [];
  const filteredRows = [];

  await runWithConcurrency(
    uniquePlaces,
    async (place, index) => {
      const progress = `[${index + 1}/${uniquePlaces.length}]`;
      let details = null;

      try {
        const cached = detailsCache[place.place_id];
        const cacheHasAddressComponents = Array.isArray(cached?.address_components);
        if (cached && cacheHasAddressComponents) {
          details = cached;
        } else {
          details = await fetchPlaceDetails(place.place_id);
          detailsCache[place.place_id] = details;
          cacheWrites++;
          if (cacheWrites % 50 === 0) saveDetailsCache(detailsCache);
          await delay(DETAILS_DELAY_MS);
        }
      } catch (error) {
        filteredRows.push({
          place_id: place.place_id,
          nombre: place.name || "",
          municipio: "",
          motivo: `details_error:${error.message}`,
          business_status: "",
        });
        console.log(`${progress} filtered details error`);
        return;
      }

      const name = details.name || place.name || "";
      const address = details.formatted_address || place.formatted_address || "";
      const lat = details.geometry?.location?.lat ?? place.lat ?? "";
      const lng = details.geometry?.location?.lng ?? place.lng ?? "";
      const businessStatus = details.business_status || place.business_status || "";
      const types = Array.isArray(details.types) ? details.types : place.types || [];
      const municipio =
        extractMunicipioFromAddressComponents(details.address_components) ||
        extractMunicipioFromAddressLine(address);
      const phone = details.formatted_phone_number || "";
      const permanentlyClosed = details.permanently_closed === true || place.permanently_closed === true;

      if (permanentlyClosed || businessStatus !== "OPERATIONAL") {
        filteredRows.push({
          place_id: place.place_id,
          nombre: name,
          municipio,
          motivo: permanentlyClosed ? "permanently_closed" : "not_operational",
          business_status: businessStatus || "",
        });
        console.log(`${progress} filtered closed/not operational`);
        return;
      }

      if (!phone) {
        filteredRows.push({
          place_id: place.place_id,
          nombre: name,
          municipio,
          motivo: "missing_phone",
          business_status: businessStatus,
        });
        console.log(`${progress} filtered missing phone`);
        return;
      }

      const matchedCategories = [...place.matched_categories];
      const mainCategory = inferMainCategory({
        name,
        types,
        matchedCategories,
      });
      const effectiveCategory = mainCategory || matchedCategories[0] || "";

      if (effectiveCategory === "Dispensarios") {
        const genericPharmacy =
          hasType(types, "pharmacy") &&
          !hasCannabisKeyword(name) &&
          !hasCannabisKeyword(address);

        if (genericPharmacy) {
          filteredRows.push({
            place_id: place.place_id,
            nombre: name,
            municipio,
            motivo: "pharmacy_not_dispensary",
            business_status: businessStatus,
          });
          console.log(`${progress} filtered pharmacy not dispensary`);
          return;
        }
      }

      const subcategories = inferSubcategories({
        category: effectiveCategory,
        types,
        name,
      });

      acceptedRows.push({
        place_id: place.place_id,
        nombre: name,
        telefono: phone,
        direccion: address,
        municipio,
        latitud: lat,
        longitud: lng,
        categoria_principal: effectiveCategory,
        categorias_detectadas_busqueda: matchedCategories.join("|"),
        subcategorias_sugeridas: [...subcategories].join("|"),
        business_status: businessStatus,
        google_types: types.join("|"),
      });

      for (const subcat of subcategories) {
        subcatRows.push({
          place_id: place.place_id,
          nombre: name,
          categoria_principal: effectiveCategory,
          subcategoria_sugerida: subcat,
        });
      }

      console.log(`${progress} accepted`);
    },
    DETAILS_CONCURRENCY
  );

  saveDetailsCache(detailsCache);

  const uniqueSubcatRowsMap = new Map();
  for (const row of subcatRows) {
    const key = `${row.place_id}|${row.subcategoria_sugerida}`;
    if (!uniqueSubcatRowsMap.has(key)) uniqueSubcatRowsMap.set(key, row);
  }
  const uniqueSubcatRows = [...uniqueSubcatRowsMap.values()];

  const catalogMap = new Map();
  for (const row of uniqueSubcatRows) {
    const key = `${row.categoria_principal}|${row.subcategoria_sugerida}`;
    const current = catalogMap.get(key) || {
      categoria_principal: row.categoria_principal,
      subcategoria_sugerida: row.subcategoria_sugerida,
      total_comercios: 0,
    };
    current.total_comercios += 1;
    catalogMap.set(key, current);
  }
  const subcatCatalogRows = [...catalogMap.values()].sort((a, b) => {
    if (a.categoria_principal === b.categoria_principal) {
      return b.total_comercios - a.total_comercios;
    }
    return a.categoria_principal.localeCompare(b.categoria_principal, "es");
  });

  const mainWriter = createObjectCsvWriter({
    path: OUTPUT_MAIN,
    header: [
      { id: "place_id", title: "place_id" },
      { id: "nombre", title: "nombre" },
      { id: "telefono", title: "telefono" },
      { id: "direccion", title: "direccion" },
      { id: "municipio", title: "municipio" },
      { id: "latitud", title: "latitud" },
      { id: "longitud", title: "longitud" },
      { id: "categoria_principal", title: "categoria_principal" },
      { id: "categorias_detectadas_busqueda", title: "categorias_detectadas_busqueda" },
      { id: "subcategorias_sugeridas", title: "subcategorias_sugeridas" },
      { id: "business_status", title: "business_status" },
      { id: "google_types", title: "google_types" },
    ],
  });

  const subcatWriter = createObjectCsvWriter({
    path: OUTPUT_SUBCATS,
    header: [
      { id: "place_id", title: "place_id" },
      { id: "nombre", title: "nombre" },
      { id: "categoria_principal", title: "categoria_principal" },
      { id: "subcategoria_sugerida", title: "subcategoria_sugerida" },
    ],
  });

  const subcatCatalogWriter = createObjectCsvWriter({
    path: OUTPUT_SUBCAT_CATALOG,
    header: [
      { id: "categoria_principal", title: "categoria_principal" },
      { id: "subcategoria_sugerida", title: "subcategoria_sugerida" },
      { id: "total_comercios", title: "total_comercios" },
    ],
  });

  const filteredWriter = createObjectCsvWriter({
    path: OUTPUT_FILTERED,
    header: [
      { id: "place_id", title: "place_id" },
      { id: "nombre", title: "nombre" },
      { id: "municipio", title: "municipio" },
      { id: "motivo", title: "motivo" },
      { id: "business_status", title: "business_status" },
    ],
  });

  await mainWriter.writeRecords(acceptedRows);
  await subcatWriter.writeRecords(uniqueSubcatRows);
  await subcatCatalogWriter.writeRecords(subcatCatalogRows);
  await filteredWriter.writeRecords(filteredRows);

  console.log("");
  console.log("Done.");
  console.log(`Accepted commerces: ${acceptedRows.length}`);
  console.log(`Subcategory relation rows: ${uniqueSubcatRows.length}`);
  console.log(`Subcategory catalog rows: ${subcatCatalogRows.length}`);
  console.log(`Filtered rows: ${filteredRows.length}`);
  console.log(`Main CSV: ${OUTPUT_MAIN}`);
  console.log(`Subcategories CSV: ${OUTPUT_SUBCATS}`);
  console.log(`Subcategory catalog CSV: ${OUTPUT_SUBCAT_CATALOG}`);
  console.log(`Filtered report CSV: ${OUTPUT_FILTERED}`);
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
