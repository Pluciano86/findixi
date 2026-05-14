#!/usr/bin/env python3
"""
Scraper aislado para PRticket.

Reglas implementadas:
- Entrada: https://boletos.prticket.com/events/en/frontpage
- Visita cada URL de evento detectada en frontpage.
- Exporta solo eventos con fecha y hora concretas.
- Salidas exclusivas en exports/prticket/.
- Mapea municipio_id contra la tabla Municipios de Supabase.
- Mapea categoria contra categoriaEventos; crea SQL para categorías nuevas.
"""

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
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


FRONTPAGE_URL = "https://boletos.prticket.com/events/en/frontpage"
BASE_EVENTS_URL = "https://boletos.prticket.com/events/en/"
REQUEST_TIMEOUT = 35
REQUEST_SLEEP_SECONDS = 0.2
SOURCE_NAME = "prticket"

EVENTOS_CSV = "eventos_prticket.csv"
EVENTOS_MUNICIPIOS_CSV = "eventos_municipios_prticket.csv"
EVENTO_FECHAS_CSV = "eventoFechas_prticket.csv"
EVENTOS_BOLETERIAS_CSV = "eventos_boleterias_prticket.csv"
NO_DATED_CSV = "no_dated_items_prticket.csv"
CATEGORIAS_SQL = "categoriaEventos_nuevas_insert.sql"
AUDITORIA_CSV = "auditoria_eventos_prticket.csv"

RESERVED_SLUGS = {
    "frontpage",
    "comprarevento",
    "registrousuario",
    "contactaconnosotros",
    "cookiepolicy",
    "privacypolicy",
    "packages",
    "outofstock",
    "entrada",
    "survey",
    "productaddedtocart",
    "invitationsdetails",
    "transfertickets",
    "search",
}

MONTHS_ES = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "setiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}

MONTHS_EN = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

# Ajustes automáticos de encuadre para artes de PRticket en cards horizontales.
# Valores: x/y en 0..1, zoom en 1..1.4
PRTICKET_IMAGE_PRESENTATION_OVERRIDES = {
    "asalto": {"x": 0.50, "y": 0.22, "zoom": 1.07},
    "cumbredeexportacionesparapymes": {"x": 0.43, "y": 0.32, "zoom": 1.05},
    "best-jevas": {"x": 0.50, "y": 0.20, "zoom": 1.08},
    "reynoldalexanderquematoarenemonclova": {"x": 0.52, "y": 0.27, "zoom": 1.06},
}


@dataclass
class Venue:
    municipio_id: Optional[int]
    municipio_nombre: str
    lugar: str
    direccion: str


@dataclass
class SessionOccurrence:
    fecha: str
    hora: str
    municipio_id: Optional[int]
    municipio_nombre: str
    lugar: str
    direccion: str


@dataclass
class EventScraped:
    url: str
    slug: str
    source_event_id: str
    nombre: str
    descripcion: str
    categoria_origen: str
    costo: str
    categoria_raw: str
    imagen: str
    datetimes: List[Tuple[str, str]]
    venues: List[Venue]
    session_occurrences: List[SessionOccurrence]
    motivo_no_exportable: Optional[str] = None


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
    value = re.sub(r"\s+", " ", value or "").strip()
    return value


def sanitize_description(value: str) -> str:
    # Requisito: si no hay descripción confiable, guardar en blanco.
    cleaned = clean_spaces(value or "")
    return cleaned if cleaned else ""


def build_localidad_key(municipio_id: Optional[int], lugar: str) -> str:
    if not municipio_id or not clean_spaces(lugar):
        return ""
    return f"{int(municipio_id)}|{normalize_text(lugar)}"


def html_to_text(fragment: str) -> str:
    if not fragment:
        return ""
    text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", fragment)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|li|h1|h2|h3|section|article|tr)>", "\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html.unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def split_lines(text: str) -> List[str]:
    return [clean_spaces(line) for line in text.split("\n") if clean_spaces(line)]


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
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
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

    def fetch_json(self, url: str, headers: Dict[str, str]) -> List[dict]:
        text = self.fetch_text(url, extra_headers=headers)
        return json.loads(text or "[]")


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
        return self.http.fetch_json(endpoint, headers=self.headers)

    def get_max_id(self, table: str) -> int:
        rows = self.select(table, "select=id&order=id.desc&limit=1")
        if not rows:
            return 0
        return safe_int(str(rows[0].get("id", 0)), 0)

    def insert_rows(
        self,
        table: str,
        rows: List[dict],
        *,
        returning: bool = True,
        on_conflict: str = "",
    ) -> List[dict]:
        if not rows:
            return []
        query = f"on_conflict={urllib.parse.quote(on_conflict)}" if on_conflict else ""
        endpoint = f"{self.url}/rest/v1/{table}"
        if query:
            endpoint = f"{endpoint}?{query}"
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
            if not raw:
                return []
            return json.loads(raw)


def extract_frontpage_event_urls(frontpage_html: str) -> List[str]:
    hrefs = re.findall(r"""href=["']([^"']+)["']""", frontpage_html, flags=re.I)
    urls: Dict[str, str] = {}
    for href in hrefs:
        absolute = urllib.parse.urljoin(FRONTPAGE_URL, href.strip())
        parsed = urllib.parse.urlparse(absolute)
        if parsed.netloc != "boletos.prticket.com":
            continue
        m = re.match(r"^/events/(?:en|es)/([A-Za-z0-9_-]+)$", parsed.path)
        if not m:
            continue
        slug = m.group(1).strip()
        if not slug:
            continue
        if slug.lower() in RESERVED_SLUGS:
            continue
        urls[slug.lower()] = f"{BASE_EVENTS_URL}{slug}"
    return sorted(urls.values())


def extract_meta_content(page_html: str, attr_name: str, attr_value: str) -> str:
    pattern = (
        rf"""<meta\b[^>]*\b{re.escape(attr_name)}=["']{re.escape(attr_value)}["'][^>]*\bcontent=["']([^"']*)["'][^>]*>"""
    )
    m = re.search(pattern, page_html, flags=re.I)
    if m:
        return clean_spaces(html.unescape(m.group(1)))
    pattern_rev = (
        rf"""<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\b{re.escape(attr_name)}=["']{re.escape(attr_value)}["'][^>]*>"""
    )
    m = re.search(pattern_rev, page_html, flags=re.I)
    if m:
        return clean_spaces(html.unescape(m.group(1)))
    return ""


def extract_section_description_html(page_html: str) -> str:
    m = re.search(
        r"""(?is)<section[^>]*class=["'][^"']*event-description-landing[^"']*["'][^>]*>(.*?)</section>""",
        page_html,
    )
    if not m:
        return ""
    section = m.group(1)
    m2 = re.search(
        r"""(?is)<div[^>]*class=["'][^"']*event-description-landing-col[^"']*["'][^>]*>(.*?)</div>""",
        section,
    )
    return m2.group(1) if m2 else section


