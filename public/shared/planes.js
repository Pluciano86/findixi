export * from './pkg/rules/planes.js';
import { resolverPlanComercio as resolverPlanBase } from './pkg/rules/planes.js';

// Authorized public-display pilot. Never grants ownership, admin access or orders.
export function resolverPlanComercio(comercio = {}) {
  const plan = resolverPlanBase(comercio);
  const esPilotoBahias = typeof window !== 'undefined'
    && window.location.hostname === 'test.findixi.com'
    && Number(comercio.id ?? comercio.idComercio ?? comercio.idcomercio) === 7;
  if (!esPilotoBahias) return plan;
  return { ...plan, permite_perfil: true, permite_menu: true };
}
