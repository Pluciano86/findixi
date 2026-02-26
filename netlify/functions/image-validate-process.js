import { APP_CONFIG, isDemoPaymentsMode } from './appConfig.js';
import { buildHeaders, createSupabaseAdmin, jsonResponse, parseBody, requireAuthUser } from './otpShared.js';
import { createImageUpgradeProvider } from './imageUpgradeProvider.js';

const BUCKET = 'galeriacomercios';
const LOGO_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const PORTADA_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const RULES = {
  logo: {
    maxBytes: 1 * 1024 * 1024,
    maxInputBytes: 8 * 1024 * 1024,
    minWidth: 512,
    minHeight: 512,
    canvasSize: 1024,
    marginPct: 0.1,
  },
  portada: {
    maxBytes: 2 * 1024 * 1024,
    maxInputBytes: 10 * 1024 * 1024,
    minWidth: 1200,
    minHeight: 630,
    targetWidth: 1600,
    targetHeight: 900,
  },
};

function sanitizeType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'logo' || normalized === 'portada' ? normalized : '';
}

function sanitizeMode(value) {
  const normalized = String(value || 'validate').trim().toLowerCase();
  if (normalized === 'upgrade_demo') return 'upgrade_demo';
  return 'validate';
}

function inferExtByMime(mime = '') {
  const normalized = String(mime || '').toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  return 'bin';
}

function parseBase64Input(rawInput) {
  const raw = String(rawInput || '').trim();
  if (!raw) return null;

  let mimeType = '';
  let base64Body = raw;
  const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.+)$/s);
  if (dataUrlMatch) {
    mimeType = String(dataUrlMatch[1] || '').toLowerCase();
    base64Body = dataUrlMatch[2] || '';
  }

  try {
    const buffer = Buffer.from(base64Body, 'base64');
    if (!buffer?.length) return null;
    return { buffer, mimeType };
  } catch (_error) {
    return null;
  }
}

function getPublicUrl(supabaseAdmin, path) {
  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl || null;
}

function buildStoragePath({ idComercio, type, flavor = 'original', ext = 'bin' }) {
  const stamp = Date.now();
  return `branding/comercios/${idComercio}/${type}/${flavor}-${stamp}.${ext}`;
}

async function loadSharp() {
  const mod = await import('sharp');
  return mod.default || mod;
}

async function uploadToStorage({ supabaseAdmin, path, buffer, contentType }) {
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    upsert: true,
    contentType,
    cacheControl: '3600',
  });
  if (error) throw error;
}

