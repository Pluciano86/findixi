#!/usr/bin/env python3
from __future__ import annotations

import csv
import gzip
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

SOURCE_NAME = "ticketera"
LIST_URL = "https://www.ticketera.com/events"
REQUEST_TIMEOUT = 45
REQUEST_SLEEP_SECONDS = 0.2

EVENTOS_CSV = "eventos_ticketera.csv"
EVENTOS_MUNICIPIOS_CSV = "eventos_municipios_ticketera.csv"
EVENTO_FECHAS_CSV = "eventoFechas_ticketera.csv"
EVENTOS_BOLETERIAS_CSV = "eventos_boleterias_ticketera.csv"
NO_DATED_CSV = "no_dated_items_ticketera.csv"
CATEGORIAS_SQL = "categoriaEventos_nuevas_insert.sql"
AUDITORIA_CSV = "auditoria_eventos_ticketera.csv"

MONTHS = {
    "ene": 1, "enero": 1, "jan": 1, "january": 1,
    "feb": 2, "febrero": 2, "february": 2,
    "mar": 3, "marzo": 3, "march": 3,
    "abr": 4, "abril": 4, "apr": 4, "april": 4,
    "may": 5, "mayo": 5,
    "jun": 6, "junio": 6, "june": 6,
    "jul": 7, "julio": 7, "july": 7,
    "ago": 8, "agosto": 8, "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "septiembre": 9, "september": 9,
    "oct": 10, "octubre": 10, "october": 10,
    "nov": 11, "noviembre": 11, "november": 11,
    "dic": 12, "diciembre": 12, "dec": 12, "december": 12,
}

VENUE_MUNICIPIO_HINTS = {
    "coliseo ruben rodriguez": "Bayamon",
    "coliseo de puerto rico": "San Juan",
    "choliseo": "San Juan",
    "coca cola music hall": "San Juan",
    "bellas artes de caguas": "Caguas",
    "vivo beach club": "Carolina",
    "monero cafe teatro": "Caguas",
    "puerto rico convention center": "San Juan",
    "cba santurce": "San Juan",
    "teatro braulio castillo": "Bayamon",
    "teatro yaguez": "Mayaguez",
    "teatro ideal": "Yauco",
    "centro de bellas artes de san sebastian": "San Sebastian",
    "museo de arte de puerto rico": "San Juan",
    "coliseo carlos miguel mangual": "Canovanas",
    "teatro tapia": "San Juan",
    "teatro inter": "San Juan",
    "sala sinfonica pablo casals": "San Juan",
    "coliseo roberto clemente": "San Juan",
}


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
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9\s/]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def clean_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def sanitize_description(value: str) -> str:
    text = (value or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = [clean_spaces(line) for line in text.split("\n")]
    compact: List[str] = []
    prev_blank = False
    for line in lines:
        if not line:
            if not prev_blank:
                compact.append("")
            prev_blank = True
            continue
        compact.append(line)
        prev_blank = False
    while compact and compact[0] == "":
        compact.pop(0)
    while compact and compact[-1] == "":
        compact.pop()
    cleaned = "\n".join(compact).strip()
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
            "Accept-Language": "es-PR,es;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Connection": "keep-alive",
        }

    def fetch_bytes(self, url: str, extra_headers: Optional[Dict[str, str]] = None) -> bytes:
        headers = dict(self.headers)
        if extra_headers:
            headers.update(extra_headers)
        req = urllib.request.Request(url=url, headers=headers)
        with self.opener.open(req, timeout=REQUEST_TIMEOUT) as response:
            return response.read()

    def fetch_text(self, url: str, extra_headers: Optional[Dict[str, str]] = None) -> str:
        raw = self.fetch_bytes(url, extra_headers=extra_headers)
        if raw.startswith(b"\x1f\x8b"):
            try:
                raw = gzip.decompress(raw)
            except Exception:
                pass
        return raw.decode("utf-8", errors="replace")


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


