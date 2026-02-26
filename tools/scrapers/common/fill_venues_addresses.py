#!/usr/bin/env python3
"""
Enriquecedor global de direcciones de venues para CSVs eventos_municipios.

Uso:
  python3 tools/scrapers/common/fill_venues_addresses.py \
    --input exports/prticket/eventos_municipios_prticket.csv \
    --source prticket
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


CACHE_HEADERS = [
    "key",
    "nombre_lugar",
    "municipio_id",
    "direccion",
    "place_id",
    "latitud",
    "longitud",
    "fuente",
    "updated_at",
]

NO_RESUELTOS_HEADERS = [
    "nombre_lugar",
    "municipio_id",
    "fuente_scraper",
    "enlaceboletos",
    "motivo",
]


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current] + list(current.parents):
        if (candidate / "AGENTS.md").exists():
            return candidate
    return start.resolve()


def load_env_file(path: Path) -> Dict[str, str]:
    out: Dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            out[key] = value
    return out


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9\s]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def clean_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def make_key(nombre_lugar: str, municipio_id: str) -> str:
    return f"{normalize_text(nombre_lugar)}|{str(municipio_id).strip()}"


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


class HttpClient:
    def __init__(self) -> None:
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
            )
        }

    def get_json(self, url: str, timeout: int = 30) -> dict:
        req = urllib.request.Request(url=url, headers=self.headers)
        with self.opener.open(req, timeout=timeout) as response:
            data = response.read().decode("utf-8", errors="replace")
            return json.loads(data or "{}")


def read_csv_rows(path: Path) -> Tuple[List[dict], List[str]]:
    if not path.exists():
        return [], []
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        headers = list(reader.fieldnames or [])
    return rows, headers


def write_csv_rows(path: Path, headers: List[str], rows: Iterable[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow({h: row.get(h, "") for h in headers})


def load_cache(cache_path: Path) -> Dict[str, dict]:
    rows, _ = read_csv_rows(cache_path)
    cache: Dict[str, dict] = {}
    for row in rows:
        key = clean_spaces(row.get("key", ""))
        if not key:
            continue
        normalized = {h: clean_spaces(row.get(h, "")) for h in CACHE_HEADERS}
        normalized["key"] = key
        cache[key] = normalized
    return cache


def keep_google_places_cache_only(cache: Dict[str, dict]) -> Dict[str, dict]:
    filtered: Dict[str, dict] = {}
    for key, row in cache.items():
        fuente = clean_spaces(row.get("fuente", "")).lower()
        direccion = clean_spaces(row.get("direccion", ""))
        place_id = clean_spaces(row.get("place_id", ""))
        if fuente == "google_places" and direccion and place_id:
            filtered[key] = row
    return filtered


def save_cache(cache_path: Path, cache: Dict[str, dict]) -> None:
    rows_sorted = [cache[k] for k in sorted(cache.keys())]
    write_csv_rows(cache_path, CACHE_HEADERS, rows_sorted)


def load_no_resueltos(path: Path) -> Dict[str, dict]:
    rows, _ = read_csv_rows(path)
    out: Dict[str, dict] = {}
    for row in rows:
        normalized = {h: clean_spaces(row.get(h, "")) for h in NO_RESUELTOS_HEADERS}
        key = "|".join(normalized.get(h, "") for h in NO_RESUELTOS_HEADERS)
        if key.strip("|"):
            out[key] = normalized
    return out


def save_no_resueltos(path: Path, rows_map: Dict[str, dict]) -> None:
    rows_sorted = list(rows_map.values())
    write_csv_rows(path, NO_RESUELTOS_HEADERS, rows_sorted)


def fetch_municipios_map(http: HttpClient, env: Dict[str, str]) -> Dict[str, str]:
    supabase_url = clean_spaces(env.get("SUPABASE_URL", ""))
    supabase_key = clean_spaces(env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_ANON_KEY") or "")
    if not supabase_url or not supabase_key:
        return {}
    query = "select=id,nombre&order=nombre.asc"
    url = f"{supabase_url.rstrip('/')}/rest/v1/Municipios?{query}"
    req = urllib.request.Request(
        url,
        headers={
            **http.headers,
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Accept": "application/json",
        },
    )
    try:
        with http.opener.open(req, timeout=30) as response:
            data = response.read().decode("utf-8", errors="replace")
            rows = json.loads(data or "[]")
    except Exception:
        return {}
    mapping: Dict[str, str] = {}
    for row in rows or []:
        mid = clean_spaces(str(row.get("id", "")))
        nombre = clean_spaces(str(row.get("nombre", "")))
        if mid and nombre:
            mapping[mid] = nombre
    return mapping


def remove_place_from_address(nombre_lugar: str, direccion: str) -> str:
    direccion = clean_spaces(direccion)
    if not direccion:
        return ""
    nombre_norm = normalize_text(nombre_lugar)
    parts = [clean_spaces(p) for p in direccion.split(",") if clean_spaces(p)]
    if not parts:
        return ""
    first_norm = normalize_text(parts[0])
    if first_norm and (first_norm == nombre_norm or first_norm in nombre_norm or nombre_norm in first_norm):
        parts = parts[1:]
    cleaned = ", ".join(parts).strip(" ,")
    if normalize_text(cleaned) == nombre_norm:
        return ""
    return cleaned


def parse_google_error(status: str, error_message: str) -> str:
    status = clean_spaces(status).upper()
    error_message = clean_spaces(error_message)
    if status == "REQUEST_DENIED":
        msg_lower = error_message.lower()
        if "billing" in msg_lower:
            return f"REQUEST_DENIED (billing not enabled): {error_message or 'billing not enabled'}"
        return f"REQUEST_DENIED: {error_message or 'request denied'}"
    if status in {"OVER_QUERY_LIMIT", "RESOURCE_EXHAUSTED"}:
        return f"{status}: quota exceeded"
    if status:
        return f"{status}: {error_message}" if error_message else status
    return error_message or "unknown_google_error"


def google_places_text_search(http: HttpClient, api_key: str, query_text: str) -> Tuple[List[dict], Optional[str]]:
    params = urllib.parse.urlencode(
        {
            "query": query_text,
            "region": "pr",
            "language": "es",
            "key": api_key,
        }
    )
    url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?{params}"
    try:
        payload = http.get_json(url)
    except Exception as exc:
        return [], f"google_textsearch_http_error: {exc}"

    status = clean_spaces(str(payload.get("status", ""))).upper()
    error_message = clean_spaces(str(payload.get("error_message", "")))
    if status == "OK":
        return list(payload.get("results") or []), None
    if status == "ZERO_RESULTS":
        return [], "ZERO_RESULTS"
    return [], parse_google_error(status, error_message)


def google_place_details(http: HttpClient, api_key: str, place_id: str) -> Tuple[Optional[dict], Optional[str]]:
    params = urllib.parse.urlencode(
        {
            "place_id": place_id,
            "fields": "name,formatted_address,geometry/location,place_id",
            "language": "es",
            "key": api_key,
        }
    )
    url = f"https://maps.googleapis.com/maps/api/place/details/json?{params}"
    try:
        payload = http.get_json(url)
    except Exception as exc:
        return None, f"google_details_http_error: {exc}"

    status = clean_spaces(str(payload.get("status", ""))).upper()
    error_message = clean_spaces(str(payload.get("error_message", "")))
    if status != "OK":
        return None, parse_google_error(status, error_message)

    result = payload.get("result") or {}
    formatted = clean_spaces(str(result.get("formatted_address", "")))
    if not formatted:
        return None, "details_without_formatted_address"
    loc = (result.get("geometry") or {}).get("location") or {}
    return {
        "formatted_address": formatted,
        "place_id": clean_spaces(str(result.get("place_id", ""))) or clean_spaces(place_id),
        "latitud": str(loc.get("lat", "")) if loc.get("lat") is not None else "",
        "longitud": str(loc.get("lng", "")) if loc.get("lng") is not None else "",
    }, None


def google_places_resolve(
    http: HttpClient,
    api_key: str,
    nombre_lugar: str,
    municipio_nombre: str,
    rate_sleep: float,
) -> Tuple[Optional[dict], Optional[str]]:
    if not api_key:
        return None, "missing GOOGLE_MAPS_API_KEY"

    # Regla solicitada: "{lugar}, {nombre_municipio}, Puerto Rico"
    query_text = f"{nombre_lugar}, {municipio_nombre}, Puerto Rico" if municipio_nombre else f"{nombre_lugar}, Puerto Rico"
    results, search_error = google_places_text_search(http=http, api_key=api_key, query_text=query_text)
    if search_error:
        return None, search_error

    if rate_sleep > 0:
        time.sleep(rate_sleep)

    # Probar hasta top 3 para maximizar match útil.
    for result in results[:3]:
        place_id = clean_spaces(str(result.get("place_id", "")))
        if not place_id:
            continue
        details, details_error = google_place_details(http=http, api_key=api_key, place_id=place_id)
        if details_error:
            # Error de permisos/billing debe devolverse directamente.
            if "REQUEST_DENIED" in details_error or "billing not enabled" in details_error:
                return None, details_error
            continue

        formatted = clean_spaces(str(details.get("formatted_address", "")))
        cleaned_address = remove_place_from_address(nombre_lugar, formatted)
        if not cleaned_address:
            continue
        if normalize_text(cleaned_address) == normalize_text(nombre_lugar):
            continue

        return {
            "direccion": cleaned_address,
            "place_id": clean_spaces(details.get("place_id", "")),
            "latitud": clean_spaces(details.get("latitud", "")),
            "longitud": clean_spaces(details.get("longitud", "")),
            "fuente": "google_places",
        }, None

    return None, "Google no devolvió dirección útil"


def infer_source_name(input_path: Path, explicit: Optional[str]) -> str:
    if explicit:
        return explicit.strip().lower()
    parent = input_path.parent.name.strip().lower()
    return parent or "desconocido"


def main() -> int:
    parser = argparse.ArgumentParser(description="Enriquecer direcciones de venues con cache global.")
    parser.add_argument("--input", required=True, help="Ruta del CSV eventos_municipios a enriquecer.")
    parser.add_argument("--source", default="", help="Nombre del scraper fuente (ej. prticket, pietix).")
    parser.add_argument("--rate-sleep", type=float, default=0.35, help="Pausa entre llamadas API.")
    args = parser.parse_args()

    script_path = Path(__file__).resolve()
    repo_root = find_repo_root(script_path.parent)

    input_path = (repo_root / args.input).resolve() if not Path(args.input).is_absolute() else Path(args.input).resolve()
    if not input_path.exists():
        print(f"ERROR: Input CSV no existe: {input_path}", file=sys.stderr)
        return 1

    source_name = infer_source_name(input_path, args.source)
    output_path = input_path.with_name(f"{input_path.stem}_con_direcciones.csv")
    cache_path = repo_root / "exports" / "event_venues_cache.csv"
    no_resueltos_path = repo_root / "exports" / "venues_no_resueltos.csv"

    env = {}
    env.update(load_env_file(repo_root / ".env"))
    env.update(load_env_file(repo_root / ".env.local"))
    env.update(os.environ)

    google_key = clean_spaces(env.get("GOOGLE_MAPS_API_KEY", ""))

    http = HttpClient()
    municipios_map = fetch_municipios_map(http=http, env=env)

    input_rows, input_headers = read_csv_rows(input_path)
    if not input_rows:
        if not input_headers:
            print(f"ERROR: CSV vacío o inválido: {input_path}", file=sys.stderr)
            return 1
        # Genera salida vacía con mismo esquema.
        out_headers = list(input_headers)
        if "direccion" not in out_headers:
            out_headers.append("direccion")
        write_csv_rows(output_path, out_headers, [])
        print(f"Procesado: 0 filas en {output_path}")
        return 0

    out_headers = list(input_headers)
    if "direccion" not in out_headers:
        out_headers.append("direccion")

    cache = keep_google_places_cache_only(load_cache(cache_path))
    no_resueltos = load_no_resueltos(no_resueltos_path)

    processed = 0
    cache_hits = 0
    api_calls = 0
    fails = 0
    fatal_api_error = ""
    missing_key_reported = False
    request_denied_reported = False

    output_rows: List[dict] = []
    local_resolution_cache: Dict[str, Tuple[Optional[dict], Optional[str]]] = {}

    for row in input_rows:
        processed += 1
        lugar = clean_spaces(row.get("lugar", ""))
        municipio_id = clean_spaces(str(row.get("municipio_id", "")))
        enlaceboletos = clean_spaces(row.get("enlaceboletos", ""))
        key = make_key(lugar, municipio_id)

        enriched_row = dict(row)
        resolved_address = ""

        cache_entry = cache.get(key)
        cache_entry_fuente = clean_spaces((cache_entry or {}).get("fuente", "")).lower()
        # Solo cache de direcciones reales desde Google Places.
        if (
            cache_entry
            and cache_entry_fuente == "google_places"
            and clean_spaces(cache_entry.get("direccion", ""))
            and clean_spaces(cache_entry.get("place_id", ""))
        ):
            cache_hits += 1
            resolved_address = clean_spaces(cache_entry.get("direccion", ""))
        else:
            if key in local_resolution_cache:
                resolved, error = local_resolution_cache[key]
            else:
                municipio_nombre = municipios_map.get(municipio_id, "")
                if fatal_api_error:
                    resolved, error = None, fatal_api_error
                else:
                    api_calls += 1
                    resolved, error = google_places_resolve(
                        http=http,
                        api_key=google_key,
                        nombre_lugar=lugar,
                        municipio_nombre=municipio_nombre,
                        rate_sleep=max(0.0, float(args.rate_sleep)),
                    )
                    local_resolution_cache[key] = (resolved, error)

                    # Si hay error estructural de key/permisos, evitar 40 llamadas fallidas repetidas.
                    if error and "missing GOOGLE_MAPS_API_KEY" in error:
                        fatal_api_error = "missing GOOGLE_MAPS_API_KEY"
                        if not missing_key_reported:
                            print("ERROR: missing GOOGLE_MAPS_API_KEY", file=sys.stderr)
                            missing_key_reported = True
                    elif error and ("REQUEST_DENIED" in error or "billing not enabled" in error):
                        fatal_api_error = error
                        if not request_denied_reported:
                            print(f"ERROR: {error}", file=sys.stderr)
                            request_denied_reported = True

            if resolved:
                resolved_address = clean_spaces(resolved.get("direccion", ""))
                cache[key] = {
                    "key": key,
                    "nombre_lugar": lugar,
                    "municipio_id": municipio_id,
                    "direccion": resolved_address,
                    "place_id": clean_spaces(resolved.get("place_id", "")),
                    "latitud": clean_spaces(resolved.get("latitud", "")),
                    "longitud": clean_spaces(resolved.get("longitud", "")),
                    "fuente": clean_spaces(resolved.get("fuente", "")) or "google_places",
                    "updated_at": now_iso(),
                }
            else:
                fails += 1
                motivo = error or "No se pudo resolver dirección"
                unresolved_row = {
                    "nombre_lugar": lugar,
                    "municipio_id": municipio_id,
                    "fuente_scraper": source_name,
                    "enlaceboletos": enlaceboletos,
                    "motivo": motivo,
                }
                unresolved_key = "|".join(unresolved_row[h] for h in NO_RESUELTOS_HEADERS)
                no_resueltos[unresolved_key] = unresolved_row

        # Regla: direccion no debe ser igual a lugar.
        if normalize_text(resolved_address) == normalize_text(lugar):
            resolved_address = ""

        # Limpieza de pendientes antiguos: si ya resolvimos, removemos entradas previas del mismo venue/fuente.
        if resolved_address:
            to_delete = []
            for unresolved_key, unresolved_row in no_resueltos.items():
                if (
                    normalize_text(unresolved_row.get("nombre_lugar", "")) == normalize_text(lugar)
                    and clean_spaces(unresolved_row.get("municipio_id", "")) == municipio_id
                    and clean_spaces(unresolved_row.get("fuente_scraper", "")).lower() == source_name.lower()
                ):
                    to_delete.append(unresolved_key)
            for unresolved_key in to_delete:
                no_resueltos.pop(unresolved_key, None)

        enriched_row["direccion"] = resolved_address
        output_rows.append(enriched_row)

    # Guardar cache persistente (merge: conserva existente + nuevos/actualizados).
    save_cache(cache_path, cache)
    save_no_resueltos(no_resueltos_path, no_resueltos)
    write_csv_rows(output_path, out_headers, output_rows)

    print(f"Input: {input_path}")
    print(f"Output enriquecido: {output_path}")
    print(f"Cache global: {cache_path}")
    print(f"No resueltos: {no_resueltos_path}")
    print(f"total venues procesados: {processed}")
    print(f"cache hits: {cache_hits}")
    print(f"api calls: {api_calls}")
    print(f"fallos: {fails}")
    print(f"cache size total: {len(cache)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