async function analyzeBackgroundHeuristic({ sharp, buffer }) {
  const image = sharp(buffer, { failOn: 'none' }).rotate().ensureAlpha();
  const [stats, sample] = await Promise.all([
    image.stats(),
    image.resize(96, 96, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true }),
  ]);

  const alphaStats = stats?.channels?.[3] || null;
  const hasTransparency = Boolean(alphaStats && alphaStats.min < 250);

  const pixels = sample?.data || Buffer.alloc(0);
  const channels = sample?.info?.channels || 4;
  const width = sample?.info?.width || 96;
  const height = sample?.info?.height || 96;

  const borderValues = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!(x === 0 || y === 0 || x === width - 1 || y === height - 1)) continue;
      const idx = (y * width + x) * channels;
      const r = pixels[idx] ?? 255;
      const g = pixels[idx + 1] ?? 255;
      const b = pixels[idx + 2] ?? 255;
      const alpha = pixels[idx + 3] ?? 255;
      if (alpha < 25) continue;
      borderValues.push((r + g + b) / 3);
    }
  }

  const avgBorder = borderValues.length
    ? borderValues.reduce((sum, value) => sum + value, 0) / borderValues.length
    : 255;
  const minBorder = borderValues.length ? Math.min(...borderValues) : 255;
  const whiteDominant = avgBorder >= 232 && minBorder >= 205;

  let foregroundCount = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  const luminanceAt = (idx) => {
    const r = pixels[idx] ?? 255;
    const g = pixels[idx + 1] ?? 255;
    const b = pixels[idx + 2] ?? 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels;
      const alpha = pixels[idx + 3] ?? 255;
      if (alpha < 25) continue;
      const luminance = luminanceAt(idx);
      if (luminance < 244) {
        foregroundCount += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  let minMarginRatio = 1;
  if (maxX >= 0 && maxY >= 0) {
    const left = minX;
    const right = width - 1 - maxX;
    const top = minY;
    const bottom = height - 1 - maxY;
    minMarginRatio = Math.max(0, Math.min(left, right, top, bottom) / Math.max(1, width - 1));
  }

  const contentAreaRatio = foregroundCount / Math.max(1, width * height);

  let highDiff = 0;
  let totalDiffPairs = 0;
  let darkPixels = 0;
  let binaryTransitions = 0;
  for (let y = 0; y < height; y += 1) {
    let prevBinary = 0;
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels;
      const currentLum = luminanceAt(idx);
      const binary = currentLum < 165 ? 1 : 0;
      if (binary) darkPixels += 1;
      if (x > 0 && binary !== prevBinary) binaryTransitions += 1;
      prevBinary = binary;

      if (x + 1 < width) {
        const rightIdx = (y * width + (x + 1)) * channels;
        const rightLum = luminanceAt(rightIdx);
        if (Math.abs(currentLum - rightLum) > 35) highDiff += 1;
        totalDiffPairs += 1;
      }
      if (y + 1 < height) {
        const downIdx = ((y + 1) * width + x) * channels;
        const downLum = luminanceAt(downIdx);
        if (Math.abs(currentLum - downLum) > 35) highDiff += 1;
        totalDiffPairs += 1;
      }
    }
  }
  const edgeRatio = totalDiffPairs ? highDiff / totalDiffPairs : 0;
  const likelyFlyer =
    !hasTransparency &&
    !whiteDominant &&
    contentAreaRatio > 0.52 &&
    edgeRatio > 0.28;
  const darkRatio = darkPixels / Math.max(1, width * height);
  const transitionDensity = binaryTransitions / Math.max(1, height * (width - 1));
  const textHeavyLikely =
    !hasTransparency &&
    contentAreaRatio > 0.58 &&
    darkRatio > 0.5 &&
    transitionDensity > 0.3 &&
    edgeRatio > 0.27;

  return {
    hasTransparency,
    whiteDominant,
    avgBorder: Math.round(avgBorder),
    minBorder: Math.round(minBorder),
    minMarginRatio: Number(minMarginRatio.toFixed(3)),
    contentAreaRatio: Number(contentAreaRatio.toFixed(3)),
    edgeRatio: Number(edgeRatio.toFixed(3)),
    darkRatio: Number(darkRatio.toFixed(3)),
    transitionDensity: Number(transitionDensity.toFixed(3)),
    textHeavyLikely,
    likelyFlyer,
  };
}

async function optimizeLogo({ sharp, inputBuffer, allowComplexBackground = false, upgradeMode = false }) {
  const rule = RULES.logo;
  const meta = await sharp(inputBuffer, { failOn: 'none' }).metadata();
  const width = Number(meta?.width || 0);
  const height = Number(meta?.height || 0);
  const inputFormat = String(meta?.format || '').toLowerCase();
  const isPngInput = inputFormat === 'png';

  if (width < rule.minWidth || height < rule.minHeight) {
    return {
      ok: false,
      estado: 'requiere_accion',
      code: 'logo_low_resolution',
      nota: `Tu logo debe tener al menos ${rule.minWidth}x${rule.minHeight}px.`,
    };
  }

  const bg = await analyzeBackgroundHeuristic({ sharp, buffer: inputBuffer });
  if (isPngInput && !bg.whiteDominant) {
    return {
      ok: false,
      estado: 'requiere_accion',
      code: 'logo_png_background_must_be_white',
      nota:
        'Si subes el logo en PNG, el fondo debe ser blanco. Sube una versión con fondo blanco o usa otro formato.',
      diagnostico: bg,
    };
  }
  if (bg.textHeavyLikely) {
    return {
      ok: false,
      estado: 'requiere_accion',
      code: 'logo_text_excessive',
      nota:
        'Detectamos demasiado texto en el logo. Usa una versión más limpia (símbolo o texto breve) para aprobarlo.',
      diagnostico: bg,
    };
  }
  if (!bg.hasTransparency && !bg.whiteDominant && !allowComplexBackground) {
    return {
      ok: false,
      estado: 'requiere_accion',
      code: 'logo_background_not_allowed',
      nota:
        'El logo parece tener un fondo de color/textura. Sube otro archivo con fondo blanco o transparente.',
      diagnostico: bg,
    };
  }

  if (bg.likelyFlyer && !allowComplexBackground) {
    return {
      ok: false,
      estado: 'requiere_accion',
      code: 'logo_possible_flyer',
      nota: 'Parece una imagen promocional/flyer. Para mejor resultado sube un logo limpio o usa Logo Upgrade.',
      diagnostico: bg,
    };
  }

  const margin = Math.round(rule.canvasSize * rule.marginPct);
  const inner = Math.max(64, rule.canvasSize - margin * 2);
  let base = sharp(inputBuffer, { failOn: 'none' }).rotate();
  if (bg.hasTransparency) {
    base = base.flatten({ background: '#ffffff' });
  }

  const qualitySteps = [88, 82, 76, 70, 64, 58];
  let selected = null;
  for (const quality of qualitySteps) {
    const candidate = await base
      .resize(inner, inner, { fit: 'contain', background: '#ffffff' })
      .extend({
        top: margin,
        bottom: margin,
        left: margin,
        right: margin,
        background: '#ffffff',
      })
      .webp({ quality, effort: 5 })
      .toBuffer();

    if (candidate.length <= rule.maxBytes) {
      selected = candidate;
      break;
    }
  }

  if (!selected) {
    return {
      ok: false,
      estado: 'requiere_accion',
      code: 'logo_too_heavy',
      nota: 'No pudimos optimizar el peso del logo dentro del límite de 1MB. Sube otra versión.',
    };
  }

  return {
    ok: true,
    estado: upgradeMode ? 'upgrade_listo' : 'aprobado',
    nota: upgradeMode
      ? 'Logo Upgrade completado en modo demo. Revisa el resultado y continúa.'
      : 'Logo validado y optimizado automáticamente.',
    outputBuffer: selected,
    outputMime: 'image/webp',
    outputExt: 'webp',
    diagnostico: bg,
  };
}