def extract_title(page_html: str, description_html: str) -> str:
    m_h1 = re.search(r"(?is)<h1[^>]*>(.*?)</h1>", description_html)
    if m_h1:
        val = clean_spaces(html_to_text(m_h1.group(1)))
        if val:
            return val
    og_title = extract_meta_content(page_html, "property", "og:title")
    if og_title:
        return og_title
    m_title = re.search(r"(?is)<title[^>]*>(.*?)</title>", page_html)
    if m_title:
        return clean_spaces(html_to_text(m_title.group(1)))
    return ""


def clean_event_title(raw_title: str, municipios: List[Tuple[int, str, str]]) -> str:
    title = clean_spaces(raw_title or "")
    if not title:
        return ""

    # Caso común: "Evento @ Lugar"
    if " @ " in title:
        title = clean_spaces(title.split(" @ ", 1)[0])

    venue_tokens = (
        "teatro",
        "arena",
        "coliseo",
        "estadio",
        "cancha",
        "cafe",
        "café",
        "centro",
        "sala",
        "club",
    )
    separators = (" | ", " - ", " – ", " — ")
    for sep in separators:
        if sep not in title:
            continue
        left, right = title.split(sep, 1)
        left = clean_spaces(left)
        right = clean_spaces(right)
        if not left or not right:
            continue
        right_norm = normalize_text(right)
        is_multiple_locations = (
            "multiple location" in right_norm
            or "multiple locations" in right_norm
            or "varias localidades" in right_norm
            or "varias locaciones" in right_norm
            or "multiples localidades" in right_norm
        )
        has_municipio = any(f" {mn} " in f" {right_norm} " for _, _, mn in municipios)
        has_venue_word = any(token in right_norm for token in venue_tokens)
        is_matchup = bool(re.search(r"\bvs\.?\b|\bv\.\b", right_norm, flags=re.I))
        if is_multiple_locations:
            title = left
            break
        if not is_matchup and len(right) <= 55 and (has_municipio or has_venue_word):
            title = left
            break

    return clean_spaces(title)


def extract_data_layer(page_html: str) -> dict:
    m = re.search(r"(?is)var\s+dataLayerP4\s*=\s*(\{.*?\});", page_html)
    if not m:
        return {}
    raw = m.group(1).strip()
    try:
        return json.loads(raw)
    except Exception:
        return {}


def extract_category_raw(page_html: str, data_layer: dict) -> str:
    if isinstance(data_layer, dict):
        val = clean_spaces(str(data_layer.get("category", "")))
        if val:
            return val
        impressions = data_layer.get("impressions") or []
        if impressions and isinstance(impressions[0], dict):
            val2 = clean_spaces(str(impressions[0].get("category", "")))
            if val2:
                return val2
    m_tag = re.search(
        r"""(?is)<span[^>]*class=["'][^"']*tag-event-info-orion[^"']*["'][^>]*>(.*?)</span>""",
        page_html,
    )
    if m_tag:
        val = clean_spaces(html_to_text(m_tag.group(1)))
        if val:
            return val
    return "Otro"


def infer_category_label(raw_category: str, nombre: str, descripcion: str) -> str:
    raw = clean_spaces(raw_category)
    raw_norm = normalize_text(raw)
    generic = {"otro", "otros", "otra", "otras", "other", "others", "general", "n/a", "na"}
    broad_labels = {
        "artes escenicas",
        "artes escénicas",
        "cultura",
        "cultura / teatro",
        "culture",
        "theater",
        "theatre",
        "show",
        "evento",
        "events",
    }
    comedy_keywords = [
        "comedia",
        "comedy",
        "standup",
        "stand up",
        "stand-up",
        "humor",
        "impro",
        "improv",
        "monologo",
        "monólogo",
        "comediante",
        "risas",
        "parodia",
        "sketch",
    ]
    if raw and raw_norm not in generic:
        text_with_raw = normalize_text(" ".join([nombre or "", descripcion or "", raw or ""]))
        # Regla de negocio: si es claramente comedia, priorizar Comedia
        # por encima de etiquetas amplias como Artes Escénicas/Cultura.
        if any(normalize_text(k) in text_with_raw for k in comedy_keywords):
            if raw_norm in broad_labels:
                return "Comedia"
        return raw

    text = normalize_text(" ".join([nombre or "", descripcion or "", raw or ""]))
    if not text:
        return "Otros"

    keyword_to_label = [
        (["gaming", "esport", "videojuego", "video juego", "game jam", "torneo gamer"], "Gaming"),
        (["fair", "feria", "expo", "convencion", "convención", "comic con"], "Ferias"),
        (["comedy", "comedia", "standup", "stand up"], "Comedia"),
        (["sports", "deporte", "deportivo", "bsn", "baloncesto", "basket", "futbol", "fútbol", "baseball"], "Deportes"),
        (["concert", "concierto", "musica", "música", "music"], "Conciertos"),
        (["culture", "cultura", "theater", "theatre", "teatro", "musical", "artes escenicas"], "Cultura / Teatro"),
        (["food", "gastronomic", "gastronomico", "gastronomico", "culinary", "brunch"], "Gastronomía"),
        (["horror", "terror"], "Terror"),
        (["family", "familiar", "kids", "ninos", "niños"], "Familiar"),
    ]
    for keywords, label in keyword_to_label:
        if any(normalize_text(k) in text for k in keywords):
            return label
    return "Otros"


