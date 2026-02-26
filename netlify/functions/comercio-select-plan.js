import { APP_CONFIG, isDemoPaymentsMode } from './appConfig.js';
import { buildHeaders, createSupabaseAdmin, jsonResponse, parseBody, requireAuthUser } from './otpShared.js';

const PLAN_DEFAULTS = {
  0: { nombre: 'Findixi Basic', precio: 0 },
  1: { nombre: 'Findixi Regular', precio: 65 },
  2: { nombre: 'Findixi Plus', precio: 95 },
  3: { nombre: 'Findixi Premium', precio: 155 },
};

function clampPlanNivel(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(3, Math.round(parsed)));
}

function toRoleText(value) {
  return String(value || '').trim().toLowerCase();
}

function buildPlanFlags(nivel) {
  return {
    permite_perfil: nivel >= 1,
    aparece_en_cercanos: nivel >= 1,
    permite_menu: nivel >= 2,
    permite_especiales: nivel >= 2,
    permite_ordenes: nivel >= 3,
  };
}

async function canManagePlan(supabaseAdmin, { idComercio, userId }) {
  const { data: comercio, error: comercioError } = await supabaseAdmin
    .from('Comercios')
    .select('id, nombre, owner_user_id, plan_nivel, plan_nombre, plan_id')
    .eq('id', idComercio)
    .maybeSingle();

  if (comercioError) throw comercioError;
  if (!comercio) return { ok: false, reason: 'not_found' };

  if (comercio.owner_user_id && comercio.owner_user_id === userId) {
    return { ok: true, comercio };
  }

  const { data: relation, error: relationError } = await supabaseAdmin
    .from('UsuarioComercios')
    .select('rol')
    .eq('idUsuario', userId)
    .eq('idComercio', idComercio)
    .limit(1)
    .maybeSingle();

  if (relationError) throw relationError;
  const rol = toRoleText(relation?.rol);
  if (!rol.includes('admin')) return { ok: false, reason: 'forbidden' };

  return { ok: true, comercio };
}

async function resolvePlanCatalogInfo(supabaseAdmin, nivel) {
  try {
    const { data, error } = await supabaseAdmin
      .from('planes')
      .select('id, nombre, nivel, plan_nivel, precio, plan_precio, activo')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (error) throw error;
    const row = (Array.isArray(data) ? data : []).find((plan) => {
      const rowNivel = clampPlanNivel(plan?.nivel ?? plan?.plan_nivel ?? 0);
      return rowNivel === nivel;
    });
    if (!row) return { ...PLAN_DEFAULTS[nivel], id: null };

    return {
      id: row.id ?? null,
      nombre: String(row.nombre || PLAN_DEFAULTS[nivel]?.nombre || 'Findixi Plan').trim(),
      precio: Number(row.precio ?? row.plan_precio ?? PLAN_DEFAULTS[nivel]?.precio ?? 0) || 0,
    };
  } catch (_error) {
    return { ...PLAN_DEFAULTS[nivel], id: null };
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: buildHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido. Usa POST.' });
  }

  const body = parseBody(event);
  if (body === null) return jsonResponse(400, { error: 'Body inválido.' });

  const idComercio = Number(body.idComercio || body.id_comercio || 0);
  const nivel = clampPlanNivel(body.plan_nivel ?? body.planNivel ?? body.nivel);
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    return jsonResponse(400, { error: 'idComercio inválido.' });
  }

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const user = await requireAuthUser(event, supabaseAdmin);
    if (!user) return jsonResponse(401, { error: 'No autorizado.' });

    const permission = await canManagePlan(supabaseAdmin, { idComercio, userId: user.id });
    if (!permission.ok) {
      if (permission.reason === 'not_found') return jsonResponse(404, { error: 'Comercio no encontrado.' });
      return jsonResponse(403, { error: 'No tienes permisos para actualizar el plan.' });
    }

    const planInfo = await resolvePlanCatalogInfo(supabaseAdmin, nivel);
    const planNombre = String(body.plan_nombre || body.planNombre || planInfo.nombre || '').trim() || planInfo.nombre;
    const planPrecio = Number(planInfo.precio || 0);
    const isPaidPlan = nivel > 0;

    if (isPaidPlan && !isDemoPaymentsMode) {
      return jsonResponse(402, {
        ok: false,
        code: 'payments_required',
        error: 'Este cambio requiere pago real. PAYMENTS_MODE está en live y la pasarela aún no está habilitada.',
        payments_mode: APP_CONFIG.PAYMENTS_MODE,
      });
    }

    const updatePayload = {
      plan_id: planInfo.id,
      plan_nivel: nivel,
      plan_nombre: planNombre,
      ...buildPlanFlags(nivel),
    };

    if (isPaidPlan && isDemoPaymentsMode) {
      updatePayload.pago_estado_demo = 'demo_aprobado';
      updatePayload.plan_status = 'demo_aprobado';
    }

    const { error: updateError } = await supabaseAdmin
      .from('Comercios')
      .update(updatePayload)
      .eq('id', idComercio);
    if (updateError) throw updateError;

    return jsonResponse(200, {
      ok: true,
      idComercio,
      plan_nivel: nivel,
      plan_nombre: planNombre,
      plan_precio: planPrecio,
      payments_mode: APP_CONFIG.PAYMENTS_MODE,
      demo_mode: isDemoPaymentsMode,
      message:
        isPaidPlan && isDemoPaymentsMode
          ? `Plan actualizado en modo demo. Se simuló un cobro de $${planPrecio.toFixed(2)} sin cargo real.`
          : 'Plan actualizado.',
    });
  } catch (error) {
    console.error('[comercio-select-plan] error', error);
    return jsonResponse(500, {
      error: 'No se pudo actualizar el plan.',
      detalle: error?.message || String(error),
    });
  }
};