async function optimizePortada({ sharp, inputBuffer }) {
  const rule = RULES.portada;
  const meta = await sharp(inputBuffer, { failOn: 'none' }).metadata();
  const width = Number(meta?.width || 0);
  const height = Number(meta?.height || 0);

  if (width < rule.minWidth || height < rule.minHeight) {
    return {
      ok: false,
      estado: 'requiere_accion',
      code: 'portada_low_resolution',
      nota: `La portada debe tener al menos ${rule.minWidth}x${rule.minHeight}px.`,
    };
  }

  const qualitySteps = [86, 80, 74, 68, 62, 56];
  let selected = null;
  for (const quality of qualitySteps) {
    const candidate = await sharp(inputBuffer, { failOn: 'none' })
      .rotate()
      .resize(rule.targetWidth, rule.targetHeight, { fit: 'cover', position: 'centre' })
      .webp({ quality, effort: 5 })
      .toBuffer();

    if (candidate.length <= rule.maxBytes) {
      selected = candidate;
      break;
    }
  }

  if (!selected) {
    return {
      ok: false,
      estado: 'requiere_accion',
      code: 'portada_too_heavy',
      nota: 'No pudimos optimizar la portada dentro del límite de 2MB. Sube otra versión.',
    };
  }

  return {
    ok: true,
    estado: 'aprobado',
    nota: 'Portada validada y optimizada automáticamente.',
    outputBuffer: selected,
    outputMime: 'image/webp',
    outputExt: 'webp',
  };
}

async function optimizeLogoWithUpgradeAdapter({ sharp, inputBuffer }) {
  try {
    const meta = await sharp(inputBuffer, { failOn: 'none' }).metadata();
    const inputFormat = String(meta?.format || '').toLowerCase();
    const isPngInput = inputFormat === 'png';
    const bg = await analyzeBackgroundHeuristic({ sharp, buffer: inputBuffer });
    if (isPngInput && !bg.whiteDominant) {
      return {
        ok: false,
        estado: 'requiere_accion',
        code: 'logo_png_background_must_be_white',
        nota:
          'Si subes el logo en PNG, el fondo debe ser blanco. Sube una versión con fondo blanco o usa otro formato.',
      };
    }
    if (bg.textHeavyLikely) {
      return {
        ok: false,
        estado: 'requiere_accion',
        code: 'logo_text_excessive',
        nota:
          'Detectamos demasiado texto en el logo. Usa una versión más limpia (símbolo o texto breve) para aprobarlo.',
      };
    }
    const provider = createImageUpgradeProvider({ sharp });
    const result = await provider.optimizeLogo({
      inputBuffer,
      rules: RULES.logo,
      demoMode: isDemoPaymentsMode,
    });
    if (result?.ok) return result;

    return {
      ok: false,
      estado: 'requiere_accion',
      code: result?.code || 'logo_upgrade_failed',
      nota: result?.nota || 'No pudimos optimizar este archivo. Sube otra versión del logo.',
    };
  } catch (error) {
    console.warn('[image-validate-process] Logo Upgrade adapter error', error?.message || error);
    return {
      ok: false,
      estado: 'requiere_accion',
      code: 'logo_upgrade_failed',
      nota: 'No pudimos optimizar este archivo. Sube otra versión del logo.',
    };
  }
}

