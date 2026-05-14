#!/usr/bin/env python3
from __future__ import annotations

import csv
import html
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

SOURCE_NAME = "pietix"
HOME_URL = "https://pietix.com"
REQUEST_TIMEOUT = 40
REQUEST_SLEEP_SECONDS = 0.2

EVENTOS_CSV = "eventos_pietix.csv"
EVENTOS_MUNICIPIOS_CSV = "eventos_municipios_pietix.csv"
EVENTO_FECHAS_CSV = "eventoFechas_pietix.csv"
EVENTOS_BOLETERIAS_CSV = "eventos_boleterias_pietix.csv"
NO_DATED_CSV = "no_dated_items_pietix.csv"
CATEGORIAS_SQL = "categoriaEventos_nuevas_insert.sql"
AUDITORIA_CSV = "auditoria_eventos_pietix.csv"


def load_env_file(path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            env[key] = value
    return env


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.lower()
    value = re.sub(r"[^a-z0-9\s/]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def clean_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def sanitize_description(value: str) -> str:
    cleaned = clean_spaces(value or "")
    return cleaned if cleaned else ""


def html_to_text(fragment: str) -> str:
    if not fragment:
        return ""
    text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", fragment)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|li|h1|h2|h3|section|article|tr|ul)>", "\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html.unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def safe_int(value: str, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


class SimpleHttp:
    def __init__(self) -> None:
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
        }

    def fetch_text(self, url: str, extra_headers: Optional[Dict[str, str]] = None) -> str:
        headers = dict(self.headers)
        if extra_headers:
            headers.update(extra_headers)
        req = urllib.request.Request(url=url, headers=headers)
        with self.opener.open(req, timeout=REQUEST_TIMEOUT) as response:
            content_type = response.headers.get("Content-Type", "")
            charset_match = re.search(r"charset=([^\s;]+)", content_type, flags=re.I)
            charset = charset_match.group(1).strip() if charset_match else "utf-8"
            raw = response.read()
            return raw.decode(charset, errors="replace")


class SupabaseRest:
    def __init__(self, http: SimpleHttp, url: str, key: str) -> None:
        self.http = http
        self.url = url.rstrip("/")
        self.key = key
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        }

    def select(self, table: str, query: str) -> List[dict]:
        endpoint = f"{self.url}/rest/v1/{table}?{query}"
        req = urllib.request.Request(endpoint, headers=self.headers)
        with self.http.opener.open(req, timeout=REQUEST_TIMEOUT) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return json.loads(raw or "[]")

    def get_max_id(self, table: str) -> int:
        rows = self.select(table, "select=id&order=id.desc&limit=1")
        if not rows:
            return 0
        return safe_int(str(rows[0].get("id", 0)), 0)

    def insert_rows(self, table: str, rows: List[dict], *, returning: bool = True) -> List[dict]:
        if not rows:
            return []
        endpoint = f"{self.url}/rest/v1/{table}"
        headers = dict(self.headers)
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = "return=representation" if returning else "return=minimal"
        req = urllib.request.Request(
            url=endpoint,
            data=json.dumps(rows).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with self.http.opener.open(req, timeout=REQUEST_TIMEOUT) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return json.loads(raw or "[]")


def detect_municipio_id(text: str, municipios: List[Tuple[int, str, str]]) -> Tuple[Optional[int], str]:
    if not text:
        return None, ""
    norm = f" {normalize_text(text)} "
    for municipio_id, nombre, nombre_norm in municipios:
        token = f" {nombre_norm} "
        if token in norm:
            return municipio_id, nombre
    return None, ""


def is_puerto_rico_location(country: str, region: str) -> bool:
    country_norm = normalize_text(country or "")
    region_norm = normalize_text(region or "")
    if country_norm in {"pr", "puerto rico"}:
        return True
    if region_norm in {"pr", "puerto rico"}:
        return True
    # Algunos feeds usan "US/USA" para PR; en ese caso no descartar aquí.
    if country_norm in {"us", "usa", "united states", "estados unidos"}:
        return True
    return False


def has_explicit_non_pr_marker(text: str) -> bool:
    norm = f" {normalize_text(text)} "
    if not norm.strip():
        return False
    if " puerto rico " in norm:
        return False
    non_pr_markers = (
        " mexico ",
        " cdmx ",
        " ciudad de mexico ",
        " monterrey ",
        " guadalajara ",
        " republica dominicana ",
        " dominican republic ",
        " santo domingo ",
        " miami ",
        " orlando ",
        " new york ",
        " los angeles ",
        " bogota ",
        " medellin ",
        " lima ",
        " madrid ",
        " buenos aires ",
        " chile ",
        " argentina ",
        " colombia ",
        " peru ",
    )
    return any(marker in norm for marker in non_pr_markers)


def detect_non_event_reason(*parts: str) -> str:
    norm = f" {normalize_text(' '.join([p or '' for p in parts]))} "
    if not norm.strip():
        return ""

    rental_markers = (
        " alquiler ",
        " alquila ",
        " alquilar ",
        " renta ",
        " rent ",
        " rental ",
        " for rent ",
    )
    if any(marker in norm for marker in rental_markers):
        return "Descartado: no es evento (alquiler/renta)"

    sale_markers = (
        " venta ",
        " vende ",
        " se vende ",
        " for sale ",
    )
    ticket_sale_allow = (
        " venta de boletos ",
        " venta de boleto ",
        " venta de entradas ",
        " venta de entrada ",
        " ticket sale ",
    )
    if any(marker in norm for marker in sale_markers):
        if any(marker in norm for marker in ticket_sale_allow):
            return ""
        product_markers = (
            " gazebo ",
            " gazebos ",
            " salon ",
            " actividades ",
            " carpa ",
            " carpas ",
            " silla ",
            " sillas ",
            " mesa ",
            " mesas ",
            " inflable ",
            " inflables ",
            " articulo ",
            " articulos ",
            " producto ",
            " productos ",
            " mercancia ",
            " merchandise ",
            " equipo ",
            " equipos ",
        )
        if any(marker in norm for marker in product_markers):
            return "Descartado: no es evento (venta/artículo)"
        if norm.strip().startswith("venta "):
            return "Descartado: no es evento (venta/artículo)"

    return ""


def infer_category_label(raw_category: str, nombre: str, descripcion: str) -> str:
    raw = clean_spaces(raw_category)
    raw_norm = normalize_text(raw)
    generic = {"otro", "otros", "otra", "otras", "other", "others", "general", "n/a", "na"}
    if raw and raw_norm not in generic:
        return raw

    text = normalize_text(" ".join([nombre or "", descripcion or "", raw or ""]))
    if not text:
        return "Otros"

    keyword_to_label = [
        (["gaming", "esport", "videojuego", "game"], "Gaming"),
        (["fair", "feria", "expo", "convencion", "convención"], "Ferias"),
        (["comedy", "comedia", "standup", "stand up", "impro"], "Comedia"),
        (["sports", "deporte", "bsn", "baloncesto", "basket", "futbol"], "Deportes"),
        (["concert", "concierto", "musica", "música"], "Conciertos"),
        (["culture", "cultura", "theater", "teatro", "musical"], "Cultura / Teatro"),
        (["food", "gastronomic", "gastronomico", "culinary"], "Gastronomía"),
        (["horror", "terror"], "Terror"),
        (["family", "familiar", "kids", "ninos", "niños"], "Familiar"),
    ]
    for keywords, label in keyword_to_label:
        if any(normalize_text(k) in text for k in keywords):
            return label
    return "Otros"


def map_category_id(
    raw_category: str,
    nombre_evento: str,
    descripcion_evento: str,
    categories_existing: List[dict],
    new_categories: Dict[str, int],
    next_category_id: int,
) -> Tuple[int, int]:
    existing_by_norm = {normalize_text(str(row.get("nombre", ""))): int(row.get("id")) for row in categories_existing}
    valid_existing_ids = {int(row.get("id")) for row in categories_existing if row.get("id") is not None}

    mapping_keywords = [
        (1, ["concert", "concierto", "musica", "music"]),
        (2, ["festival"]),
        (3, ["sports", "deporte", "deportivo", "basket", "baseball", "futbol", "football", "mma", "boxing"]),
        (4, ["fair", "feria", "expo"]),
        (5, ["family", "familiar", "kids", "ninos", "niños"]),
        (6, ["party", "nightclub", "discoteca", "club", "bailable"]),
        (7, ["culture", "cultura", "theater", "theatre", "teatro", "musical", "artes escenicas", "magia"]),
        (8, ["food", "gastronomic", "gastronomico", "gastronómico", "culinary"]),
        (10, ["comedy", "comedia", "standup", "stand up", "impro"]),
        (12, ["horror", "terror"]),
        (0, ["gaming", "gamer", "esport", "e-sport"]),
        (9, ["other", "otro"]),
    ]

    inferred_label = infer_category_label(raw_category, nombre_evento, descripcion_evento)
    candidates: List[str] = []
    for value in [clean_spaces(raw_category), inferred_label, "Otros"]:
        if value and value not in candidates:
            candidates.append(value)

    for label in candidates:
        raw = normalize_text(label)
        if not raw:
            continue
        if raw in existing_by_norm:
            return existing_by_norm[raw], next_category_id

        for category_id, keywords in mapping_keywords:
            if any(normalize_text(keyword) in raw for keyword in keywords):
                if category_id and category_id in valid_existing_ids:
                    return category_id, next_category_id
                for norm_name, db_id in existing_by_norm.items():
                    if any(normalize_text(keyword) in norm_name for keyword in keywords):
                        return db_id, next_category_id

        if raw in new_categories:
            return new_categories[raw], next_category_id

        if raw not in {"otro", "otros", "other", "others"}:
            assigned = next_category_id
            new_categories[raw] = assigned
            return assigned, assigned + 1

    if "otros" in existing_by_norm:
        return existing_by_norm["otros"], next_category_id
    if 9 in valid_existing_ids:
        return 9, next_category_id

    if "otros" in new_categories:
        return new_categories["otros"], next_category_id
    assigned = next_category_id
    new_categories["otros"] = assigned
    return assigned, assigned + 1


def write_csv(path: Path, headers: List[str], rows: List[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in headers})


def display_name_from_norm(norm_name: str) -> str:
    if not norm_name:
        return "Otros"
    return " ".join([word.capitalize() for word in norm_name.split()])


def write_category_sql(path: Path, categories_new: Dict[str, int]) -> int:
    if not categories_new:
        path.write_text("", encoding="utf-8")
        return 0
    reverse = sorted(((cid, norm_name) for norm_name, cid in categories_new.items()), key=lambda x: x[0])
    lines = []
    for cid, norm_name in reverse:
        readable_name = display_name_from_norm(norm_name)
        lines.append(f'insert into public."categoriaEventos" (id, nombre) values ({cid}, {json.dumps(readable_name)});')
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(reverse)


def insert_new_categories_direct(supabase: SupabaseRest, categories_new: Dict[str, int]) -> int:
    if not categories_new:
        return 0
    rows = [{"id": int(cid), "nombre": display_name_from_norm(norm)} for norm, cid in sorted(categories_new.items(), key=lambda x: x[1])]
    try:
        supabase.insert_rows("categoriaEventos", rows, returning=False)
        return len(rows)
    except Exception as exc:
        print(f"[WARN] No se pudieron crear categorías nuevas automáticamente: {exc}", file=sys.stderr)
        return 0


def extract_home_events(home_html: str) -> List[dict]:
    m = re.search(r'id="input-name"[^>]*data-variable="([^"]+)"', home_html, flags=re.I)
    if not m:
        return []
    raw = html.unescape(m.group(1))
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict) and item.get("url")]
    except Exception:
        return []
    return []


