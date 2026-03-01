import {
  buildListadoComerciosRpcPayload,
  normalizarComercioListadoDesdeRpc,
  resolverPlanComercio,
} from '@findixi/shared';

import { supabase } from '../../lib/supabase';

import type { ComercioListItem, ComercioRow } from './types';

const COMERCIOS_SELECT =
  'id,nombre,nombreSucursal,municipio,direccion,telefono,latitud,longitud,logo,portada,descripcion,facebook,instagram,tiktok,whatsapp,email,webpage,tieneSucursales,plan_id,plan_nivel,plan_nombre,plan_status,permite_perfil,aparece_en_cercanos,permite_menu,permite_especiales,permite_ordenes,estado_propiedad,estado_verificacion,propietario_verificado,activo,ComercioCategorias(idCategoria)';
const PAGE_SIZE = 1000;
const MAX_COMERCIOS = 5000;

export type ComerciosRpcParams = {
  textoBusqueda?: string | null;
  municipio?: string | null;
  categoriaId?: number | null;
  subcategoriaId?: number | null;
  abiertoAhora?: boolean | null;
  latitud?: number | null;
  longitud?: number | null;
  limit?: number;
  offset?: number;
};

export type ComerciosRpcResult = {
  items: ComercioListItem[];
  count: number;
  hasMore: boolean;
};

export type SubcategoriaOption = {
  id: number;
  label: string;
};

export type CercanosParams = {
  latitud: number;
  longitud: number;
  radioKm?: number;
  categoriaId?: number | null;
  abiertoAhora?: boolean | null;
  incluirInactivos?: boolean;
  limit?: number;
};

export type ComerciosRefuerzoParams = {
  categoriaId?: number | null;
  subcategoriaId?: number | null;
  abiertoAhora?: boolean | null;
  comercioIds: number[];
};

export type ComercioHorario = {
  diaSemana: number;
  apertura: string | null;
  cierre: string | null;
  cerrado: boolean;
};

export type ComercioAmenidad = {
  id: number;
  nombre: string;
  icono: string | null;
};

export type ComercioEspecial = {
  id: number;
  tipo: 'almuerzo' | 'happyhour';
  nombre: string;
  descripcion: string;
  precio: number | null;
  imagenUrl: string | null;
};

export type ComercioEspecialesDia = {
  almuerzo: ComercioEspecial[];
  happyhour: ComercioEspecial[];
};

