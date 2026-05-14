import { spawn } from 'node:child_process';
import path from 'node:path';
import { buildHeaders, createSupabaseAdmin, parseBody, requireAuthUser } from './otpShared.js';

const ALLOWED_ROLES = new Set(['admin', 'owner', 'superadmin', 'app_admin', 'app_owner', 'app_superadmin']);
const ALLOWED_SOURCES = new Set(['prticket', 'ticketera', 'pietix']);

const SCRIPT_BY_SOURCE = {
  prticket: [
    ['tools/scrapers/prticket/scrape_prticket.py'],
    ['tools/scrapers/prticket/sync_prticket_to_supabase.py'],
  ],
  ticketera: [
    ['tools/scrapers/ticketera/scrape_ticketera.py'],
    ['tools/scrapers/ticketera/sync_ticketera_to_supabase.py'],
  ],
  pietix: [
    ['tools/scrapers/pietix/scrape_pietix.py'],
    ['tools/scrapers/pietix/sync_pietix_to_supabase.py'],
  ],
};

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: buildHeaders({
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }),
    body: JSON.stringify(payload),
  };
}

function toRoleText(value) {
  return String(value || '').trim().toLowerCase();
}

async function resolveUserRole(supabaseAdmin, user) {
  const metaRole = toRoleText(user?.user_metadata?.rol_app || user?.app_metadata?.rol_app || user?.role);
  if (metaRole && ALLOWED_ROLES.has(metaRole)) return metaRole;

  const roleColumns = ['rol_app', 'rol', 'role'];
  for (const column of roleColumns) {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select(column)
      .eq('id', user?.id)
      .maybeSingle();

    if (error) continue;

    const resolvedRole = toRoleText(data?.[column]);
    if (resolvedRole) return resolvedRole;
  }

  return metaRole;
}

function runPythonScript(scriptRelativePath, cwd) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const scriptPath = path.resolve(cwd, scriptRelativePath);

    const child = spawn('python3', [scriptPath], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const maxLogs = 240000;

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > maxLogs) stdout = stdout.slice(-maxLogs);
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > maxLogs) stderr = stderr.slice(-maxLogs);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - startedAt;
      if (code !== 0) {
        const error = new Error(`Script falló (${scriptRelativePath}) con código ${code}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        error.duration_ms = durationMs;
        reject(error);
        return;
      }
      resolve({
        code,
        duration_ms: durationMs,
        stdout,
        stderr,
      });
    });
  });
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Método no permitido.' });
  }

  let body = parseBody(event);
  if (body === null) {
    return jsonResponse(400, { ok: false, error: 'Body JSON inválido.' });
  }
  body = body || {};

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const user = await requireAuthUser(event, supabaseAdmin);
    if (!user) return jsonResponse(401, { ok: false, error: 'No autorizado.' });

    const role = await resolveUserRole(supabaseAdmin, user);
    if (!ALLOWED_ROLES.has(role)) {
      return jsonResponse(403, { ok: false, error: 'Permisos insuficientes.' });
    }

    const requested = Array.isArray(body.sources) ? body.sources : ['prticket', 'ticketera', 'pietix'];
    const sources = requested
      .map((s) => String(s || '').trim().toLowerCase())
      .filter((s) => ALLOWED_SOURCES.has(s));

    if (!sources.length) {
      return jsonResponse(400, { ok: false, error: 'No se recibieron fuentes válidas.' });
    }

    const cwd = process.cwd();
    const results = [];
    const startedAt = Date.now();

    for (const source of sources) {
      const scripts = SCRIPT_BY_SOURCE[source] || [];
      const sourceResult = {
        source,
        ok: false,
        steps: [],
        duration_ms: 0,
      };
      const sourceStarted = Date.now();

      try {
        for (const [scriptRel] of scripts) {
          const out = await runPythonScript(scriptRel, cwd);
          sourceResult.steps.push({
            script: scriptRel,
            ok: true,
            duration_ms: out.duration_ms,
            stdout: out.stdout,
            stderr: out.stderr,
          });
        }
        sourceResult.ok = true;
      } catch (error) {
        sourceResult.steps.push({
          script: error?.message?.match(/\((.*?)\)/)?.[1] || 'unknown',
          ok: false,
          duration_ms: Number(error?.duration_ms || 0),
          stdout: String(error?.stdout || ''),
          stderr: String(error?.stderr || error?.message || ''),
        });
        sourceResult.error = String(error?.message || 'Error ejecutando scripts.');
      } finally {
        sourceResult.duration_ms = Date.now() - sourceStarted;
        results.push(sourceResult);
      }
    }

    const allOk = results.every((item) => item.ok);
    const totalDuration = Date.now() - startedAt;
    return jsonResponse(allOk ? 200 : 207, {
      ok: allOk,
      role,
      sources,
      duration_ms: totalDuration,
      results,
      mensaje: allOk
        ? 'Sincronización completada.'
        : 'Sincronización finalizada con errores parciales.',
    });
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: 'No se pudo ejecutar la sincronización de eventos.',
      detalle: String(error?.message || error),
    });
  }
}