def has_explicit_non_pr_marker(text: str) -> bool:
    norm = f" {normalize_text(text)} "
    if not norm.strip():
        return False
    # Regla de negocio: descartar cualquier evento que mencione "Florida".
    if " florida " in norm:
        return True

    pr_markers = (
        " puerto rico ",
        " san juan pr ",
        " san juan puerto rico ",
    )
    if any(marker in norm for marker in pr_markers):
        return False

    non_pr_markers = (
        " florida usa ",
        " florida united states ",
        " miami fl ",
        " miami florida ",
        " orlando fl ",
        " orlando florida ",
        " tampa fl ",
        " tampa florida ",
        " jacksonville fl ",
        " jacksonville florida ",
        " fort lauderdale fl ",
        " fort lauderdale florida ",
        " west palm beach fl ",
        " west palm beach florida ",
        " miami dade ",
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

    non_event_markers = (
        " parking ",
        " parking vip ",
        " vip parking ",
        " valet parking ",
        " estacionamiento ",
        " estacionamientos ",
        " alquiler de salon ",
        " alquiler de salones ",
        " alquiler de venue ",
        " renta de salon ",
        " renta de salones ",
        " renta de venue ",
    )
    if any(marker in norm for marker in non_event_markers):
        return "Descartado: no es evento (parking/venue)"

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


def parse_time_12h_to_24h(text: str) -> str:
    m = re.search(r"\b(\d{1,2}):(\d{2})\s*([AaPp][Mm])\b", text or "")
    if not m:
        return ""
    hh = safe_int(m.group(1))
    mm = safe_int(m.group(2))
    ampm = m.group(3).lower()
    if not (1 <= hh <= 12 and 0 <= mm <= 59):
        return ""
    if ampm == "am":
        hh = 0 if hh == 12 else hh
    else:
        hh = 12 if hh == 12 else hh + 12
    return f"{hh:02d}:{mm:02d}"


def parse_date_text(date_text: str, fallback_year: Optional[int] = None) -> str:
    raw = normalize_text(date_text).replace(".", " ")
    m = re.search(r"\b([a-z]+)\s+(\d{1,2})\s+(\d{4})\b", raw)
    if m:
        month = MONTHS.get(m.group(1), 0)
        day = safe_int(m.group(2))
        year = safe_int(m.group(3))
        if month and 1 <= day <= 31 and 2000 <= year <= 2100:
            return f"{year:04d}-{month:02d}-{day:02d}"

    m2 = re.search(r"\b([a-z]+)\s+(\d{1,2})\b", raw)
    if m2 and fallback_year:
        month = MONTHS.get(m2.group(1), 0)
        day = safe_int(m2.group(2))
        if month and 1 <= day <= 31 and 2000 <= fallback_year <= 2100:
            return f"{fallback_year:04d}-{month:02d}-{day:02d}"

    m3 = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", raw)
    if m3:
        year = safe_int(m3.group(1))
        month = safe_int(m3.group(2))
        day = safe_int(m3.group(3))
        if 2000 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"

    return ""


def parse_fallback_year(page_html: str) -> int:
    m = re.search(r"<span class=\"m-date__year\">\s*,?\s*(20\d{2})\s*</span>", page_html)
    if m:
        return safe_int(m.group(1), 0)
    m2 = re.search(r"\b(20\d{2})\b", html_to_text(page_html))
    if m2:
        return safe_int(m2.group(1), 0)
    return datetime.now().year


def extract_meta_content(page_html: str, attr_name: str, attr_value: str) -> str:
    pattern = rf"""<meta\b[^>]*\b{re.escape(attr_name)}=[\"']{re.escape(attr_value)}[\"'][^>]*\bcontent=[\"']([^\"']*)[\"'][^>]*>"""
    m = re.search(pattern, page_html, flags=re.I)
    if m:
        return clean_spaces(html.unescape(m.group(1)))
    pattern_rev = rf"""<meta\b[^>]*\bcontent=[\"']([^\"']*)[\"'][^>]*\b{re.escape(attr_name)}=[\"']{re.escape(attr_value)}[\"'][^>]*>"""
    m = re.search(pattern_rev, page_html, flags=re.I)
    if m:
        return clean_spaces(html.unescape(m.group(1)))
    return ""


def extract_listing_entries(list_html: str) -> List[dict]:
    blocks = re.findall(r"(?is)<div class=\"eventItem entry[^\"]*clearfix\">(.*?)</div>\s*</div>", list_html)
    rows: List[dict] = []
    seen = set()
    for block in blocks:
        m_url = re.search(r"href=\"(https://www\.ticketera\.com/events/detail/[^\"#?]+)", block, flags=re.I)
        if not m_url:
            continue
        event_url = clean_spaces(m_url.group(1))
        if not event_url:
            continue
        key = event_url.lower()
        if key in seen:
            continue
        seen.add(key)

        m_name = re.search(r"<h2[^>]*>\s*<a[^>]*>(.*?)</a>", block, flags=re.I | re.S)
        m_img = re.search(r"<img[^>]+src=\"([^\"]+)\"", block, flags=re.I)
        m_date = re.search(r"<div class=\"date\">(.*?)</div>", block, flags=re.I | re.S)
        m_loc = re.search(r"<div class=\"location[^\"]*\">(.*?)</div>", block, flags=re.I | re.S)

        rows.append(
            {
                "url": event_url,
                "title_listing": clean_spaces(html_to_text(m_name.group(1))) if m_name else "",
                "image_listing": clean_spaces(html.unescape(m_img.group(1))) if m_img else "",
                "date_listing": clean_spaces(html_to_text(m_date.group(1))) if m_date else "",
                "location_listing": clean_spaces(html_to_text(m_loc.group(1))) if m_loc else "",
            }
        )
    return rows


def extract_discovery_urls(list_html: str) -> List[str]:
    urls: List[str] = []
    seen = set()
    for href in re.findall(r'href=["\']([^"\']+)["\']', list_html, flags=re.I):
        href = clean_spaces(html.unescape(href))
        if not href:
            continue
        if "/events/category/" not in href and "/events/venue/" not in href:
            continue
        full = urllib.parse.urljoin("https://www.ticketera.com/", href)
        key = full.lower()
        if key in seen:
            continue
        seen.add(key)
        urls.append(full)
    return urls


def extract_detail_title(page_html: str, fallback: str) -> str:
    og_title = extract_meta_content(page_html, "property", "og:title")
    if og_title:
        return clean_spaces(re.sub(r"\s*\|\s*Ticketera\s*$", "", og_title, flags=re.I))
    m_h1 = re.search(r"(?is)<h1[^>]*>(.*?)</h1>", page_html)
    if m_h1:
        return clean_spaces(html_to_text(m_h1.group(1)))
    return fallback


def extract_description(page_html: str) -> str:
    m = re.search(r"(?is)<div class=\"event_description[^\"]*\"[^>]*>(.*?)</div>", page_html)
    if not m:
        return ""
    return sanitize_description(html_to_text(m.group(1)))


def extract_keywords(page_html: str) -> str:
    # Preferir el bloque de categoría visible del evento (más confiable que meta keywords SEO).
    m_sidebar = re.search(
        r'(?is)<li class="item sidebar_event_keywords"[^>]*>.*?<span>(.*?)</span>',
        page_html,
    )
    if m_sidebar:
        sidebar_text = clean_spaces(html_to_text(m_sidebar.group(1)))
        if sidebar_text:
            return sidebar_text
    return extract_meta_content(page_html, "name", "keywords")


def extract_default_venue(page_html: str) -> str:
    m = re.search(
        r"(?is)<li class=\"item sidebar_event_venue\"[^>]*>.*?<span>(.*?)</span>",
        page_html,
    )
    if not m:
        return ""
    return clean_spaces(html_to_text(m.group(1)))


def extract_showings(page_html: str) -> List[dict]:
    showings: List[dict] = []
    fallback_year = parse_fallback_year(page_html)

    for m in re.finditer(r"(?is)<div id=\"showing_\d+\" class=\"listItem[^\"]*\"\s*>(.*?)</div>", page_html):
        block = m.group(1)
        m_url = re.search(r"href=\"(https://[^\"]+)\"[^>]*class=\"tickets", block, flags=re.I)
        m_title = re.search(r"title=\"([^\"]+)\"", block, flags=re.I)
        m_date_cell = re.search(r"<span class=\"cell showings_date\">(.*?)</span>", block, flags=re.I | re.S)
        m_time = re.search(r"<span class=\"time cell\">(.*?)</span>", block, flags=re.I | re.S)
        m_venue = re.search(r"<span class=\"showing_venue\">(.*?)</span>", block, flags=re.I | re.S)

        date_title = clean_spaces(html.unescape(m_title.group(1))) if m_title else ""
        date_candidate = parse_date_text(date_title, fallback_year=fallback_year)

        if not date_candidate and m_date_cell:
            date_candidate = parse_date_text(html_to_text(m_date_cell.group(1)), fallback_year=fallback_year)

        time_candidate = parse_time_12h_to_24h(html_to_text(m_time.group(1)) if m_time else date_title)
        venue = clean_spaces(html_to_text(m_venue.group(1))) if m_venue else ""

        if not date_candidate or not time_candidate:
            continue

        showings.append(
            {
                "fecha": date_candidate,
                "hora": time_candidate,
                "venue": venue,
                "ticket_url": clean_spaces(html.unescape(m_url.group(1))) if m_url else "",
                "title": date_title,
            }
        )

    unique: List[dict] = []
    seen = set()
    for row in showings:
        key = (
            row.get("fecha", ""),
            row.get("hora", ""),
            normalize_text(row.get("venue", "")),
            clean_spaces(row.get("ticket_url", "")).lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def infer_category_label(raw_category: str, nombre: str, descripcion: str) -> str:
    raw = clean_spaces(raw_category)
    text = normalize_text(" ".join([nombre or "", descripcion or "", raw or ""]))
    if not text:
        return "Otros"

    # Reglas específicas de negocio (prioridad alta).
    if any(k in text for k in ["comic con", "comicon", "cosplay", "otaku", "anime", "manga"]):
        return "Comicon / Cosplay"
    if any(k in text for k in ["magia", "ilusionismo", "ilusionista", "mago", "mentalista", "mentalismo", "dato curioso"]):
        return "Magia / Ilusionismo"
    if any(k in text for k in ["charla", "conferencia", "conversatorio", "seminario", "workshop", "masterclass", "relaciones"]):
        return "Charla / Conferencia"
    if any(k in text for k in ["experiencia", "inmersiva", "inmersivo", "retiro", "wellness", "mindfulness", "karmaval"]):
        return "Experiencia"

    keyword_to_label = [
        (["gaming", "esport", "videojuego", "game"], "Gaming"),
        (["fair", "feria", "expo", "convencion", "convención"], "Ferias"),
        (["comedy", "comedia", "standup", "stand up", "impro"], "Comedia"),
        (["sports", "deporte", "bsn", "baloncesto", "basket", "futbol"], "Deportes"),
        ([
            "concert", "concierto", "musica", "música", "tour", "world tour", "music hall",
            "orquesta", "banda", "salsa", "merengue", "reggaeton", "sinfonico", "sinfonica",
            "symphony", "symphonic", "filarmonica", "filarmonica"
        ], "Conciertos"),
        (["culture", "cultura", "theater", "teatro", "musical"], "Cultura / Teatro"),
        ([
            "food", "gastronomic", "gastronomico", "gastronomia", "gastronomy", "culinary",
            "mojito", "mojitos", "coctel", "cocteles", "cocktail", "cocktails", "mixologia", "sabor"
        ], "Gastronomía"),
        (["horror", "terror"], "Terror"),
        (["family", "familiar", "kids", "ninos", "niños"], "Familiar"),
    ]
    for keywords, label in keyword_to_label:
        if any(normalize_text(k) in text for k in keywords):
            return label

    # Solo aceptar categoría "raw" cuando parece realmente una categoría corta
    # (evita usar meta keywords largos como categoría literal).
    raw_norm = normalize_text(raw)
    generic = {"otro", "otros", "otra", "otras", "other", "others", "general", "n/a", "na"}
    raw_word_count = len(raw.split()) if raw else 0
    if (
        raw
        and raw_norm not in generic
        and "," not in raw
        and len(raw) <= 42
        and raw_word_count <= 4
    ):
        return raw

    # Heurística final: venue de concierto sin señales de comedia/deportes.
    if (
        ("coliseo" in text or "music hall" in text or "cpr" in text)
        and "comedia" not in text
        and "standup" not in text
        and "bsn" not in text
        and "deporte" not in text
    ):
        return "Conciertos"

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
        (0, ["magia", "ilusionismo", "ilusionista", "mago", "mentalista", "mentalismo", "dato curioso"]),
        (0, ["comicon", "comic con", "cosplay", "otaku", "anime", "manga"]),
        (0, ["charla", "conferencia", "conversatorio", "seminario", "workshop", "masterclass", "relaciones"]),
        (0, ["experiencia", "inmersiva", "inmersivo", "retiro", "wellness", "mindfulness", "karmaval"]),
        (7, ["culture", "cultura", "theater", "theatre", "teatro", "musical", "artes escenicas"]),
        (
            8,
            [
                "food", "gastronomic", "gastronomico", "gastronómico", "gastronomia",
                "gastronomy", "culinary", "mojito", "mojitos", "coctel", "cocteles",
                "cocktail", "cocktails", "mixologia", "sabor"
            ],
        ),
        (10, ["comedy", "comedia", "standup", "stand up", "impro"]),
        (12, ["horror", "terror"]),
        (0, ["gaming", "gamer", "esport", "e-sport"]),
        (9, ["other", "otro"]),
    ]

    inferred_label = infer_category_label(raw_category, nombre_evento, descripcion_evento)
    text_for_mapping = normalize_text(" ".join([raw_category or "", inferred_label or "", nombre_evento or "", descripcion_evento or ""]))

    inferred_norm = normalize_text(inferred_label)
    if inferred_norm and inferred_norm in existing_by_norm:
        return existing_by_norm[inferred_norm], next_category_id

    for category_id, keywords in mapping_keywords:
        if any(normalize_text(keyword) in text_for_mapping for keyword in keywords):
            if category_id and category_id in valid_existing_ids:
                return category_id, next_category_id
            for norm_name, db_id in existing_by_norm.items():
                if any(normalize_text(keyword) in norm_name for keyword in keywords):
                    return db_id, next_category_id

    if "otros" in existing_by_norm:
        return existing_by_norm["otros"], next_category_id
    if 9 in valid_existing_ids:
        return 9, next_category_id
    fallback_existing = min(valid_existing_ids) if valid_existing_ids else 1
    return fallback_existing, next_category_id


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


def build_venue_hint_map(municipios: List[Tuple[int, str, str]]) -> Dict[str, Tuple[int, str]]:
    by_norm = {mn_norm: (mn_id, mn_name) for mn_id, mn_name, mn_norm in municipios}
    out: Dict[str, Tuple[int, str]] = {}
    for venue_norm, municipio_name in VENUE_MUNICIPIO_HINTS.items():
        mn_norm = normalize_text(municipio_name)
        if mn_norm in by_norm:
            out[normalize_text(venue_norm)] = by_norm[mn_norm]
    return out


def resolve_municipio_for_venue(
    venue: str,
    fallback_text: str,
    municipios: List[Tuple[int, str, str]],
    venue_hint_map: Dict[str, Tuple[int, str]],
) -> Tuple[Optional[int], str]:
    municipio_id, municipio_nombre = detect_municipio_id(venue, municipios)
    if municipio_id:
        return municipio_id, municipio_nombre

    venue_norm = normalize_text(venue)
    for hint_key, value in venue_hint_map.items():
        if hint_key and hint_key in venue_norm:
            return value

    municipio_id, municipio_nombre = detect_municipio_id(fallback_text, municipios)
    if municipio_id:
        return municipio_id, municipio_nombre

    return None, ""


def summarize_price(description_text: str) -> str:
    lines = [clean_spaces(ln) for ln in description_text.split("\n") if clean_spaces(ln)]
    amounts = re.findall(r"\$\s*\d[\d,]*(?:\.\d{2})?", " ".join(lines))
    numeric_values: List[float] = []
    for amount in amounts:
        val = amount.replace("$", "").replace(" ", "").replace(",", "")
        try:
            numeric_values.append(float(val))
        except Exception:
            pass

    if numeric_values:
        min_value = min(numeric_values)
        if len(set(numeric_values)) > 1:
            return f"desde ${min_value:.2f}"
        return f"${numeric_values[0]:.2f}"

    if any(re.search(r"\b(gratis|free|libre de costo)\b", ln, flags=re.I) for ln in lines):
        return "Libre de Costo"

    return ""


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
    venue_hint_map = build_venue_hint_map(municipios)

    categorias_existing = supabase.select("categoriaEventos", "select=id,nombre,icono&order=id.asc")
    max_event_id = supabase.get_max_id("eventos")
    max_evento_municipio_id = supabase.get_max_id("eventos_municipios")
    max_evento_fecha_id = supabase.get_max_id("eventoFechas")

    list_html = http.fetch_text(LIST_URL)
    listing_entries_map: Dict[str, dict] = {}

    def add_entries_from_html(page_html: str) -> None:
        for row in extract_listing_entries(page_html):
            url = clean_spaces(row.get("url", ""))
            if not url:
                continue
            key = url.lower()
            if key not in listing_entries_map:
                listing_entries_map[key] = row

    add_entries_from_html(list_html)

    discovery_urls = extract_discovery_urls(list_html)
    for page_url in discovery_urls:
        try:
            page_html = http.fetch_text(page_url, extra_headers={"Referer": LIST_URL})
            add_entries_from_html(page_html)
        except Exception as exc:
            print(f"[WARN] No se pudo cargar página de descubrimiento {page_url}: {exc}", file=sys.stderr)

    listing_entries = list(listing_entries_map.values())
    if not listing_entries:
        print("ERROR: No se detectaron eventos en Ticketera /events.", file=sys.stderr)
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

    for idx, item in enumerate(listing_entries, start=1):
        event_url = clean_spaces(item.get("url", ""))
        if not event_url:
            continue

        parsed = urllib.parse.urlparse(event_url)
        parts = [p for p in parsed.path.split("/") if p]
        source_event_id = parts[-1] if parts else event_url

        try:
            detail_html = http.fetch_text(event_url, extra_headers={"Referer": LIST_URL})
        except Exception as exc:
            no_dated_rows.append(
                {
                    "url": event_url,
                    "nombre": item.get("title_listing", source_event_id),
                    "categoria_raw": "",
                    "motivo": f"Error al extraer detalle: {exc}",
                    "descripcion_preview": "",
                }
            )
            continue

        nombre = extract_detail_title(detail_html, item.get("title_listing", source_event_id))
        image_url = extract_meta_content(detail_html, "property", "og:image") or item.get("image_listing", "")
        description = extract_description(detail_html)
        keywords = extract_keywords(detail_html)
        default_venue = extract_default_venue(detail_html) or item.get("location_listing", "")

        showings = extract_showings(detail_html)
        if not showings:
            no_dated_rows.append(
                {
                    "url": event_url,
                    "nombre": nombre,
                    "categoria_raw": keywords,
                    "motivo": "Sin sesiones concretas con fecha/hora",
                    "descripcion_preview": description[:280],
                }
            )
            continue

        event_context = " | ".join(
            [
                item.get("location_listing", ""),
                default_venue,
                description,
                keywords,
                nombre,
            ]
        )
        if has_explicit_non_pr_marker(event_context):
            no_dated_rows.append(
                {
                    "url": event_url,
                    "nombre": nombre,
                    "categoria_raw": keywords,
                    "motivo": "Descartado: evento fuera de Puerto Rico",
                    "descripcion_preview": description[:280],
                }
            )
            continue

        non_event_reason = detect_non_event_reason(
            nombre,
            description,
            keywords,
            default_venue,
            item.get("location_listing", ""),
        )
        if non_event_reason:
            no_dated_rows.append(
                {
                    "url": event_url,
                    "nombre": nombre,
                    "categoria_raw": keywords,
                    "motivo": non_event_reason,
                    "descripcion_preview": description[:280],
                }
            )
            continue

        categoria_raw = infer_category_label(keywords, nombre, description)
        category_id, next_new_category_id = map_category_id(
            raw_category=categoria_raw,
            nombre_evento=nombre,
            descripcion_evento=description,
            categories_existing=categorias_existing,
            new_categories=categories_new,
            next_category_id=next_new_category_id,
        )

        occurrences: List[dict] = []
        venues_map: Dict[Tuple[int, str, str], dict] = {}

        for showing in showings:
            venue = clean_spaces(showing.get("venue", "")) or default_venue
            ticket_url = clean_spaces(showing.get("ticket_url", "")) or event_url
            fallback_text = " | ".join(
                [
                    venue,
                    default_venue,
                    item.get("location_listing", ""),
                    description,
                    keywords,
                    nombre,
                ]
            )
            if has_explicit_non_pr_marker(fallback_text):
                continue

            municipio_id, municipio_nombre = resolve_municipio_for_venue(
                venue=venue,
                fallback_text=fallback_text,
                municipios=municipios,
                venue_hint_map=venue_hint_map,
            )

            if not municipio_id:
                continue

            lugar = venue or municipio_nombre
            direccion = lugar
            if municipio_nombre and normalize_text(municipio_nombre) not in normalize_text(lugar):
                direccion = f"{lugar}, {municipio_nombre}"

            venue_key = (int(municipio_id), normalize_text(lugar), normalize_text(direccion))
            venues_map[venue_key] = {
                "municipio_id": municipio_id,
                "municipio_nombre": municipio_nombre,
                "lugar": lugar,
                "direccion": direccion,
            }

            occurrences.append(
                {
                    "fecha": showing.get("fecha", ""),
                    "hora": showing.get("hora", ""),
                    "municipio_id": municipio_id,
                    "municipio_nombre": municipio_nombre,
                    "lugar": lugar,
                    "direccion": direccion,
                    "enlaceboletos": ticket_url,
                }
            )

        if not occurrences:
            no_dated_rows.append(
                {
                    "url": event_url,
                    "nombre": nombre,
                    "categoria_raw": categoria_raw,
                    "motivo": "Sin sesiones mapeables a municipios",
                    "descripcion_preview": description[:280],
                }
            )
            continue

        costo_texto = summarize_price(description)

        event_id_seq += 1
        venue_primary = next(iter(venues_map.values()))
        eventos_rows.append(
            {
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
                "imagen_orientacion": "horizontal",
                "image_crop_mode": "cover",
                "image_focus_x": "0.50",
                "image_focus_y": "0.30",
                "image_zoom": "1.05",
                "image_focus_confidence": "78",
                "image_focus_source": "ticketera_auto_v1",
                "activo": "true",
            }
        )

        eventos_boleterias_rows.append(
            {
                "evento_id": event_id_seq,
                "source": SOURCE_NAME,
                "source_event_id": source_event_id,
                "url_evento": event_url,
                "logo_key": SOURCE_NAME,
                "prioridad": "30",
                "activo": "true",
            }
        )

        venue_id_by_key: Dict[Tuple[int, str, str], int] = {}
        for v in venues_map.values():
            evento_municipio_id_seq += 1
            vkey = (int(v["municipio_id"]), normalize_text(v["lugar"]), normalize_text(v["direccion"]))
            venue_id_by_key[vkey] = evento_municipio_id_seq
            eventos_municipios_rows.append(
                {
                    "id": evento_municipio_id_seq,
                    "event_id": event_id_seq,
                    "source": SOURCE_NAME,
                    "source_event_id": source_event_id,
                    "municipio_id": v["municipio_id"],
                    "lugar": v["lugar"],
                    "localidad_key": f"{int(v['municipio_id'])}|{normalize_text(v['lugar'])}",
                    "direccion": v["direccion"],
                    "enlaceboletos": event_url,
                }
            )

        seen_occ = set()
        for occ in sorted(occurrences, key=lambda x: (x["fecha"], x["hora"])):
            key = (
                occ["fecha"],
                occ["hora"],
                int(occ["municipio_id"]),
                normalize_text(occ["lugar"]),
                normalize_text(occ["direccion"]),
            )
            if key in seen_occ:
                continue
            seen_occ.add(key)
            vkey = (int(occ["municipio_id"]), normalize_text(occ["lugar"]), normalize_text(occ["direccion"]))
            evento_municipio_id = venue_id_by_key.get(vkey)
            if not evento_municipio_id:
                continue
            evento_fecha_id_seq += 1
            evento_fechas_rows.append(
                {
                    "id": evento_fecha_id_seq,
                    "evento_municipio_id": evento_municipio_id,
                    "source": SOURCE_NAME,
                    "fecha": occ["fecha"],
                    "horainicio": occ["hora"],
                    "mismahora": "false",
                }
            )

        auditoria_rows.append(
            {
                "evento_id_temp": event_id_seq,
                "source_event_id": source_event_id,
                "url": event_url,
                "nombre_final": nombre,
                "categoria_origen_boleteria": keywords,
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
            }
        )

        if idx % 10 == 0:
            print(f"[INFO] Procesados {idx}/{len(listing_entries)} eventos de Ticketera...")
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