def extract_image_url(page_html: str, page_url: str) -> str:
    def to_abs(url: str) -> str:
        return urllib.parse.urljoin(page_url, clean_spaces(url))

    def extract_image_candidates(html_text: str) -> List[str]:
        candidates: List[str] = []
        patterns = [
            r"""(?is)\bsrcset=["']([^"']+)["']""",
            r"""(?is)\bsrc=["']([^"']+)["']""",
            r"""(?is)\bdata-src=["']([^"']+)["']""",
            r"""(?is)\bdata-original=["']([^"']+)["']""",
        ]
        for pattern in patterns:
            for raw in re.findall(pattern, html_text):
                val = clean_spaces(raw)
                if not val:
                    continue
                # srcset puede traer varias opciones separadas por coma.
                first = val.split(",")[0].strip().split(" ")[0].strip()
                if first:
                    candidates.append(first)
        return candidates

    def normalize_horizontal_candidate(url: str) -> str:
        if not url:
            return ""
        # PRticket suele publicar poster vertical y banner horizontal en la misma carpeta.
        url = re.sub(r"/(?:xs|s|m)_poster\.(?:jpg|jpeg|png|webp)$", "/m_banner.jpg", url, flags=re.I)
        url = re.sub(r"_poster\.(jpg|jpeg|png|webp)$", "_banner.jpg", url, flags=re.I)
        return url

    def score_image_url(url: str) -> int:
        text = (url or "").lower()
        if not text:
            return -999
        score = 0
        if "img_web" in text:
            score += 15
        if "banner" in text:
            score += 80
        if "cover" in text or "landscape" in text:
            score += 40
        if "m_banner" in text:
            score += 35
        if "s_banner" in text:
            score += 20
        if "poster" in text:
            score -= 90
        if "logo" in text or "icon" in text:
            score -= 120
        return score

    # 1) Buscar el bloque de banner principal del evento.
    banner_block = re.search(
        r"""(?is)<div[^>]*class=["'][^"']*orion-img-banner-no-parallax[^"']*["'][^>]*>(.*?)</div>""",
        page_html,
    )
    if banner_block:
        raw_candidates = extract_image_candidates(banner_block.group(1))
        if raw_candidates:
            abs_candidates = [to_abs(normalize_horizontal_candidate(c)) for c in raw_candidates]
            abs_candidates.sort(key=score_image_url, reverse=True)
            if abs_candidates and score_image_url(abs_candidates[0]) > -200:
                return abs_candidates[0]

    # 2) Fallback: cualquier candidato de imagen en todo el HTML con scoring.
    all_candidates_raw = extract_image_candidates(page_html)
    if all_candidates_raw:
        all_candidates = [to_abs(normalize_horizontal_candidate(c)) for c in all_candidates_raw]
        all_candidates.sort(key=score_image_url, reverse=True)
        if all_candidates and score_image_url(all_candidates[0]) > -200:
            return all_candidates[0]

    # 3) Fallback final: og:image (si viene poster, lo convertimos a banner).
    og_image = extract_meta_content(page_html, "property", "og:image")
    if og_image:
        return to_abs(normalize_horizontal_candidate(og_image))

    m_picture_img = re.search(
        r"""(?is)<picture[^>]*>.*?<img[^>]*\bsrc=["']([^"']+)["'][^>]*>.*?</picture>""",
        page_html,
    )
    if m_picture_img:
        return to_abs(normalize_horizontal_candidate(m_picture_img.group(1)))

    m_any_img = re.search(r"""(?is)<img[^>]*\bsrc=["']([^"']+)["'][^>]*>""", page_html)
    if m_any_img:
        return to_abs(normalize_horizontal_candidate(m_any_img.group(1)))
    return ""


def detect_image_orientation(image_url: str) -> str:
    text = (image_url or "").lower()
    if not text:
        return "unknown"
    horizontal_markers = ("banner", "cover", "landscape", "1200x630", "16x9", "16_9")
    vertical_markers = ("poster", "flyer", "portrait", "560x700", "4x5", "3x4")
    if any(marker in text for marker in horizontal_markers):
        return "horizontal"
    if any(marker in text for marker in vertical_markers):
        return "vertical"
    return "unknown"


def infer_prticket_image_presentation(
    source_event_id: str,
    event_name: str,
    image_url: str,
    orientation: str,
) -> Dict[str, object]:
    source_key = clean_spaces(source_event_id).lower()
    image_lower = (image_url or "").lower()
    event_norm = normalize_text(event_name or "")

    presentation: Dict[str, object] = {
        "image_crop_mode": "cover",
        "image_focus_x": 0.50,
        "image_focus_y": 0.26,
        "image_zoom": 1.08,
        "image_focus_confidence": 72,
        "image_focus_source": "prticket_auto_v1",
    }

    # Si no parece banner horizontal, evitar recortes agresivos.
    if orientation in {"vertical", "unknown"} and "banner" not in image_lower:
        presentation.update(
            {
                "image_crop_mode": "contain_blur",
                "image_focus_x": 0.50,
                "image_focus_y": 0.50,
                "image_zoom": 1.00,
                "image_focus_confidence": 88,
                "image_focus_source": "prticket_auto_v1_contain",
            }
        )

    # Reglas por patrones de nombre para proteger texto principal superior.
    if any(token in event_norm for token in ("jevas", "comedia", "teatro breve", "impro")):
        presentation["image_focus_y"] = min(float(presentation["image_focus_y"]), 0.24)
        presentation["image_zoom"] = max(float(presentation["image_zoom"]), 1.08)

    # Overrides específicos por source_event_id.
    override = PRTICKET_IMAGE_PRESENTATION_OVERRIDES.get(source_key)
    if override:
        presentation.update(
            {
                "image_crop_mode": "cover",
                "image_focus_x": float(override["x"]),
                "image_focus_y": float(override["y"]),
                "image_zoom": float(override["zoom"]),
                "image_focus_confidence": 96,
                "image_focus_source": "prticket_override_v1",
            }
        )

    return presentation