def extract_og_image(page_html: str) -> str:
    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', page_html, flags=re.I)
    if m:
        return clean_spaces(html.unescape(m.group(1)))
    return ""


def extract_description(page_html: str) -> str:
    m = re.search(r'(?is)<div[^>]*id=["\']description["\'][^>]*>(.*?)</div>', page_html)
    if not m:
        return ""
    return sanitize_description(html_to_text(m.group(1)))


def extract_ld_events(page_html: str) -> List[dict]:
    blocks = re.findall(r'<script type="application/ld\+json">\s*(\[.*?\]|\{.*?\})\s*</script>', page_html, flags=re.S)
    events: List[dict] = []
    for block in blocks:
        try:
            data = json.loads(block)
        except Exception:
            continue
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and str(item.get("@type", "")).lower() == "event":
                    events.append(item)
        elif isinstance(data, dict) and str(data.get("@type", "")).lower() == "event":
            events.append(data)
    return events


def parse_iso_to_date_time(start_date: str) -> Tuple[str, str]:
    try:
        dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except Exception:
        return "", ""


def detect_image_orientation(image_url: str) -> str:
    text = (image_url or "").lower()
    if not text:
        return "unknown"
    horizontal_markers = ("banner", "cover", "landscape", "1200x630", "16x9", "16_9", "1440x480")
    vertical_markers = ("poster", "flyer", "portrait", "560x700", "4x5", "3x4", "515x390")
    if any(marker in text for marker in horizontal_markers):
        return "horizontal"
    if any(marker in text for marker in vertical_markers):
        return "vertical"
    return "unknown"


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current] + list(current.parents):
        if (candidate / "AGENTS.md").exists() and (candidate / "public").exists():
            return candidate
    return start.resolve()