async function canUserManageComercio(supabaseAdmin, { idComercio, userId }) {
  const { data: comercio, error: comercioError } = await supabaseAdmin
    .from('Comercios')
    .select('id, owner_user_id, plan_nivel, plan_nombre')
    .eq('id', idComercio)
    .maybeSingle();
  if (comercioError) throw comercioError;
  if (!comercio) return { ok: false, reason: 'not_found' };

  if (comercio.owner_user_id && comercio.owner_user_id === userId) {
    return { ok: true, comercio };
  }

  const { data: relation, error: relationError } = await supabaseAdmin
    .from('UsuarioComercios')
    .select('idUsuario, idComercio, rol')
    .eq('idUsuario', userId)
    .eq('idComercio', idComercio)
    .limit(1)
    .maybeSingle();
  if (relationError) throw relationError;
  if (!relation) return { ok: false, reason: 'forbidden' };

  return { ok: true, comercio };
}

function buildLogoUpgradeModeForResponse(comercio) {
  const nivel = Number(comercio?.plan_nivel || 0);
  if (nivel >= 1) return 'incluido';
  return 'pago_basic';
}

function buildLogoUpgradeOffer(comercio) {
  const mode = buildLogoUpgradeModeForResponse(comercio);
  const price = mode === 'pago_basic' ? Number(APP_CONFIG.LOGO_UPGRADE_PRICE_BASIC || 25) : 0;
  return {
    mode,
    price,
    demo: isDemoPaymentsMode,
    label: mode === 'pago_basic' ? `$${price.toFixed(2)} (modo demo)` : 'Incluido en tu plan',
  };
}