def parse_date_candidates(text: str) -> List[str]:
    out: List[str] = []
    normalized = normalize_text(text)

    for y, mo, d in re.findall(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", normalized):
        yy, mm, dd = safe_int(y), safe_int(mo), safe_int(d)
        if 1900 <= yy <= 2100 and 1 <= mm <= 12 and 1 <= dd <= 31:
            out.append(f"{yy:04d}-{mm:02d}-{dd:02d}")

    for d, mo, y in re.findall(r"\b(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})\b", normalized):
        dd = safe_int(d)
        yy = safe_int(y)
        mm = MONTHS_ES.get(mo)
        if mm and 1900 <= yy <= 2100 and 1 <= dd <= 31:
            out.append(f"{yy:04d}-{mm:02d}-{dd:02d}")

    for mo, d, y in re.findall(r"\b(?:[a-z]+,\s+)?([a-z]+)\s+(\d{1,2}),\s*(\d{4})\b", normalized):
        dd = safe_int(d)
        yy = safe_int(y)
        mm = MONTHS_EN.get(mo)
        if mm and 1900 <= yy <= 2100 and 1 <= dd <= 31:
            out.append(f"{yy:04d}-{mm:02d}-{dd:02d}")

    for d, mo, y in re.findall(r"\b(\d{1,2})/(\d{1,2})/(\d{2,4})\b", normalized):
        dd = safe_int(d)
        mm = safe_int(mo)
        yy = safe_int(y)
        if yy < 100:
            yy += 2000
        if 1900 <= yy <= 2100 and 1 <= mm <= 12 and 1 <= dd <= 31:
            out.append(f"{yy:04d}-{mm:02d}-{dd:02d}")

    seen = set()
    unique = []
    for val in out:
        if val not in seen:
            seen.add(val)
            unique.append(val)
    return unique


def parse_time_candidates(text: str) -> List[str]:
    out: List[str] = []
    normalized = text.replace("\u202f", " ").replace("\xa0", " ")

    for h, m, ampm in re.findall(r"\b(\d{1,2}):(\d{2})\s*([AaPp]\.?\s*[Mm]\.?)?\b", normalized):
        hh = safe_int(h)
        mm = safe_int(m)
        if mm < 0 or mm > 59:
            continue
        ap = normalize_text(ampm).replace(" ", "") if ampm else ""
        if ap in {"am", "a m"}:
            if hh == 12:
                hh = 0
            elif not (1 <= hh <= 11):
                continue
        elif ap in {"pm", "p m"}:
            if hh == 12:
                hh = 12
            elif 1 <= hh <= 11:
                hh += 12
            else:
                continue
        else:
            if not (0 <= hh <= 23):
                continue
        out.append(f"{hh:02d}:{mm:02d}")

    for h, ampm in re.findall(r"\b(\d{1,2})\s*([AaPp]\.?\s*[Mm]\.?)\b", normalized):
        hh = safe_int(h)
        ap = normalize_text(ampm).replace(" ", "")
        if not (1 <= hh <= 12):
            continue
        if ap == "am":
            hh = 0 if hh == 12 else hh
        else:
            hh = 12 if hh == 12 else hh + 12
        out.append(f"{hh:02d}:00")

    seen = set()
    unique = []
    for val in out:
        if val not in seen:
            seen.add(val)
            unique.append(val)
    return unique


def extract_event_id(data_layer: dict) -> str:
    if not isinstance(data_layer, dict):
        return ""
    return clean_spaces(str(data_layer.get("eventId", "")))


def extract_sessions_from_purchase_page(
    http: SimpleHttp,
    event_id: str,
    municipios: List[Tuple[int, str, str]],
) -> List[SessionOccurrence]:
    if not event_id:
        return []

    buy_url = f"https://boletos.prticket.com/events/en/comprarEvento?idEvento={urllib.parse.quote(event_id)}"
    try:
        html_buy = http.fetch_text(buy_url)
    except Exception:
        return []

    m = re.search(r"""(?is)var\s+arraySesiones\s*=\s*(\[[\s\S]*?\]);""", html_buy)
    if not m:
        return []

    raw_json = m.group(1).strip()
    try:
        sessions = json.loads(raw_json)
    except Exception:
        return []

    m_dir = re.search(r"""(?is)var\s+direccionRecinto\s*=\s*(['"])(.*?)\1\s*;""", html_buy)
    direccion_recinto = clean_spaces(html.unescape(m_dir.group(2))) if m_dir else ""

    buy_data_layer = {}
    m_dl = re.search(r"""(?is)var\s+dataLayerP4\s*=\s*(\{.*?\});""", html_buy)
    if m_dl:
        try:
            buy_data_layer = json.loads(m_dl.group(1))
        except Exception:
            buy_data_layer = {}
    buy_venue = clean_spaces(str(buy_data_layer.get("venue", ""))) if isinstance(buy_data_layer, dict) else ""
    buy_city = clean_spaces(str(buy_data_layer.get("venueCity", ""))) if isinstance(buy_data_layer, dict) else ""
    buy_state = clean_spaces(str(buy_data_layer.get("venueState", ""))) if isinstance(buy_data_layer, dict) else ""
    buy_context = " | ".join([buy_venue, buy_city, buy_state, direccion_recinto])
    if has_explicit_non_pr_marker(buy_context):
        return []

    occurrences: List[SessionOccurrence] = []
    for item in sessions if isinstance(sessions, list) else []:
        if not isinstance(item, dict):
            continue

        fecha_celebracion = clean_spaces(str(item.get("fechaCelebracionStr", "")))
        if not fecha_celebracion or "T" not in fecha_celebracion:
            continue
        fecha = fecha_celebracion.split("T", 1)[0]
        hora = fecha_celebracion.split("T", 1)[1][:5]
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", fecha):
            continue
        if not re.match(r"^\d{2}:\d{2}$", hora):
            continue

        lit_sesion = clean_spaces(str(item.get("litSesion", "")))
        lit_sala = clean_spaces(str(item.get("litSala", "")))
        promo = clean_spaces(str(item.get("promotionalSessionLabel", ""))).lstrip("@").strip()

        lit_sesion_norm = normalize_text(lit_sesion)
        lit_sesion_usable = lit_sesion
        # Evitar falsos positivos en deportes: "Cangrejeros vs Piratas" no indica municipio real.
        if re.search(r"\bvs\.?\b|\bv\.\b", lit_sesion_norm, flags=re.I):
            if "@" not in lit_sesion and "-" not in lit_sesion and "," not in lit_sesion:
                lit_sesion_usable = ""

        search_text_primary = " | ".join(part for part in [promo, lit_sala, lit_sesion_usable] if part)
        if has_explicit_non_pr_marker(search_text_primary):
            continue
        municipio_id, municipio_nombre = detect_municipio_id(search_text_primary, municipios)
        if not municipio_id:
            search_text_fallback = " | ".join(part for part in [direccion_recinto, buy_city, buy_state, buy_venue] if part)
            if has_explicit_non_pr_marker(search_text_fallback):
                continue
            municipio_id, municipio_nombre = detect_municipio_id(search_text_fallback, municipios)

        lugar = promo or buy_venue or lit_sala
        if not lugar:
            # fallback: intentar extraer texto después de "-" en litSesion
            m_lugar = re.search(r"-\s*([^-\n\r]+)$", lit_sesion)
            if m_lugar:
                lugar = clean_spaces(m_lugar.group(1))
        if not lugar and municipio_nombre:
            lugar = municipio_nombre

        if municipio_nombre and lugar and normalize_text(municipio_nombre) not in normalize_text(lugar):
            direccion = clean_spaces(f"{municipio_nombre} @ {lugar}")
        else:
            direccion = direccion_recinto or lugar or municipio_nombre or ""

        occurrences.append(
            SessionOccurrence(
                fecha=fecha,
                hora=hora,
                municipio_id=municipio_id,
                municipio_nombre=municipio_nombre,
                lugar=lugar or (municipio_nombre or "Multiple Locations"),
                direccion=direccion or (lugar or "Multiple Locations"),
            )
        )

    # Deduplicar preservando orden.
    unique: List[SessionOccurrence] = []
    seen = set()
    for occ in occurrences:
        key = (
            occ.fecha,
            occ.hora,
            int(occ.municipio_id) if occ.municipio_id else 0,
            normalize_text(occ.lugar),
            normalize_text(occ.direccion),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(occ)
    return unique


def pair_dates_times(dates: List[str], times_: List[str]) -> List[Tuple[str, str]]:
    if not dates or not times_:
        return []
    if len(dates) == len(times_):
        return list(zip(dates, times_))
    if len(dates) > 1 and len(times_) == 1:
        return [(d, times_[0]) for d in dates]
    if len(dates) == 1 and len(times_) > 1:
        return [(dates[0], t) for t in times_]
    pairs = []
    min_len = min(len(dates), len(times_))
    for i in range(min_len):
        pairs.append((dates[i], times_[i]))
    return pairs


def summarize_price(description_text: str, page_html: str) -> str:
    lines = split_lines(description_text)
    lines_with_price = [ln for ln in lines if "$" in ln]
    amounts = re.findall(r"\$\s*\d[\d,]*(?:\.\d{2})?", " ".join(lines_with_price))

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

    m_price = re.search(r"""(?is)<span[^>]*class=["'][^"']*price-text[^"']*["'][^>]*>(.*?)</span>""", page_html)
    if m_price:
        return clean_spaces(html_to_text(m_price.group(1)))

    return ""


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


def infer_venues(
    lines: List[str],
    data_layer: dict,
    municipios: List[Tuple[int, str, str]],
) -> List[Venue]:
    candidates: List[str] = []

    ignored_prefixes = (
        "precios",
        "precio",
        "para mas informacion",
        "para más información",
        "for more information",
        "boletos",
        "tickets",
    )
    venue_keywords = (
        "teatro",
        "coliseo",
        "coliseito",
        "estadio",
        "centro",
        "plaza",
        "anfiteatro",
        "cancha",
        "auditorio",
        "cafe",
        "café",
        "arena",
        "club",
        "hotel",
        "parque",
        "sala",
    )

    for line in lines:
        ln = clean_spaces(line)
        if not ln:
            continue
        if "$" in ln:
            continue
        if len(ln) > 140:
            continue
        if len(ln.split()) > 14:
            continue
        if parse_date_candidates(ln):
            continue
        if parse_time_candidates(ln):
            continue
        ln_norm = normalize_text(ln)
        if ln_norm.startswith(ignored_prefixes):
            continue

        contains_municipio = any(f" {nombre_norm} " in f" {ln_norm} " for _, _, nombre_norm in municipios)
        contains_venue_keyword = any(keyword in ln_norm for keyword in venue_keywords)
        starts_like_venue = ln_norm.startswith(venue_keywords)
        has_pin_marker = "📍" in ln

        if contains_municipio and (starts_like_venue or contains_venue_keyword or has_pin_marker):
            candidates.append(ln)

    # Solo usar fallback de dataLayer si no hubo candidatos explícitos.
    if isinstance(data_layer, dict):
        venue = clean_spaces(str(data_layer.get("venue", "")))
        city = clean_spaces(str(data_layer.get("venueCity", "")))
        state = clean_spaces(str(data_layer.get("venueState", "")))
        if not candidates:
            pieces = [p for p in [venue, city, state] if p]
            if pieces:
                fallback = ", ".join(pieces)
                candidates.append(fallback)

    unique_candidates: List[str] = []
    seen = set()
    for cand in candidates:
        key = normalize_text(cand)
        if key and key not in seen:
            seen.add(key)
            unique_candidates.append(cand)

    venues: List[Venue] = []
    for cand in unique_candidates:
        if has_explicit_non_pr_marker(cand):
            continue
        municipio_id, municipio_nombre = detect_municipio_id(cand, municipios)
        stripped = re.sub(r"^[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]+", "", cand).strip()
        lugar = clean_spaces(stripped.split(",")[0] if "," in stripped else stripped)
        direccion = clean_spaces(stripped)
        venues.append(
            Venue(
                municipio_id=municipio_id,
                municipio_nombre=municipio_nombre,
                lugar=lugar,
                direccion=direccion,
            )
        )

    # Priorizar venues con municipio reconocido.
    with_municipio = [v for v in venues if v.municipio_id]
    if with_municipio:
        # Evitar duplicados exactos.
        unique: Dict[Tuple[int, str, str], Venue] = {}
        for v in with_municipio:
            key = (int(v.municipio_id), normalize_text(v.lugar), normalize_text(v.direccion))
            unique[key] = v
        return list(unique.values())

    # Fallback final con dataLayer para intentar resolver municipio.
    if isinstance(data_layer, dict):
        venue = clean_spaces(str(data_layer.get("venue", "")))
        city = clean_spaces(str(data_layer.get("venueCity", "")))
        state = clean_spaces(str(data_layer.get("venueState", "")))
        fallback_text = clean_spaces(", ".join([p for p in [venue, city, state] if p]))
        if fallback_text:
            if has_explicit_non_pr_marker(fallback_text):
                return []
            municipio_id, municipio_nombre = detect_municipio_id(fallback_text, municipios)
            if municipio_id:
                return [
                    Venue(
                        municipio_id=municipio_id,
                        municipio_nombre=municipio_nombre,
                        lugar=venue or city or fallback_text,
                        direccion=fallback_text,
                    )
                ]

    return venues[:1] if venues else []


def map_category_id(
    raw_category: str,
    nombre_evento: str,
    descripcion_evento: str,
    categories_existing: List[dict],
    new_categories: Dict[str, int],
    next_category_id: int,
) -> Tuple[int, int]:
    existing_by_norm = {normalize_text(str(row.get("nombre", ""))): int(row.get("id")) for row in categories_existing}

    mapping_keywords = [
        (1, ["concert", "concierto", "musica", "music"]),
        (2, ["festival"]),
        (3, ["sports", "deporte", "deportivo", "basket", "baseball", "futbol", "football", "mma", "boxing", "pickleball", "voleibol", "volleyball"]),
        (4, ["fair", "feria", "expo"]),
        (5, ["family", "familiar", "kids", "ninos", "niños"]),
        (6, ["party", "nightclub", "discoteca", "perreo", "club", "bailable"]),
        (7, ["culture", "cultura", "theater", "theatre", "teatro", "musical", "artes escenicas", "magia"]),
        (8, ["food", "gastronomic", "gastronomico", "gastronómico", "rum", "culinary"]),
        (10, ["comedy", "comedia", "standup", "stand up"]),
        (12, ["horror", "terror"]),
        (0, ["gaming", "gamer", "esport", "e-sport"]),
        (9, ["other", "otro"]),
    ]

    # Respeta IDs existentes si están en DB.
    valid_existing_ids = {int(row.get("id")) for row in categories_existing if row.get("id") is not None}
    existing_other_ids = [
        int(row.get("id"))
        for row in categories_existing
        if normalize_text(str(row.get("nombre", ""))) in {"otro", "otros", "otra", "otras", "other", "others"}
        and row.get("id") is not None
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
                # Fallback por nombre en DB
                for norm_name, db_id in existing_by_norm.items():
                    if any(normalize_text(keyword) in norm_name for keyword in keywords):
                        return db_id, next_category_id

        if raw in new_categories:
            return new_categories[raw], next_category_id

        # Crear categoría nueva si no existe (excepto "otros"/"other")
        if raw not in {"otro", "otros", "other", "others"}:
            assigned = next_category_id
            new_categories[raw] = assigned
            return assigned, assigned + 1

    if existing_other_ids:
        return existing_other_ids[0], next_category_id
    if 9 in valid_existing_ids:
        return 9, next_category_id

    if "otros" in new_categories:
        return new_categories["otros"], next_category_id
    assigned = next_category_id
    new_categories["otros"] = assigned
    return assigned, assigned + 1


def scrape_event(
    http: SimpleHttp,
    event_url: str,
    municipios: List[Tuple[int, str, str]],
) -> EventScraped:
    page_html = http.fetch_text(event_url)
    slug = event_url.rstrip("/").split("/")[-1]
    source_event_id = slug
    data_layer = extract_data_layer(page_html)
    description_html = extract_section_description_html(page_html)
    # Importante: conservar saltos de línea para detectar venues/fechas por renglón.
    description_text_raw = html_to_text(description_html)
    description_text = sanitize_description(description_text_raw)
    description_lines = split_lines(description_text_raw)

    nombre = extract_title(page_html, description_html)
    if not nombre and isinstance(data_layer, dict):
        nombre = clean_spaces(str(data_layer.get("eventName", "")))
    if not nombre:
        nombre = slug
    nombre = clean_event_title(nombre, municipios) or nombre
    if isinstance(data_layer, dict):
        dl_name = clean_event_title(clean_spaces(str(data_layer.get("eventName", ""))), municipios)
        # Si el H1 quedó vacío/ruidoso, usar eventName limpio de dataLayer.
        if dl_name and (not nombre or len(nombre) < 3):
            nombre = dl_name

    categoria_origen = extract_category_raw(page_html, data_layer)
    categoria_raw = infer_category_label(categoria_origen, nombre, description_text)
    imagen = extract_image_url(page_html, event_url)
    costo = summarize_price(description_text, page_html)
    event_id = extract_event_id(data_layer)

    session_occurrences = extract_sessions_from_purchase_page(
        http=http,
        event_id=event_id,
        municipios=municipios,
    )

    dates: List[str] = []
    times_: List[str] = []
    for line in description_lines:
        dates.extend(parse_date_candidates(line))
        times_.extend(parse_time_candidates(line))

    if not dates:
        dates = parse_date_candidates(description_text)
    if not times_:
        times_ = parse_time_candidates(description_text)

    # Deduplicar manteniendo orden.
    dates = list(dict.fromkeys(dates))
    times_ = list(dict.fromkeys(times_))
    datetimes = pair_dates_times(dates, times_)
    venues = infer_venues(description_lines, data_layer, municipios)

    if session_occurrences:
        datetimes = [(occ.fecha, occ.hora) for occ in session_occurrences]
        venues_from_sessions: List[Venue] = []
        seen_venues = set()
        has_municipio_from_sessions = False
        for occ in session_occurrences:
            key = (
                int(occ.municipio_id) if occ.municipio_id else 0,
                normalize_text(occ.lugar),
                normalize_text(occ.direccion),
            )
            if key in seen_venues:
                continue
            seen_venues.add(key)
            if occ.municipio_id:
                has_municipio_from_sessions = True
            venues_from_sessions.append(
                Venue(
                    municipio_id=occ.municipio_id,
                    municipio_nombre=occ.municipio_nombre,
                    lugar=occ.lugar,
                    direccion=occ.direccion,
                )
            )
        # Solo reemplazar venues si las sesiones lograron mapear al menos un municipio.
        if venues_from_sessions and has_municipio_from_sessions:
            venues = venues_from_sessions

    if not datetimes:
        return EventScraped(
            url=event_url,
            slug=slug,
            source_event_id=source_event_id,
            nombre=nombre,
            descripcion=description_text,
            categoria_origen=categoria_origen,
            costo=costo,
            categoria_raw=categoria_raw,
            imagen=imagen,
            datetimes=[],
            venues=venues,
            session_occurrences=session_occurrences,
            motivo_no_exportable="Sin fecha/hora concreta detectada",
        )

    return EventScraped(
        url=event_url,
        slug=slug,
        source_event_id=source_event_id,
        nombre=nombre,
        descripcion=description_text,
        categoria_origen=categoria_origen,
        costo=costo,
        categoria_raw=categoria_raw,
        imagen=imagen,
        datetimes=datetimes,
        venues=venues,
        session_occurrences=session_occurrences,
    )


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
    parts = [word.capitalize() for word in norm_name.split()]
    return " ".join(parts)


def resolve_category_name(
    category_id: int,
    categories_existing: List[dict],
    new_categories: Dict[str, int],
) -> str:
    if not category_id:
        return ""
    for row in categories_existing:
        rid = safe_int(str(row.get("id", 0)), 0)
        if rid == int(category_id):
            return clean_spaces(str(row.get("nombre", "")))
    for norm_name, cid in new_categories.items():
        if int(cid) == int(category_id):
            return display_name_from_norm(norm_name)
    return ""


def write_category_sql(path: Path, categories_new: Dict[str, int]) -> int:
    # categories_new: normalized_name -> id
    if not categories_new:
        path.write_text("", encoding="utf-8")
        return 0

    reverse = sorted(((cid, norm_name) for norm_name, cid in categories_new.items()), key=lambda x: x[0])
    lines = []
    for cid, norm_name in reverse:
        # Reconstrucción presentable del nombre.
        readable_name = display_name_from_norm(norm_name)
        readable_name = readable_name.replace(" / ", " / ")
        lines.append(
            f'insert into public."categoriaEventos" (id, nombre) values ({cid}, {json.dumps(readable_name)});'
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(reverse)


def insert_new_categories_direct(
    supabase: SupabaseRest,
    categories_new: Dict[str, int],
) -> int:
    if not categories_new:
        return 0
    rows: List[dict] = []
    for norm_name, cid in sorted(categories_new.items(), key=lambda item: item[1]):
        rows.append({"id": int(cid), "nombre": display_name_from_norm(norm_name)})
    try:
        supabase.insert_rows("categoriaEventos", rows, returning=False)
        return len(rows)
    except Exception as exc:
        print(f"[WARN] No se pudieron crear categorías nuevas automáticamente: {exc}", file=sys.stderr)
        return 0


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current] + list(current.parents):
        if (candidate / "AGENTS.md").exists() and (candidate / "public").exists():
            return candidate
    return start.resolve()


def main() -> int:
    script_path = Path(__file__).resolve()
    repo_root = find_repo_root(script_path.parent)
    export_dir = repo_root / "exports" / "prticket"
    export_dir.mkdir(parents=True, exist_ok=True)

    env = {}
    env.update(load_env_file(repo_root / ".env"))
    env.update(load_env_file(repo_root / ".env.local"))
    env.update(os.environ)

    supabase_url = env.get("SUPABASE_URL", "").strip()
    supabase_key = (env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_ANON_KEY") or "").strip()
    if not supabase_url or not supabase_key:
        print("ERROR: Falta SUPABASE_URL o key (SERVICE_ROLE/ANON) para mapear municipios/categorías.", file=sys.stderr)
        return 1

    http = SimpleHttp()
    supabase = SupabaseRest(http=http, url=supabase_url, key=supabase_key)

    # Cargar equivalentes de tablas base.
    municipios_rows = supabase.select("Municipios", "select=id,nombre&order=nombre.asc")
    municipios = []
    for row in municipios_rows:
        mid = safe_int(str(row.get("id", 0)))
        nombre = clean_spaces(str(row.get("nombre", "")))
        if mid and nombre:
            municipios.append((mid, nombre, normalize_text(nombre)))
    # Orden por largo para capturar primero municipios compuestos.
    municipios.sort(key=lambda item: len(item[2]), reverse=True)

    categorias_existing = supabase.select("categoriaEventos", "select=id,nombre,icono&order=id.asc")

    max_event_id = supabase.get_max_id("eventos")
    max_evento_municipio_id = supabase.get_max_id("eventos_municipios")
    max_evento_fecha_id = supabase.get_max_id("eventoFechas")

    frontpage_html = http.fetch_text(FRONTPAGE_URL)
    event_urls = extract_frontpage_event_urls(frontpage_html)
    if not event_urls:
        print("ERROR: No se detectaron URLs de eventos en frontpage.", file=sys.stderr)
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

    for idx, event_url in enumerate(event_urls, start=1):
        try:
            scraped = scrape_event(http=http, event_url=event_url, municipios=municipios)
        except Exception as exc:
            no_dated_rows.append(
                {
                    "url": event_url,
                    "nombre": event_url.rsplit("/", 1)[-1],
                    "categoria_raw": "",
                    "motivo": f"Error al extraer: {exc}",
                    "descripcion_preview": "",
                }
            )
            continue

        venue_text = " | ".join([v.lugar for v in scraped.venues[:5]])
        non_event_reason = detect_non_event_reason(
            scraped.nombre,
            scraped.descripcion,
            scraped.categoria_origen,
            scraped.categoria_raw,
            venue_text,
        )
        if non_event_reason:
            no_dated_rows.append(
                {
                    "url": scraped.url,
                    "nombre": scraped.nombre,
                    "categoria_raw": scraped.categoria_raw,
                    "motivo": non_event_reason,
                    "descripcion_preview": clean_spaces(scraped.descripcion[:280]),
                }
            )
            continue

        if not scraped.datetimes:
            no_dated_rows.append(
                {
                    "url": scraped.url,
                    "nombre": scraped.nombre,
                    "categoria_raw": scraped.categoria_raw,
                    "motivo": scraped.motivo_no_exportable or "Sin fecha/hora",
                    "descripcion_preview": clean_spaces(scraped.descripcion[:280]),
                }
            )
            continue

        if not scraped.venues:
            no_dated_rows.append(
                {
                    "url": scraped.url,
                    "nombre": scraped.nombre,
                    "categoria_raw": scraped.categoria_raw,
                    "motivo": "Sin venue/municipio detectable",
                    "descripcion_preview": clean_spaces(scraped.descripcion[:280]),
                }
            )
            continue

        category_id, next_new_category_id = map_category_id(
            raw_category=scraped.categoria_raw,
            nombre_evento=scraped.nombre,
            descripcion_evento=scraped.descripcion,
            categories_existing=categorias_existing,
            new_categories=categories_new,
            next_category_id=next_new_category_id,
        )
        category_name = resolve_category_name(category_id, categorias_existing, categories_new)

        venue_primary = scraped.venues[0]
        image_orientation = detect_image_orientation(scraped.imagen)
        presentation = infer_prticket_image_presentation(
            source_event_id=scraped.source_event_id,
            event_name=scraped.nombre,
            image_url=scraped.imagen,
            orientation=image_orientation,
        )
        event_id_seq += 1
        eventos_rows.append(
            {
                "id": event_id_seq,
                "source": SOURCE_NAME,
                "source_event_id": scraped.source_event_id,
                "nombre": scraped.nombre,
                "descripcion": scraped.descripcion,
                "costo": scraped.costo,
                "gratis": "false",
                "lugar": venue_primary.lugar,
                "direccion": venue_primary.direccion,
                "municipio_id": venue_primary.municipio_id or "",
                "categoria": category_id,
                "enlaceboletos": scraped.url,
                "boletos_por_localidad": "false",
                "imagen": scraped.imagen,
                "imagen_orientacion": image_orientation,
                "image_crop_mode": presentation.get("image_crop_mode", "cover"),
                "image_focus_x": presentation.get("image_focus_x", 0.5),
                "image_focus_y": presentation.get("image_focus_y", 0.26),
                "image_zoom": presentation.get("image_zoom", 1.08),
                "image_focus_confidence": presentation.get("image_focus_confidence", 70),
                "image_focus_source": presentation.get("image_focus_source", "prticket_auto_v1"),
                "activo": "true",
            }
        )
        eventos_boleterias_rows.append(
            {
                "evento_id": event_id_seq,
                "source": SOURCE_NAME,
                "source_event_id": scraped.source_event_id,
                "url_evento": scraped.url,
                "logo_key": SOURCE_NAME,
                "prioridad": "10",
                "activo": "true",
            }
        )

        municipios_venues = sorted(
            {
                int(v.municipio_id)
                for v in scraped.venues
                if v.municipio_id
            }
        )
        municipios_sesiones = sorted(
            {
                int(s.municipio_id)
                for s in scraped.session_occurrences
                if s.municipio_id
            }
        )
        auditoria_rows.append(
            {
                "evento_id_temp": event_id_seq,
                "source_event_id": scraped.source_event_id,
                "url": scraped.url,
                "nombre_final": scraped.nombre,
                "categoria_origen_boleteria": scraped.categoria_origen,
                "categoria_inferida_script": scraped.categoria_raw,
                "categoria_final_id": category_id,
                "categoria_final_nombre": category_name,
                "usa_sesiones_compra": "true" if bool(scraped.session_occurrences) else "false",
                "total_sesiones_detectadas": len(scraped.session_occurrences),
                "total_venues_detectadas": len(scraped.venues),
                "municipio_principal_id": venue_primary.municipio_id or "",
                "municipio_principal_nombre": venue_primary.municipio_nombre or "",
                "municipios_detectados_en_venues": "|".join(str(mid) for mid in municipios_venues),
                "municipios_detectados_en_sesiones": "|".join(str(mid) for mid in municipios_sesiones),
                "lugar_principal": venue_primary.lugar,
                "direccion_principal": venue_primary.direccion,
                "total_fechas_finales": len(scraped.datetimes),
                "primera_fecha": scraped.datetimes[0][0] if scraped.datetimes else "",
                "ultima_fecha": scraped.datetimes[-1][0] if scraped.datetimes else "",
            }
        )

        # 1 fila por combinación única evento + venue/municipio.
        venue_rows_for_event: List[Tuple[int, Venue]] = []
        seen_venue_keys = set()
        for venue in scraped.venues:
            if not venue.municipio_id:
                continue
            venue_key = (venue.municipio_id, normalize_text(venue.lugar), normalize_text(venue.direccion))
            if venue_key in seen_venue_keys:
                continue
            seen_venue_keys.add(venue_key)
            evento_municipio_id_seq += 1
            venue_rows_for_event.append((evento_municipio_id_seq, venue))
            eventos_municipios_rows.append(
                {
                    "id": evento_municipio_id_seq,
                    "event_id": event_id_seq,
                    "source": SOURCE_NAME,
                    "source_event_id": scraped.source_event_id,
                    "municipio_id": venue.municipio_id,
                    "lugar": venue.lugar,
                    "localidad_key": build_localidad_key(venue.municipio_id, venue.lugar),
                    "direccion": venue.direccion,
                    "enlaceboletos": scraped.url,
                }
            )

        if not venue_rows_for_event:
            # Si no hay venue mapeable, mover a revisión manual.
            eventos_rows.pop()
            event_id_seq -= 1
            no_dated_rows.append(
                {
                    "url": scraped.url,
                    "nombre": scraped.nombre,
                    "categoria_raw": scraped.categoria_raw,
                    "motivo": "No se pudo mapear municipio_id",
                    "descripcion_preview": clean_spaces(scraped.descripcion[:280]),
                }
            )
            continue

        # Asignación de fechas a evento_municipio_id.
        # Prioridad:
        # 1) Si hay sesiones detalladas (arraySesiones), mapear por venue exacto.
        # 2) Fallback legado: reglas por cantidad.
        if scraped.session_occurrences:
            venue_id_by_key = {}
            for row_id, venue in venue_rows_for_event:
                key = (
                    int(venue.municipio_id) if venue.municipio_id else 0,
                    normalize_text(venue.lugar),
                    normalize_text(venue.direccion),
                )
                venue_id_by_key[key] = row_id

            fallback_venue_id = venue_rows_for_event[0][0]
            for occ in scraped.session_occurrences:
                venue_key = (
                    int(occ.municipio_id) if occ.municipio_id else 0,
                    normalize_text(occ.lugar),
                    normalize_text(occ.direccion),
                )
                evento_municipio_id = venue_id_by_key.get(venue_key, fallback_venue_id)
                evento_fecha_id_seq += 1
                evento_fechas_rows.append(
                    {
                        "id": evento_fecha_id_seq,
                        "evento_municipio_id": evento_municipio_id,
                        "source": SOURCE_NAME,
                        "fecha": occ.fecha,
                        "horainicio": occ.hora,
                        "mismahora": "false",
                    }
                )
        else:
            # Fallback legado para fuentes sin sessions detalladas.
            if len(venue_rows_for_event) == 1:
                assignment = [venue_rows_for_event[0][0] for _ in scraped.datetimes]
            elif len(venue_rows_for_event) == len(scraped.datetimes):
                assignment = [row_id for row_id, _ in venue_rows_for_event]
            else:
                assignment = [venue_rows_for_event[0][0] for _ in scraped.datetimes]

            for (fecha, hora), evento_municipio_id in zip(scraped.datetimes, assignment):
                evento_fecha_id_seq += 1
                evento_fechas_rows.append(
                    {
                        "id": evento_fecha_id_seq,
                        "evento_municipio_id": evento_municipio_id,
                        "source": SOURCE_NAME,
                        "fecha": fecha,
                        "horainicio": hora,
                        "mismahora": "false",
                    }
                )

        if idx % 10 == 0:
            print(f"[INFO] Procesados {idx}/{len(event_urls)} eventos de frontpage...")

        time.sleep(REQUEST_SLEEP_SECONDS)

    eventos_headers = [
        "id",
        "source",
        "source_event_id",
        "nombre",
        "descripcion",
        "costo",
        "gratis",
        "lugar",
        "direccion",
        "municipio_id",
        "categoria",
        "enlaceboletos",
        "boletos_por_localidad",
        "imagen",
        "imagen_orientacion",
        "image_crop_mode",
        "image_focus_x",
        "image_focus_y",
        "image_zoom",
        "image_focus_confidence",
        "image_focus_source",
        "activo",
    ]
    eventos_municipios_headers = [
        "id",
        "event_id",
        "source",
        "source_event_id",
        "municipio_id",
        "lugar",
        "localidad_key",
        "direccion",
        "enlaceboletos",
    ]
    evento_fechas_headers = ["id", "evento_municipio_id", "source", "fecha", "horainicio", "mismahora"]
    eventos_boleterias_headers = [
        "evento_id",
        "source",
        "source_event_id",
        "url_evento",
        "logo_key",
        "prioridad",
        "activo",
    ]
    no_dated_headers = ["url", "nombre", "categoria_raw", "motivo", "descripcion_preview"]
    auditoria_headers = [
        "evento_id_temp",
        "source_event_id",
        "url",
        "nombre_final",
        "categoria_origen_boleteria",
        "categoria_inferida_script",
        "categoria_final_id",
        "categoria_final_nombre",
        "usa_sesiones_compra",
        "total_sesiones_detectadas",
        "total_venues_detectadas",
        "municipio_principal_id",
        "municipio_principal_nombre",
        "municipios_detectados_en_venues",
        "municipios_detectados_en_sesiones",
        "lugar_principal",
        "direccion_principal",
        "total_fechas_finales",
        "primera_fecha",
        "ultima_fecha",
    ]

    write_csv(export_dir / EVENTOS_CSV, eventos_headers, eventos_rows)
    write_csv(export_dir / EVENTOS_MUNICIPIOS_CSV, eventos_municipios_headers, eventos_municipios_rows)
    write_csv(export_dir / EVENTO_FECHAS_CSV, evento_fechas_headers, evento_fechas_rows)
    write_csv(export_dir / EVENTOS_BOLETERIAS_CSV, eventos_boleterias_headers, eventos_boleterias_rows)
    write_csv(export_dir / NO_DATED_CSV, no_dated_headers, no_dated_rows)
    write_csv(export_dir / AUDITORIA_CSV, auditoria_headers, auditoria_rows)
    total_new_categories_inserted = insert_new_categories_direct(supabase, categories_new)
    total_new_categories = write_category_sql(export_dir / CATEGORIAS_SQL, categories_new)

    # Confirmación final requerida.
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
    print(f"Total categorías nuevas insertadas en DB: {total_new_categories_inserted}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