def main() -> int:
    script_path = Path(__file__).resolve()
    repo_root = find_repo_root(script_path.parent)
    export_dir = repo_root / "exports" / SOURCE_NAME
    export_dir.mkdir(parents=True, exist_ok=True)

    env: Dict[str, str] = {}
    env.update(load_env_file(repo_root / ".env"))
    env.update(load_env_file(repo_root / ".env.local"))
    env.update(os.environ)

    supabase_url = env.get("SUPABASE_URL", "").strip()
    supabase_key = (env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_ANON_KEY") or "").strip()
    if not supabase_url or not supabase_key:
        print("ERROR: Falta SUPABASE_URL o key (SERVICE_ROLE/ANON).", file=sys.stderr)
        return 1

    http = SimpleHttp()
    supabase = SupabaseRest(http=http, url=supabase_url, key=supabase_key)

    municipios_rows = supabase.select("Municipios", "select=id,nombre&order=nombre.asc")
    municipios: List[Tuple[int, str, str]] = []
    for row in municipios_rows:
        mid = safe_int(str(row.get("id", 0)))
        nombre = clean_spaces(str(row.get("nombre", "")))
        if mid and nombre:
            municipios.append((mid, nombre, normalize_text(nombre)))
    municipios.sort(key=lambda item: len(item[2]), reverse=True)

    categorias_existing = supabase.select("categoriaEventos", "select=id,nombre,icono&order=id.asc")
    max_event_id = supabase.get_max_id("eventos")
    max_evento_municipio_id = supabase.get_max_id("eventos_municipios")
    max_evento_fecha_id = supabase.get_max_id("eventoFechas")

    home_html = http.fetch_text(HOME_URL)
    home_items = extract_home_events(home_html)
    if not home_items:
        print("ERROR: No se detectaron eventos en Pietix home.", file=sys.stderr)
        return 1

    eventos_rows: List[dict] = []
    eventos_municipios_rows: List[dict] = []
    evento_fechas_rows: List[dict] = []
    eventos_boleterias_rows: List[dict] = []
    no_dated_rows: List[dict] = []
    auditoria_rows: List[dict] = []

    event_id_seq = max_event_id
    evento_municipio_id_seq = max_evento_municipio_id
    evento_fecha_id_seq = max_evento_fecha_id

    categories_new: Dict[str, int] = {}
    next_new_category_id = max(13, max((safe_int(str(r.get("id", 0))) for r in categorias_existing), default=0) + 1)

    seen_urls = set()

    for idx, item in enumerate(home_items, start=1):
        rel_url = clean_spaces(str(item.get("url", "")))
        if not rel_url:
            continue
        event_url = urllib.parse.urljoin(HOME_URL + "/", rel_url.lstrip("/"))
        if event_url in seen_urls:
            continue
        seen_urls.add(event_url)

        source_event_id = rel_url.strip("/").split("/")[0]
        nombre = clean_spaces(str(item.get("name", source_event_id)))
        keywords = clean_spaces(str(item.get("keywords", "")))

        try:
            page_html = http.fetch_text(event_url, extra_headers={"Referer": HOME_URL})
        except Exception as exc:
            no_dated_rows.append({
                "url": event_url,
                "nombre": nombre,
                "categoria_raw": "",
                "motivo": f"Error al extraer detalle: {exc}",
                "descripcion_preview": "",
            })
            continue

        image_url = extract_og_image(page_html)
        description = extract_description(page_html)
        ld_events = extract_ld_events(page_html)

        if not ld_events:
            no_dated_rows.append({
                "url": event_url,
                "nombre": nombre,
                "categoria_raw": "",
                "motivo": "Sin bloques Event en JSON-LD",
                "descripcion_preview": description[:280],
            })
            continue

        non_event_reason = detect_non_event_reason(nombre, description, keywords)
        if non_event_reason:
            no_dated_rows.append({
                "url": event_url,
                "nombre": nombre,
                "categoria_raw": "",
                "motivo": non_event_reason,
                "descripcion_preview": description[:280],
            })
            continue

        occurrences: List[dict] = []
        venues_map: Dict[Tuple[int, str, str], dict] = {}
        prices: List[float] = []

        for ev in ld_events:
            start_date = clean_spaces(str(ev.get("startDate", "")))
            fecha, hora = parse_iso_to_date_time(start_date)
            if not fecha or not hora:
                continue

            location = ev.get("location") if isinstance(ev.get("location"), dict) else {}
            venue_name = clean_spaces(str(location.get("name", "")))
            address = location.get("address") if isinstance(location.get("address"), dict) else {}
            locality = clean_spaces(str(address.get("addressLocality", "")))
            region = clean_spaces(str(address.get("addressRegion", "")))
            country = clean_spaces(str(address.get("addressCountry", "")))

            # Filtro duro: no importar sesiones fuera de Puerto Rico.
            if country and not is_puerto_rico_location(country=country, region=region):
                continue

            venue_text = " | ".join([x for x in [venue_name, locality, region] if x])
            if has_explicit_non_pr_marker(" | ".join([venue_text, country])):
                continue
            municipio_id, municipio_nombre = detect_municipio_id(venue_text, municipios)
            if not municipio_id:
                municipio_id, municipio_nombre = detect_municipio_id(" ".join([description, keywords, nombre]), municipios)

            if not municipio_id:
                continue

            direccion = clean_spaces(", ".join([x for x in [venue_name, locality, region] if x]))
            if not direccion:
                direccion = venue_name or municipio_nombre

            venue_key = (int(municipio_id), normalize_text(venue_name or municipio_nombre), normalize_text(direccion))
            venues_map[venue_key] = {
                "municipio_id": municipio_id,
                "municipio_nombre": municipio_nombre,
                "lugar": venue_name or municipio_nombre,
                "direccion": direccion,
            }

            offer = ev.get("offers") if isinstance(ev.get("offers"), dict) else {}
            offer_url = clean_spaces(str(offer.get("url", ""))) or event_url
            price = clean_spaces(str(offer.get("price", "")))
            try:
                if price:
                    prices.append(float(price.replace(",", "")))
            except Exception:
                pass

            occurrences.append({
                "fecha": fecha,
                "hora": hora,
                "municipio_id": municipio_id,
                "municipio_nombre": municipio_nombre,
                "lugar": venue_name or municipio_nombre,
                "direccion": direccion,
                "enlaceboletos": offer_url,
            })

        if not occurrences:
            no_dated_rows.append({
                "url": event_url,
                "nombre": nombre,
                "categoria_raw": "",
                "motivo": "Sin fechas concretas mapeables",
                "descripcion_preview": description[:280],
            })
            continue

        categoria_raw = infer_category_label("", nombre, f"{description} {keywords}")
        category_id, next_new_category_id = map_category_id(
            raw_category=categoria_raw,
            nombre_evento=nombre,
            descripcion_evento=description,
            categories_existing=categorias_existing,
            new_categories=categories_new,
            next_category_id=next_new_category_id,
        )

        image_orientation = detect_image_orientation(image_url)
        min_price = min(prices) if prices else None
        costo_texto = f"desde ${min_price:.2f}" if min_price is not None else ""

        event_id_seq += 1
        venue_primary = next(iter(venues_map.values()))
        eventos_rows.append({
            "id": event_id_seq,
            "source": SOURCE_NAME,
            "source_event_id": source_event_id,
            "nombre": nombre,
            "descripcion": description,
            "costo": costo_texto,
            "gratis": "false",
            "lugar": venue_primary["lugar"],
            "direccion": venue_primary["direccion"],
            "municipio_id": venue_primary["municipio_id"],
            "categoria": category_id,
            "enlaceboletos": event_url,
            "boletos_por_localidad": "false",
            "imagen": image_url,
            "imagen_orientacion": image_orientation,
            "image_crop_mode": "cover",
            "image_focus_x": "0.50",
            "image_focus_y": "0.28",
            "image_zoom": "1.08",
            "image_focus_confidence": "80",
            "image_focus_source": "pietix_auto_v1",
            "activo": "true",
        })

        eventos_boleterias_rows.append({
            "evento_id": event_id_seq,
            "source": SOURCE_NAME,
            "source_event_id": source_event_id,
            "url_evento": event_url,
            "logo_key": SOURCE_NAME,
            "prioridad": "20",
            "activo": "true",
        })

        venue_id_by_key: Dict[Tuple[int, str, str], int] = {}
        for v in venues_map.values():
            evento_municipio_id_seq += 1
            vkey = (int(v["municipio_id"]), normalize_text(v["lugar"]), normalize_text(v["direccion"]))
            venue_id_by_key[vkey] = evento_municipio_id_seq
            eventos_municipios_rows.append({
                "id": evento_municipio_id_seq,
                "event_id": event_id_seq,
                "source": SOURCE_NAME,
                "source_event_id": source_event_id,
                "municipio_id": v["municipio_id"],
                "lugar": v["lugar"],
                "localidad_key": f"{int(v['municipio_id'])}|{normalize_text(v['lugar'])}",
                "direccion": v["direccion"],
                "enlaceboletos": event_url,
            })

        seen_occ = set()
        for occ in sorted(occurrences, key=lambda x: (x["fecha"], x["hora"])):
            key = (
                occ["fecha"], occ["hora"], int(occ["municipio_id"]), normalize_text(occ["lugar"]), normalize_text(occ["direccion"])
            )
            if key in seen_occ:
                continue
            seen_occ.add(key)
            vkey = (int(occ["municipio_id"]), normalize_text(occ["lugar"]), normalize_text(occ["direccion"]))
            evento_municipio_id = venue_id_by_key.get(vkey)
            if not evento_municipio_id:
                continue
            evento_fecha_id_seq += 1
            evento_fechas_rows.append({
                "id": evento_fecha_id_seq,
                "evento_municipio_id": evento_municipio_id,
                "source": SOURCE_NAME,
                "fecha": occ["fecha"],
                "horainicio": occ["hora"],
                "mismahora": "false",
            })

        auditoria_rows.append({
            "evento_id_temp": event_id_seq,
            "source_event_id": source_event_id,
            "url": event_url,
            "nombre_final": nombre,
            "categoria_origen_boleteria": "",
            "categoria_inferida_script": categoria_raw,
            "categoria_final_id": category_id,
            "categoria_final_nombre": "",
            "usa_sesiones_compra": "true",
            "total_sesiones_detectadas": len(occurrences),
            "total_venues_detectadas": len(venues_map),
            "municipio_principal_id": venue_primary["municipio_id"],
            "municipio_principal_nombre": venue_primary["municipio_nombre"],
            "municipios_detectados_en_venues": "|".join(sorted({str(v["municipio_id"]) for v in venues_map.values()})),
            "municipios_detectados_en_sesiones": "|".join(sorted({str(o["municipio_id"]) for o in occurrences})),
            "lugar_principal": venue_primary["lugar"],
            "direccion_principal": venue_primary["direccion"],
            "total_fechas_finales": len(occurrences),
            "primera_fecha": sorted([o["fecha"] for o in occurrences])[0],
            "ultima_fecha": sorted([o["fecha"] for o in occurrences])[-1],
        })

        if idx % 10 == 0:
            print(f"[INFO] Procesados {idx}/{len(home_items)} eventos de Pietix...")
        time.sleep(REQUEST_SLEEP_SECONDS)

    eventos_headers = [
        "id", "source", "source_event_id", "nombre", "descripcion", "costo", "gratis", "lugar", "direccion",
        "municipio_id", "categoria", "enlaceboletos", "boletos_por_localidad", "imagen", "imagen_orientacion",
        "image_crop_mode", "image_focus_x", "image_focus_y", "image_zoom", "image_focus_confidence", "image_focus_source", "activo"
    ]
    eventos_municipios_headers = [
        "id", "event_id", "source", "source_event_id", "municipio_id", "lugar", "localidad_key", "direccion", "enlaceboletos"
    ]
    evento_fechas_headers = ["id", "evento_municipio_id", "source", "fecha", "horainicio", "mismahora"]
    eventos_boleterias_headers = ["evento_id", "source", "source_event_id", "url_evento", "logo_key", "prioridad", "activo"]
    no_dated_headers = ["url", "nombre", "categoria_raw", "motivo", "descripcion_preview"]
    auditoria_headers = [
        "evento_id_temp", "source_event_id", "url", "nombre_final", "categoria_origen_boleteria", "categoria_inferida_script",
        "categoria_final_id", "categoria_final_nombre", "usa_sesiones_compra", "total_sesiones_detectadas", "total_venues_detectadas",
        "municipio_principal_id", "municipio_principal_nombre", "municipios_detectados_en_venues", "municipios_detectados_en_sesiones",
        "lugar_principal", "direccion_principal", "total_fechas_finales", "primera_fecha", "ultima_fecha",
    ]

    write_csv(export_dir / EVENTOS_CSV, eventos_headers, eventos_rows)
    write_csv(export_dir / EVENTOS_MUNICIPIOS_CSV, eventos_municipios_headers, eventos_municipios_rows)
    write_csv(export_dir / EVENTO_FECHAS_CSV, evento_fechas_headers, evento_fechas_rows)
    write_csv(export_dir / EVENTOS_BOLETERIAS_CSV, eventos_boleterias_headers, eventos_boleterias_rows)
    write_csv(export_dir / NO_DATED_CSV, no_dated_headers, no_dated_rows)
    write_csv(export_dir / AUDITORIA_CSV, auditoria_headers, auditoria_rows)

    total_new_categories_inserted = insert_new_categories_direct(supabase, categories_new)
    total_new_categories = write_category_sql(export_dir / CATEGORIAS_SQL, categories_new)

    print(f"\nRuta de exportación: {export_dir}")
    print(f"Filas {EVENTOS_CSV}: {len(eventos_rows)}")
    print(f"Filas {EVENTOS_MUNICIPIOS_CSV}: {len(eventos_municipios_rows)}")
    print(f"Filas {EVENTO_FECHAS_CSV}: {len(evento_fechas_rows)}")
    print(f"Filas {EVENTOS_BOLETERIAS_CSV}: {len(eventos_boleterias_rows)}")
    print(f"Filas {NO_DATED_CSV}: {len(no_dated_rows)}")
    print(f"Filas {AUDITORIA_CSV}: {len(auditoria_rows)}")
    print(f"Filas {CATEGORIAS_SQL} (categorías nuevas): {total_new_categories}")
    print(f"Categorías creadas automáticamente en DB: {total_new_categories_inserted}")

    print("\nResumen:")
    print(f"Total eventos exportados: {len(eventos_rows)}")
    print(f"Total venues (eventos_municipios): {len(eventos_municipios_rows)}")
    print(f"Total fechas (eventoFechas): {len(evento_fechas_rows)}")
    print(f"Total links de boletería: {len(eventos_boleterias_rows)}")
    print(f"Total items sin fecha: {len(no_dated_rows)}")
    print(f"Total categorías nuevas detectadas: {total_new_categories}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