export type ComercioSucursal = {
  id: number;
  nombre: string;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeComercio(row: Partial<ComercioRow>): ComercioRow {
  const latitud = toFiniteNumber(row.latitud);
  const longitud = toFiniteNumber(row.longitud);
  const idCategoriaRaw = (row as { idCategoria?: number | string | null }).idCategoria;
  const idCategoria = idCategoriaRaw == null ? null : Number(idCategoriaRaw);
  const colorHexRaw = (row as { color_hex?: string | null }).color_hex;
  const colorHex = typeof colorHexRaw === 'string' ? colorHexRaw.trim() : '';
  return {
    id: Number(row.id ?? 0),
    nombre: String(row.nombre ?? '').trim(),
    municipio: row.municipio ?? null,
    pueblo: row.pueblo ?? row.municipio ?? null,
    direccion: row.direccion ?? null,
    telefono: row.telefono ?? null,
    latitud,
    longitud,
    distanciaKm: toFiniteNumber(row.distanciaKm),
    minutosEstimados: toFiniteNumber(row.minutosEstimados),
    minutosCrudos: toFiniteNumber(row.minutosCrudos),
    tiempoVehiculo: row.tiempoVehiculo ?? null,
    tiempoTexto: row.tiempoTexto ?? null,
    logo: row.logo ?? null,
    portada: row.portada ?? null,
    descripcion: row.descripcion ?? null,
    facebook: row.facebook ?? null,
    instagram: row.instagram ?? null,
    tiktok: row.tiktok ?? null,
    whatsapp: row.whatsapp ?? null,
    email: row.email ?? null,
    webpage: row.webpage ?? null,
    tieneSucursales: row.tieneSucursales ?? null,
    plan_id: row.plan_id ?? null,
    plan_nivel: row.plan_nivel ?? null,
    plan_nombre: row.plan_nombre ?? null,
    plan_status: row.plan_status ?? null,
    permite_perfil: row.permite_perfil ?? null,
    aparece_en_cercanos: row.aparece_en_cercanos ?? null,
    permite_menu: row.permite_menu ?? null,
    permite_especiales: row.permite_especiales ?? null,
    permite_ordenes: row.permite_ordenes ?? null,
    estado_propiedad: row.estado_propiedad ?? null,
    estado_verificacion: row.estado_verificacion ?? null,
    propietario_verificado: row.propietario_verificado ?? null,
    activo: row.activo ?? null,
    abierto_ahora: row.abierto_ahora ?? null,
    abiertoAhora: row.abiertoAhora ?? row.abierto_ahora ?? null,
    favorito: row.favorito ?? null,
    subcategoriaIds: Array.isArray(row.subcategoriaIds) ? row.subcategoriaIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)) : null,
    nombreSucursal: row.nombreSucursal ?? null,
    nombre_sucursal: row.nombre_sucursal ?? null,
    sucursal: row.sucursal ?? null,
    esSucursal: row.esSucursal ?? null,
    es_sucursal: row.es_sucursal ?? null,
    idCategoria: Number.isFinite(idCategoria) ? idCategoria : null,
    color_hex: colorHex || null,
    ComercioCategorias: Array.isArray(row.ComercioCategorias)
      ? row.ComercioCategorias
          .map((entry) => {
            const idCategoriaRaw = (entry as { idCategoria?: number | string | null })?.idCategoria;
            const idCategoria = idCategoriaRaw == null ? null : Number(idCategoriaRaw);
            return { idCategoria: Number.isFinite(idCategoria) ? idCategoria : null };
          })
      : null,
  };
}

