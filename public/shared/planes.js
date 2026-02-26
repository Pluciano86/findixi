export const PLANES_PRELIMINARES = [
  {
    slug: 'basic',
    nombre: 'Findixi Basic',
    precio: 0,
    nivel: 0,
    descripcion_corta: 'Gratis',
    features: [
      'Logo y portada',
      '1 categoría',
      'Teléfono y dirección',
      'Municipio y coordenadas',
      'Horario',
    ],
  },
  {
    slug: 'regular',
    nombre: 'Findixi Regular',
    precio: 65,
    nivel: 1,
    descripcion_corta: 'Plan mensual',
    features: [
      'Todo lo de Basic',
      'Galería',
      'Redes sociales',
      'Descripción',
      'Amenidades',
    ],
  },
  {
    slug: 'plus',
    nombre: 'Findixi Plus',
    precio: 95,
    nivel: 2,
    descripcion_corta: 'Plan mensual',
    features: [
      'Todo lo de Regular',
      'Menú (secciones/productos)',
      'Happy Hours y Almuerzos',
    ],
  },
  {
    slug: 'premium',
    nombre: 'Findixi Premium',
    precio: 155,
    nivel: 3,
    descripcion_corta: 'Plan mensual',
    features: [
      'Todo lo de Plus',
      'Órdenes online con Clover',
    ],
  },
];

const PLAN_SLUGS = new Map(
  PLANES_PRELIMINARES.map((plan) => [plan.slug, plan.nivel])
);

function toText(value) {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function normalizarPlanSlug(value) {
  const raw = toText(value).toLowerCase();
  if (!raw) return '';
  if (raw.includes('basic')) return 'basic';
  if (raw.includes('regular')) return 'regular';
  if (raw.includes('plus')) return 'plus';
  if (raw.includes('premium')) return 'premium';
  return raw.replace(/[^a-z0-9]+/g, '-');
}

export function obtenerNivelPlan(value) {
  const numeric = toNumber(value);
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(3, Math.round(numeric)));
  const slug = normalizarPlanSlug(value);
  if (PLAN_SLUGS.has(slug)) return PLAN_SLUGS.get(slug);
  return 0;
}

export function obtenerPlanPorNivel(nivel) {
  const n = obtenerNivelPlan(nivel);
  return PLANES_PRELIMINARES.find((p) => p.nivel === n) || PLANES_PRELIMINARES[0];
}

export function derivarFlagsPorNivel(nivel) {
  const n = obtenerNivelPlan(nivel);
  return {
    permite_perfil: n >= 1,
    aparece_en_cercanos: n >= 1,
    permite_menu: n >= 2,
    permite_especiales: n >= 2,
    permite_ordenes: n >= 3,
  };
}

function boolOr(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function propiedadVerificadaDesdeEstado(comercio = {}) {
  const estadoPropiedad = toText(comercio.estado_propiedad).toLowerCase();
  const estadoVerificacion = toText(comercio.estado_verificacion).toLowerCase();
  const propietarioVerificado = typeof comercio.propietario_verificado === 'boolean'
    ? comercio.propietario_verificado
    : null;

  const hasOwnershipSignals =
    Boolean(estadoPropiedad) ||
    Boolean(estadoVerificacion) ||
    typeof propietarioVerificado === 'boolean';

  if (!hasOwnershipSignals) {
    return { hasOwnershipSignals: false, verificado: true };
  }

  const verificacionOk = ['otp_verificado', 'sms_verificado', 'messenger_verificado', 'manual_aprobado'].includes(
    estadoVerificacion
  );
  const verificado =
    estadoPropiedad === 'verificado' &&
    (verificacionOk || propietarioVerificado === true);

  return { hasOwnershipSignals: true, verificado };
}

export function resolverPlanComercio(comercio = {}) {
  const rawNivel =
    comercio.plan_nivel ??
    comercio.planNivel ??
    comercio.plan_level ??
    comercio.nivel_plan ??
    comercio.planNivel ??
    comercio.plan ??
    comercio.plan_slug ??
    comercio.plan_nombre;

  const tieneFlagsExpl = [
    comercio.permite_perfil,
    comercio.aparece_en_cercanos,
    comercio.permite_menu,
    comercio.permite_especiales,
    comercio.permite_ordenes,
  ].some((v) => typeof v === 'boolean');

  const tienePlanExpl =
    rawNivel !== undefined &&
    rawNivel !== null &&
    rawNivel !== '' ||
    Boolean(comercio.plan_id || comercio.planId || comercio.plan_nombre);

  const nivel = tienePlanExpl || tieneFlagsExpl ? obtenerNivelPlan(rawNivel) : 1;
  const planBase = obtenerPlanPorNivel(nivel);
  const flags = derivarFlagsPorNivel(nivel);
  const ownership = propiedadVerificadaDesdeEstado(comercio);
  const bloquearPorPropiedad = ownership.hasOwnershipSignals && !ownership.verificado;

  const permitePerfilBase = boolOr(comercio.permite_perfil, flags.permite_perfil);
  const apareceEnCercanosBase = boolOr(comercio.aparece_en_cercanos, flags.aparece_en_cercanos);
  const permiteMenuBase = boolOr(comercio.permite_menu, flags.permite_menu);
  const permiteEspecialesBase = boolOr(comercio.permite_especiales, flags.permite_especiales);
  const permiteOrdenesBase = boolOr(comercio.permite_ordenes, flags.permite_ordenes);

  return {
    nivel,
    slug: planBase.slug,
    nombre: toText(comercio.plan_nombre) || planBase.nombre,
    plan_id: comercio.plan_id ?? comercio.planId ?? null,
    status: comercio.plan_status ?? comercio.planStatus ?? null,
    precio: toNumber(comercio.plan_precio ?? comercio.planPrecio ?? planBase.precio) ?? planBase.precio,
    permite_perfil: bloquearPorPropiedad ? false : permitePerfilBase,
    aparece_en_cercanos: bloquearPorPropiedad ? false : apareceEnCercanosBase,
    permite_menu: bloquearPorPropiedad ? false : permiteMenuBase,
    permite_especiales: bloquearPorPropiedad ? false : permiteEspecialesBase,
    permite_ordenes: bloquearPorPropiedad ? false : permiteOrdenesBase,
  };
}

export function buildComercioPlanPayload(plan = {}) {
  const nivel = obtenerNivelPlan(plan.nivel ?? plan.plan_nivel ?? plan.slug ?? plan.nombre);
  const base = obtenerPlanPorNivel(nivel);
  const flags = derivarFlagsPorNivel(nivel);

  return {
    plan_id: plan.id ?? plan.plan_id ?? null,
    plan_nivel: nivel,
    plan_nombre: toText(plan.nombre) || base.nombre,
    permite_perfil: flags.permite_perfil,
    aparece_en_cercanos: flags.aparece_en_cercanos,
    permite_menu: flags.permite_menu,
    permite_especiales: flags.permite_especiales,
    permite_ordenes: flags.permite_ordenes,
  };
}

export function formatoPrecio(valor) {
  const num = toNumber(valor);
  if (!Number.isFinite(num)) return 'Gratis';
  if (num <= 0) return 'Gratis';
  return `$${num.toFixed(0)}`;
}
