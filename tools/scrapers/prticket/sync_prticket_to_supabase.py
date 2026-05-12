#!/usr/bin/env python3
"""
Sincroniza export CSV de PRticket hacia Supabase.

Flujo:
1) Lee CSVs en exports/prticket/
2) Upsert de eventos (sin borrar todo)
3) Reemplaza sedes/fechas para eventos sincronizados
4) Actualiza boleterías (source=prticket)
"""

from __future__ import annotations

import csv
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


SOURCE_NAME = "prticket"
EXPORT_DIR = Path("exports/prticket")
EVENTOS_CSV = EXPORT_DIR / "eventos_prticket.csv"
SEDES_CSV = EXPORT_DIR / "eventos_municipios_prticket.csv"
FECHAS_CSV = EXPORT_DIR / "eventoFechas_prticket.csv"
BOLETERIAS_CSV = EXPORT_DIR / "eventos_boleterias_prticket.csv"


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


def clean(value: Any) -> str:
    return str(value or "").strip()


def to_bool(value: Any) -> bool:
    text = clean(value).lower()
    return text in {"1", "true", "t", "yes", "y"}


def to_int(value: Any, default: int = 0) -> int:
    try:
        return int(str(value).strip())
    except Exception:
        return default


class SupabaseRest:
    def __init__(self, url: str, service_role_key: str) -> None:
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _request(
        self,
        method: str,
        table: str,
        query: Optional[Dict[str, str]] = None,
        payload: Optional[Any] = None,
        prefer: Optional[str] = None,
    ) -> Any:
        query_string = urllib.parse.urlencode(query or {})
        endpoint = f"{self.url}/rest/v1/{table}"
        if query_string:
            endpoint = f"{endpoint}?{query_string}"

        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer

        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(endpoint, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read().decode("utf-8", errors="replace")
            if not raw:
                return None
            return json.loads(raw)

    def select(self, table: str, query: Dict[str, str]) -> List[dict]:
        result = self._request("GET", table, query=query)
        return result or []

    def insert(
        self,
        table: str,
        rows: List[dict],
        *,
        on_conflict: Optional[str] = None,
        merge_duplicates: bool = False,
        returning: bool = True,
    ) -> List[dict]:
        query: Dict[str, str] = {}
        if on_conflict:
            query["on_conflict"] = on_conflict

        prefer_parts: List[str] = []
        if merge_duplicates:
            prefer_parts.append("resolution=merge-duplicates")
        prefer_parts.append("return=representation" if returning else "return=minimal")
        prefer = ",".join(prefer_parts)

        result = self._request("POST", table, query=query, payload=rows, prefer=prefer)
        return result or []

    def patch(self, table: str, query: Dict[str, str], payload: dict) -> List[dict]:
        result = self._request("PATCH", table, query=query, payload=payload, prefer="return=representation")
        return result or []

    def delete(self, table: str, query: Dict[str, str]) -> None:
        self._request("DELETE", table, query=query, prefer="return=minimal")


def read_csv(path: Path) -> List[dict]:
    if not path.exists():
        raise FileNotFoundError(f"No existe CSV: {path}")
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def build_in_filter(values: List[int]) -> str:
    cleaned = [str(int(v)) for v in values if int(v) > 0]
    if not cleaned:
        return "()"
    return f"({','.join(cleaned)})"


def sync() -> int:
    repo_root = Path(__file__).resolve().parents[3]
    env = {}
    env.update(load_env_file(repo_root / ".env"))
    env.update(load_env_file(repo_root / ".env.local"))
    env.update(os.environ)

    supabase_url = clean(env.get("SUPABASE_URL"))
    service_role = clean(env.get("SUPABASE_SERVICE_ROLE_KEY"))
    if not supabase_url or not service_role:
        print("ERROR: Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1

    eventos = read_csv(repo_root / EVENTOS_CSV)
    sedes = read_csv(repo_root / SEDES_CSV)
    fechas = read_csv(repo_root / FECHAS_CSV)
    boleterias = read_csv(repo_root / BOLETERIAS_CSV)

    sb = SupabaseRest(supabase_url, service_role)

    # Mapa de evento existente por URL (source prticket)
    existing_boleterias = sb.select(
        "eventos_boleterias",
        {
            "select": "evento_id,source,url_evento",
            "source": f"eq.{SOURCE_NAME}",
            "limit": "5000",
        },
    )
    existing_by_url = {clean(r.get("url_evento")).lower(): to_int(r.get("evento_id")) for r in existing_boleterias if clean(r.get("url_evento"))}

    temp_to_real_event_id: Dict[int, int] = {}

    # 1) Upsert eventos base
    for row in eventos:
        temp_event_id = to_int(row.get("id"))
        url_evento = clean(row.get("enlaceboletos"))
        if not temp_event_id or not url_evento:
            continue
        url_key = url_evento.lower()
        payload = {
            "nombre": clean(row.get("nombre")),
            "descripcion": clean(row.get("descripcion")),
            "costo": clean(row.get("costo")),
            "gratis": to_bool(row.get("gratis")),
            "lugar": clean(row.get("lugar")),
            "direccion": clean(row.get("direccion")),
            "municipio_id": to_int(row.get("municipio_id")) or None,
            "categoria": to_int(row.get("categoria")) or None,
            "enlaceboletos": url_evento,
            "boletos_por_localidad": to_bool(row.get("boletos_por_localidad")),
            "imagen": clean(row.get("imagen")),
            "activo": True,
        }

        existing_event_id = existing_by_url.get(url_key)
        if existing_event_id:
            updated = sb.patch("eventos", {"id": f"eq.{existing_event_id}"}, payload)
            if not updated:
                raise RuntimeError(f"No se pudo actualizar evento id={existing_event_id} url={url_evento}")
            real_event_id = to_int(updated[0].get("id"))
        else:
            created = sb.insert("eventos", [payload], returning=True)
            if not created:
                raise RuntimeError(f"No se pudo crear evento url={url_evento}")
            real_event_id = to_int(created[0].get("id"))

        if not real_event_id:
            raise RuntimeError(f"Evento sin id retornado para url={url_evento}")
        temp_to_real_event_id[temp_event_id] = real_event_id

    real_event_ids = sorted({v for v in temp_to_real_event_id.values() if v > 0})
    if not real_event_ids:
        print("WARNING: No se sincronizaron eventos.")
        return 0

    # 2) Borrar sedes/fechas previas de esos eventos para recrearlas limpias
    sedes_prev = sb.select(
        "eventos_municipios",
        {
            "select": "id,event_id",
            "event_id": f"in.{build_in_filter(real_event_ids)}",
            "limit": "5000",
        },
    )
    sedes_prev_ids = [to_int(r.get("id")) for r in sedes_prev if to_int(r.get("id")) > 0]
    if sedes_prev_ids:
        sb.delete(
            "eventoFechas",
            {"evento_municipio_id": f"in.{build_in_filter(sedes_prev_ids)}"},
        )
    sb.delete("eventos_municipios", {"event_id": f"in.{build_in_filter(real_event_ids)}"})

    # 3) Insertar sedes nuevas + resolver localidad_id
    temp_sede_to_real_sede: Dict[int, int] = {}
    for row in sedes:
        temp_event_id = to_int(row.get("event_id"))
        real_event_id = temp_to_real_event_id.get(temp_event_id)
        if not real_event_id:
            continue

        municipio_id = to_int(row.get("municipio_id"))
        lugar = clean(row.get("lugar"))
        direccion = clean(row.get("direccion"))
        if not municipio_id or not lugar:
            continue

        localidad_upsert = {
            "nombre": lugar,
            "municipio_id": municipio_id,
            "direccion_formateada": direccion or None,
            "fuente_geocoding": "sync_prticket",
            "estado_geocoding": "pendiente",
            "metadata": {"source": SOURCE_NAME},
        }
        localidad_rows = sb.insert(
            "evento_localidades",
            [localidad_upsert],
            on_conflict="municipio_id,nombre_normalizado",
            merge_duplicates=True,
            returning=True,
        )
        if not localidad_rows:
            raise RuntimeError(f"No se pudo upsert localidad {municipio_id}|{lugar}")
        localidad_id = to_int(localidad_rows[0].get("id"))

        sede_payload = {
            "event_id": real_event_id,
            "municipio_id": municipio_id,
            "lugar": lugar,
            "direccion": direccion,
            "enlaceboletos": clean(row.get("enlaceboletos")) or None,
            "localidad_id": localidad_id or None,
        }
        sede_created = sb.insert("eventos_municipios", [sede_payload], returning=True)
        if not sede_created:
            raise RuntimeError(f"No se pudo crear sede evento={real_event_id} lugar={lugar}")
        real_sede_id = to_int(sede_created[0].get("id"))
        temp_sede_id = to_int(row.get("id"))
        if temp_sede_id and real_sede_id:
            temp_sede_to_real_sede[temp_sede_id] = real_sede_id

    # 4) Insertar fechas
    fechas_payload: List[dict] = []
    for row in fechas:
        temp_sede_id = to_int(row.get("evento_municipio_id"))
        real_sede_id = temp_sede_to_real_sede.get(temp_sede_id)
        if not real_sede_id:
            continue
        fecha = clean(row.get("fecha"))
        hora = clean(row.get("horainicio"))
        if not fecha or not hora:
            continue
        fechas_payload.append(
            {
                "evento_municipio_id": real_sede_id,
                "fecha": fecha,
                "horainicio": hora,
                "mismahora": to_bool(row.get("mismahora")),
            }
        )
    if fechas_payload:
        sb.insert("eventoFechas", fechas_payload, returning=False)

    # 5) Reemplazar boleterías PRticket para estos eventos
    sb.delete(
        "eventos_boleterias",
        {
            "source": f"eq.{SOURCE_NAME}",
            "evento_id": f"in.{build_in_filter(real_event_ids)}",
        },
    )

    boleterias_payload: List[dict] = []
    for row in boleterias:
        temp_event_id = to_int(row.get("evento_id"))
        real_event_id = temp_to_real_event_id.get(temp_event_id)
        if not real_event_id:
            continue
        url_evento = clean(row.get("url_evento"))
        if not url_evento:
            continue
        boleterias_payload.append(
            {
                "evento_id": real_event_id,
                "source": SOURCE_NAME,
                "source_display": "PRticket",
                "logo_key": SOURCE_NAME,
                "url_evento": url_evento,
                "prioridad": to_int(row.get("prioridad"), 10),
                "activo": to_bool(row.get("activo")) if clean(row.get("activo")) else True,
                "metadata": {"source_event_id": clean(row.get("source_event_id"))},
            }
        )
    if boleterias_payload:
        sb.insert("eventos_boleterias", boleterias_payload, returning=False)

    print(f"[sync_prticket] eventos_upsert: {len(temp_to_real_event_id)}")
    print(f"[sync_prticket] sedes_insertadas: {len(temp_sede_to_real_sede)}")
    print(f"[sync_prticket] fechas_insertadas: {len(fechas_payload)}")
    print(f"[sync_prticket] boleterias_insertadas: {len(boleterias_payload)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(sync())