function getStoragePublicUrl(pathOrUrl: string | null | undefined, bucket = 'galeriacomercios'): string | null {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const cleanPath = raw.replace(/^public\//i, '').replace(/^\/+/, '');
  return supabase.storage.from(bucket).getPublicUrl(cleanPath).data.publicUrl;
}

function normalizeRpcComercio(record: Record<string, unknown>, referencia: { lat: number; lon: number } | null): ComercioRow {
  return normalizeComercio(
    normalizarComercioListadoDesdeRpc(record as Record<string, unknown>, {
      referencia: referencia ?? null,
    }) as Partial<ComercioRow>
  );
}

function buildRpcPayload(params: ComerciosRpcParams) {
  return buildListadoComerciosRpcPayload({
    textoBusqueda: params.textoBusqueda ?? '',
    municipio: params.municipio ?? '',
    municipioDetectado: '',
    municipioSeleccionadoManualmente: true,
    usarMunicipioDetectado: false,
    categoria: params.categoriaId ?? null,
    subcategoria: params.subcategoriaId ?? null,
    abiertoAhora: params.abiertoAhora === true,
    coordsUsuario: {
      lat: params.latitud ?? null,
      lon: params.longitud ?? null,
    },
    tienePermisoUbicacion: Number.isFinite(toFiniteNumber(params.latitud)) && Number.isFinite(toFiniteNumber(params.longitud)),
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
  });
}

export async function fetchComercios(maxRows = MAX_COMERCIOS): Promise<ComercioListItem[]> {
  let offset = 0;
  const rows: Partial<ComercioRow>[] = [];

  while (offset < maxRows) {
    const from = offset;
    const to = offset + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('Comercios')
      .select(COMERCIOS_SELECT)
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const batch = (data ?? []) as Partial<ComercioRow>[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows
    .map((row) => normalizeComercio(row))
    .filter((row) => row.id > 0 && row.nombre.length > 0);
}

export async function fetchComerciosFiltrados(params: ComerciosRpcParams = {}): Promise<ComerciosRpcResult> {
  const payload = buildRpcPayload(params);
  const limit = payload.p_limit;

  const { data, error } = await supabase.rpc('buscar_comercios_filtrados', payload);
  if (error) throw error;

  const lat = toFiniteNumber(params.latitud);
  const lon = toFiniteNumber(params.longitud);
  const referencia = Number.isFinite(lat) && Number.isFinite(lon) ? { lat: lat as number, lon: lon as number } : null;

  const items = (Array.isArray(data) ? data : [])
    .map((record) => normalizeRpcComercio(record as Record<string, unknown>, referencia))
    .filter((row) => row.id > 0 && row.nombre.length > 0);

  return {
    items,
    count: items.length,
    hasMore: items.length === limit,
  };
}

export async function fetchComercioIdsBySearch(textoRaw: string): Promise<number[]> {
  const texto = String(textoRaw ?? '').trim();
  if (texto.length < 3) return [];

  try {
    const { data: productos, error: productosError } = await supabase
      .from('productos')
      .select('idMenu')
      .ilike('nombre', `%${texto}%`);
    if (productosError) throw productosError;

    const idsMenusDesdeProductos = Array.from(
      new Set(
        (Array.isArray(productos) ? productos : [])
          .map((row) => Number((row as { idMenu?: number | string | null }).idMenu))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );

    let menusPorProducto: Array<{ idComercio?: number | string | null }> = [];
    if (idsMenusDesdeProductos.length > 0) {
      const { data, error } = await supabase
        .from('menus')
        .select('idComercio')
        .in('id', idsMenusDesdeProductos);
      if (error) throw error;
      menusPorProducto = (Array.isArray(data) ? data : []) as Array<{ idComercio?: number | string | null }>;
    }

    const { data: dataMenusTitulo, error: menusTituloError } = await supabase
      .from('menus')
      .select('idComercio')
      .ilike('titulo', `%${texto}%`);
    if (menusTituloError) throw menusTituloError;
    const menusPorTitulo = (Array.isArray(dataMenusTitulo) ? dataMenusTitulo : []) as Array<{
      idComercio?: number | string | null;
    }>;
    return Array.from(
      new Set(
        [...menusPorProducto, ...menusPorTitulo]
          .map((row) => Number(row.idComercio))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );
  } catch (error) {
    console.warn('[mobile-public] Error obteniendo ids por busqueda en productos/menus:', error);
    return [];
  }
}

export async function fetchComerciosRefuerzoByIds(params: ComerciosRefuerzoParams): Promise<ComercioListItem[]> {
  const ids = Array.from(
    new Set(
      (Array.isArray(params.comercioIds) ? params.comercioIds : [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );
  if (ids.length === 0) return [];

  const payload = buildRpcPayload({
    textoBusqueda: null,
    municipio: null,
    categoriaId: params.categoriaId ?? null,
    subcategoriaId: params.subcategoriaId ?? null,
    abiertoAhora: params.abiertoAhora ?? null,
    latitud: null,
    longitud: null,
    limit: 200,
    offset: 0,
  });

  const { data, error } = await supabase.rpc('buscar_comercios_filtrados', payload);
  if (error) throw error;

  const idsSet = new Set(ids);
  return (Array.isArray(data) ? data : [])
    .map((record) => normalizeRpcComercio(record as Record<string, unknown>, null))
    .filter((row) => row.id > 0 && row.nombre.length > 0 && idsSet.has(Number(row.id)));
}

export async function fetchSubcategoriasByCategoria(categoriaId: number): Promise<SubcategoriaOption[]> {
  const safeCategoria = Number(categoriaId);
  if (!Number.isFinite(safeCategoria) || safeCategoria <= 0) return [];

  const { data, error } = await supabase
    .from('subCategoria')
    .select('id,nombre,nombre_es')
    .eq('idCategoria', safeCategoria)
    .order('nombre', { ascending: true });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => {
      const id = Number((row as { id?: number | string | null }).id ?? 0);
      const nombre = String((row as { nombre_es?: string | null }).nombre_es ?? '').trim();
      const fallback = String((row as { nombre?: string | null }).nombre ?? '').trim();
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        id,
        label: nombre || fallback || `Subcategoría ${id}`,
      } as SubcategoriaOption;
    })
    .filter((row): row is SubcategoriaOption => Boolean(row));
}

export async function fetchMunicipios(): Promise<string[]> {
  const { data, error } = await supabase
    .from('Municipios')
    .select('nombre')
    .order('nombre', { ascending: true });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => String((row as { nombre?: string | null }).nombre ?? '').trim())
    .filter((name) => name.length > 0);
}

export async function fetchMunicipioCoords(nombre: string): Promise<{ lat: number; lon: number } | null> {
  const municipio = String(nombre ?? '').trim();
  if (!municipio) return null;

  const { data, error } = await supabase
    .from('Municipios')
    .select('latitud,longitud')
    .eq('nombre', municipio)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const lat = toFiniteNumber((data as { latitud?: number | string | null }).latitud);
  const lon = toFiniteNumber((data as { longitud?: number | string | null }).longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat: lat as number, lon: lon as number };
}

export async function fetchCercanosParaCoordenadas(params: CercanosParams): Promise<ComercioListItem[]> {
  const lat = toFiniteNumber(params.latitud);
  const lon = toFiniteNumber(params.longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];

  const payload = buildListadoComerciosRpcPayload({
    textoBusqueda: '',
    municipio: '',
    municipioDetectado: '',
    municipioSeleccionadoManualmente: true,
    usarMunicipioDetectado: false,
    categoria: params.categoriaId ?? null,
    subcategoria: null,
    abiertoAhora: params.abiertoAhora === true,
    coordsUsuario: { lat, lon },
    tienePermisoUbicacion: true,
    limit: params.limit ?? 30,
    offset: 0,
  }) as Record<string, unknown>;

  payload.p_radio = Number.isFinite(toFiniteNumber(params.radioKm)) ? Number(params.radioKm) : 10;
  payload.p_activo = params.incluirInactivos ? null : true;

  const { data, error } = await supabase.rpc('buscar_comercios_filtrados', payload);
  if (error) throw error;

  const referencia = { lat: lat as number, lon: lon as number };
  const normalizados = (Array.isArray(data) ? data : [])
    .map((record) => normalizeRpcComercio(record as Record<string, unknown>, referencia))
    .filter((row) => row.id > 0 && row.nombre.length > 0);

  return normalizados.filter((comercio) => resolverPlanComercio(comercio).aparece_en_cercanos);
}

export async function fetchComercioById(id: number): Promise<ComercioRow | null> {
  const { data, error } = await supabase
    .from('Comercios')
    .select(COMERCIOS_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeComercio(data as Partial<ComercioRow>);
}

export async function fetchComercioGaleriaUrls(idComercio: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('imagenesComercios')
    .select('imagen,logo,portada')
    .eq('idComercio', idComercio)
    .or('logo.is.false,logo.is.null')
    .order('id', { ascending: true });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => getStoragePublicUrl((row as { imagen?: string | null }).imagen))
    .filter((value): value is string => Boolean(value));
}

export async function fetchComercioLogoUrl(idComercio: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('imagenesComercios')
    .select('imagen')
    .eq('idComercio', idComercio)
    .eq('logo', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return getStoragePublicUrl((data as { imagen?: string | null }).imagen);
}

export async function fetchComercioHorarios(idComercio: number): Promise<ComercioHorario[]> {
  const { data, error } = await supabase
    .from('Horarios')
    .select('diaSemana,apertura,cierre,cerrado')
    .eq('idComercio', idComercio)
    .order('diaSemana', { ascending: true });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => {
      const diaSemana = Number((row as { diaSemana?: number | string | null }).diaSemana);
      if (!Number.isFinite(diaSemana) || diaSemana < 0 || diaSemana > 6) return null;
      return {
        diaSemana,
        apertura: String((row as { apertura?: string | null }).apertura ?? '').trim() || null,
        cierre: String((row as { cierre?: string | null }).cierre ?? '').trim() || null,
        cerrado: Boolean((row as { cerrado?: boolean | null }).cerrado),
      } as ComercioHorario;
    })
    .filter((row): row is ComercioHorario => Boolean(row));
}

export async function fetchComercioAmenidades(idComercio: number): Promise<ComercioAmenidad[]> {
  const { data: relaciones, error: relacionesError } = await supabase
    .from('comercioAmenidades')
    .select('idAmenidad')
    .eq('idComercio', idComercio);

  if (relacionesError) throw relacionesError;

  const ids = Array.from(
    new Set(
      (Array.isArray(relaciones) ? relaciones : [])
        .map((entry) => Number((entry as { idAmenidad?: number | string | null }).idAmenidad))
        .filter((entry) => Number.isFinite(entry) && entry > 0)
    )
  );

  if (ids.length === 0) return [];

  const { data, error } = await supabase.from('Amenidades').select('id,nombre,icono').in('id', ids);
  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => {
      const id = Number((row as { id?: number | string | null }).id);
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        id,
        nombre: String((row as { nombre?: string | null }).nombre ?? '').trim(),
        icono: String((row as { icono?: string | null }).icono ?? '').trim() || null,
      } as ComercioAmenidad;
    })
    .filter((row): row is ComercioAmenidad => Boolean(row))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function fetchComercioEspecialesDia(idComercio: number, diaSemana: number): Promise<ComercioEspecialesDia> {
  const safeDia = Number(diaSemana);
  if (!Number.isFinite(safeDia) || safeDia < 0 || safeDia > 6) {
    return { almuerzo: [], happyhour: [] };
  }

  const { data, error } = await supabase
    .from('especialesDia')
    .select('*')
    .eq('idcomercio', idComercio)
    .eq('diasemana', safeDia)
    .eq('activo', true);

  if (error) throw error;

  const list = Array.isArray(data) ? data : [];
  if (list.length === 0) return { almuerzo: [], happyhour: [] };

  const especialesIds = list
    .map((row) => Number((row as { id?: number | string | null }).id))
    .filter((entry) => Number.isFinite(entry) && entry > 0);

  let imagenesEspecialMap = new Map<number, string | null>();
  if (especialesIds.length > 0) {
    const { data: imagenes, error: imgError } = await supabase
      .from('imgEspeciales')
      .select('idEspecial,imagen')
      .in('idEspecial', especialesIds);

    if (!imgError) {
      imagenesEspecialMap = new Map(
        (Array.isArray(imagenes) ? imagenes : [])
          .map((row) => {
            const idEspecial = Number((row as { idEspecial?: number | string | null }).idEspecial);
            const url = getStoragePublicUrl((row as { imagen?: string | null }).imagen);
            if (!Number.isFinite(idEspecial) || idEspecial <= 0) return null;
            return [idEspecial, url] as const;
          })
          .filter((entry): entry is readonly [number, string | null] => Boolean(entry))
      );
    }
  }

  const nowHour = new Date().getHours();
  const result: ComercioEspecialesDia = { almuerzo: [], happyhour: [] };

  for (const row of list) {
    const id = Number((row as { id?: number | string | null }).id);
    const tipoRaw = String((row as { tipo?: string | null }).tipo ?? '').trim().toLowerCase();
    const tipo = tipoRaw === 'happyhour' ? 'happyhour' : 'almuerzo';
    if (!Number.isFinite(id) || id <= 0) continue;

    if (tipo === 'almuerzo' && !(nowHour >= 6 && nowHour < 16)) {
      continue;
    }

    const inlineImagen = getStoragePublicUrl((row as { imagen?: string | null }).imagen);
    const imageFromRelacion = imagenesEspecialMap.get(id) ?? null;
    const imagenUrl = inlineImagen || imageFromRelacion || null;

    const especial: ComercioEspecial = {
      id,
      tipo,
      nombre: String((row as { nombre?: string | null }).nombre ?? '').trim() || 'Especial',
      descripcion: String((row as { descripcion?: string | null }).descripcion ?? '').trim(),
      precio: toFiniteNumber((row as { precio?: number | string | null }).precio),
      imagenUrl,
    };

    if (tipo === 'happyhour') {
      result.happyhour.push(especial);
    } else {
      result.almuerzo.push(especial);
    }
  }

  return result;
}

async function hasMenuActivo(idComercio: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('menus')
    .select('id')
    .eq('idComercio', idComercio)
    .eq('activo', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[mobile-public] No se pudo verificar menu activo:', error.message);
    return false;
  }
  return Boolean(data);
}

export async function fetchComercioMenuTargetId(idComercio: number): Promise<number | null> {
  const safeId = Number(idComercio);
  if (!Number.isFinite(safeId) || safeId <= 0) return null;

  if (await hasMenuActivo(safeId)) return safeId;

  const { data, error } = await supabase
    .from('ComercioSucursales')
    .select('comercio_id,sucursal_id')
    .or(`comercio_id.eq.${safeId},sucursal_id.eq.${safeId}`);
  if (error) {
    console.warn('[mobile-public] No se pudieron cargar sucursales relacionadas:', error.message);
    return null;
  }

  const relaciones = Array.isArray(data) ? data : [];
  for (const rel of relaciones) {
    const comercioId = Number((rel as { comercio_id?: number | string | null }).comercio_id);
    const sucursalId = Number((rel as { sucursal_id?: number | string | null }).sucursal_id);
    const candidato = comercioId === safeId ? sucursalId : comercioId;
    if (!Number.isFinite(candidato) || candidato <= 0) continue;
    if (await hasMenuActivo(candidato)) return candidato;
  }

  return null;
}

export async function fetchComercioSucursales(idComercio: number): Promise<ComercioSucursal[]> {
  const safeId = Number(idComercio);
  if (!Number.isFinite(safeId) || safeId <= 0) return [];

  const { data: relaciones, error: relacionesError } = await supabase
    .from('ComercioSucursales')
    .select('comercio_id,sucursal_id')
    .or(`comercio_id.eq.${safeId},sucursal_id.eq.${safeId}`);
  if (relacionesError) throw relacionesError;

  const ids = Array.from(
    new Set(
      (Array.isArray(relaciones) ? relaciones : [])
        .flatMap((row) => [
          Number((row as { comercio_id?: number | string | null }).comercio_id),
          Number((row as { sucursal_id?: number | string | null }).sucursal_id),
        ])
        .filter((entry) => Number.isFinite(entry) && entry > 0 && entry !== safeId)
    )
  );

  if (ids.length === 0) return [];

  const { data, error } = await supabase.from('Comercios').select('id,nombre,nombreSucursal').in('id', ids);
  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => {
      const id = Number((row as { id?: number | string | null }).id);
      if (!Number.isFinite(id) || id <= 0) return null;
      const nombreSucursal = String((row as { nombreSucursal?: string | null }).nombreSucursal ?? '').trim();
      const nombre = String((row as { nombre?: string | null }).nombre ?? '').trim();
      return {
        id,
        nombre: nombreSucursal || nombre || `Sucursal ${id}`,
      } as ComercioSucursal;
    })
    .filter((row): row is ComercioSucursal => Boolean(row));
}

export async function fetchComercioDescripcionTraducida(idComercio: number, lang: string): Promise<string | null> {
  const langNorm = String(lang || 'es')
    .toLowerCase()
    .split('-')[0];

  if (langNorm === 'es') return null;

  try {
    const { data, error } = await supabase.functions.invoke('translate-comercio', {
      body: { idComercio, lang: langNorm },
    });
    if (error) throw error;

    const descripcion = (data as { data?: { descripcion?: string | null } } | null)?.data?.descripcion;
    return typeof descripcion === 'string' && descripcion.trim() !== '' ? descripcion : null;
  } catch (error) {
    console.warn('[mobile-public] No se pudo traducir descripcion del comercio:', error);
    return null;
  }
}