async function syncImagenesComercio({
  supabaseAdmin,
  idComercio,
  type,
  imagePath,
}) {
  const flagColumn = type === 'logo' ? 'logo' : 'portada';
  const otherFlag = type === 'logo' ? 'portada' : 'logo';

  try {
    const { data: existing, error: findError } = await supabaseAdmin
      .from('imagenesComercios')
      .select('id')
      .eq('idComercio', idComercio)
      .eq(flagColumn, true)
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;

    if (existing?.id) {
      const { error: updateError } = await supabaseAdmin
        .from('imagenesComercios')
        .update({ imagen: imagePath })
        .eq('id', existing.id);
      if (updateError) throw updateError;
      return;
    }

    const { error: insertError } = await supabaseAdmin
      .from('imagenesComercios')
      .insert({
        idComercio,
        imagen: imagePath,
        [flagColumn]: true,
        [otherFlag]: false,
      });
    if (insertError) throw insertError;
  } catch (error) {
    console.warn(`[image-validate-process] No se pudo sincronizar imagenesComercios (${type})`, error?.message || error);
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

  const idComercio = Number(body.idComercio || 0);
  const type = sanitizeType(body.type);
  const mode = sanitizeMode(body.mode);

  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    return jsonResponse(400, { error: 'idComercio inválido.' });
  }
  if (!type) return jsonResponse(400, { error: 'type debe ser "logo" o "portada".' });
  if (!APP_CONFIG.IMAGE_VALIDATION_ENABLED) {
    return jsonResponse(503, { error: 'Validación de imágenes deshabilitada temporalmente.' });
  }

  const parsed = parseBase64Input(body.file_base64 || body.fileBase64 || '');
  if (!parsed) return jsonResponse(400, { error: 'No se pudo leer el archivo base64.' });

  const declaredMime = String(body.mime_type || body.mimeType || parsed.mimeType || '').toLowerCase();
  const allowedSet = type === 'logo' ? LOGO_ALLOWED_MIME : PORTADA_ALLOWED_MIME;
  if (declaredMime && !allowedSet.has(declaredMime)) {
    return jsonResponse(400, { error: `Formato no permitido para ${type}.` });
  }

  const rules = RULES[type];
  if (parsed.buffer.length > rules.maxInputBytes) {
    return jsonResponse(400, {
      error: `El archivo es demasiado grande para procesar. Máximo ${Math.round(rules.maxInputBytes / 1024 / 1024)}MB.`,
    });
  }

  try {
    const sharp = await loadSharp();
    const supabaseAdmin = createSupabaseAdmin();
    const user = await requireAuthUser(event, supabaseAdmin);
    if (!user) return jsonResponse(401, { error: 'No autorizado.' });

    const permission = await canUserManageComercio(supabaseAdmin, { idComercio, userId: user.id });
    if (!permission.ok) {
      if (permission.reason === 'not_found') return jsonResponse(404, { error: 'Comercio no encontrado.' });
      return jsonResponse(403, { error: 'No tienes permisos para actualizar este comercio.' });
    }

    const isUpgradeDemoLogo = type === 'logo' && mode === 'upgrade_demo';
    if (isUpgradeDemoLogo && !APP_CONFIG.IMAGE_UPGRADE_ENABLED) {
      return jsonResponse(503, { error: 'Logo Upgrade está deshabilitado temporalmente.' });
    }

    const optimizeResult =
      type === 'logo'
        ? isUpgradeDemoLogo
          ? await optimizeLogoWithUpgradeAdapter({ sharp, inputBuffer: parsed.buffer })
          : await optimizeLogo({
              sharp,
              inputBuffer: parsed.buffer,
              allowComplexBackground: false,
              upgradeMode: false,
            })
        : await optimizePortada({ sharp, inputBuffer: parsed.buffer });

    const originalExt = inferExtByMime(declaredMime || parsed.mimeType || '');
    const originalPath = buildStoragePath({ idComercio, type, flavor: 'original', ext: originalExt });
    await uploadToStorage({
      supabaseAdmin,
      path: originalPath,
      buffer: parsed.buffer,
      contentType: declaredMime || parsed.mimeType || 'application/octet-stream',
    });
    const originalUrl = getPublicUrl(supabaseAdmin, originalPath);

    let processedPath = null;
    let processedUrl = null;
    if (optimizeResult.ok && optimizeResult.outputBuffer) {
      processedPath = buildStoragePath({
        idComercio,
        type,
        flavor: 'procesado',
        ext: optimizeResult.outputExt || 'webp',
      });
      await uploadToStorage({
        supabaseAdmin,
        path: processedPath,
        buffer: optimizeResult.outputBuffer,
        contentType: optimizeResult.outputMime || 'image/webp',
      });
      processedUrl = getPublicUrl(supabaseAdmin, processedPath);
    }

    const isLogo = type === 'logo';
    const logoUpgradeOffer = buildLogoUpgradeOffer(permission.comercio);
    const updatePayload = isLogo
      ? {
          logo_url_original: originalUrl,
          logo_url_procesado: processedUrl,
          logo_estado: optimizeResult.estado,
          logo_aprobado: Boolean(optimizeResult.ok),
          logo_revision_notas: optimizeResult.nota || null,
          ...(isUpgradeDemoLogo
            ? {
                logo_upgrade_usado: Boolean(optimizeResult.ok),
                logo_upgrade_modo: optimizeResult.ok ? 'demo' : null,
                logo_upgrade_precio: logoUpgradeOffer.mode === 'pago_basic' ? logoUpgradeOffer.price : 0,
                logo_upgrade_aprobado_por_usuario: Boolean(optimizeResult.ok),
                logo_upgrade_fecha: optimizeResult.ok ? new Date().toISOString() : null,
                pago_estado_demo: optimizeResult.ok ? 'demo_aprobado' : 'demo_pendiente',
              }
            : {}),
          ...(optimizeResult.ok ? { logo: processedUrl } : {}),
        }
      : {
          portada_url_original: originalUrl,
          portada_url_procesado: processedUrl,
          portada_estado: optimizeResult.estado,
          portada_aprobada: Boolean(optimizeResult.ok),
          ...(optimizeResult.ok ? { portada: processedUrl } : {}),
        };

    const { error: updateError } = await supabaseAdmin
      .from('Comercios')
      .update(updatePayload)
      .eq('id', idComercio);
    if (updateError) throw updateError;

    if (optimizeResult.ok && processedPath) {
      await syncImagenesComercio({
        supabaseAdmin,
        idComercio,
        type,
        imagePath: processedPath,
      });
    }

    return jsonResponse(200, {
      ok: true,
      type,
      estado: optimizeResult.estado,
      aprobado: Boolean(optimizeResult.ok),
      nota: optimizeResult.nota || null,
      logo_upgrade_offer: isLogo ? logoUpgradeOffer : null,
      payments_mode: APP_CONFIG.PAYMENTS_MODE,
      demo_mode: isDemoPaymentsMode,
      mode,
      original_url: originalUrl,
      procesado_url: processedUrl,
      diagnostico: optimizeResult.diagnostico || null,
    });
  } catch (error) {
    console.error('[image-validate-process] error', error);
    return jsonResponse(500, {
      error: 'No se pudo procesar la imagen.',
      detalle: error?.message || String(error),
    });
  }
};
