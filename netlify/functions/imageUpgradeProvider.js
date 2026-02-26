function getNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createImageUpgradeProvider({ sharp }) {
  if (!sharp) {
    throw new Error('Sharp no disponible para Logo Upgrade.');
  }

  return {
    async optimizeLogo({ inputBuffer, rules = {}, demoMode = true }) {
      const minWidth = getNumber(rules.minWidth, 512);
      const minHeight = getNumber(rules.minHeight, 512);
      const canvasSize = Math.max(512, getNumber(rules.canvasSize, 1024));
      const marginPct = Math.max(0.04, Math.min(0.2, getNumber(rules.marginPct, 0.1)));
      const maxBytes = Math.max(200000, getNumber(rules.maxBytes, 1 * 1024 * 1024));

      const meta = await sharp(inputBuffer, { failOn: 'none' }).metadata();
      const width = Number(meta?.width || 0);
      const height = Number(meta?.height || 0);
      if (width < minWidth || height < minHeight) {
        return {
          ok: false,
          estado: 'requiere_accion',
          code: 'logo_low_resolution',
          nota: `Tu logo debe tener al menos ${minWidth}x${minHeight}px.`,
        };
      }

      const margin = Math.round(canvasSize * marginPct);
      const inner = Math.max(64, canvasSize - margin * 2);
      const qualitySteps = [88, 82, 76, 70, 64, 58];

      let selected = null;
      for (const quality of qualitySteps) {
        const candidate = await sharp(inputBuffer, { failOn: 'none' })
          .rotate()
          .flatten({ background: '#ffffff' })
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

        if (candidate.length <= maxBytes) {
          selected = candidate;
          break;
        }
      }

      if (!selected) {
        return {
          ok: false,
          estado: 'requiere_accion',
          code: 'logo_upgrade_too_heavy',
          nota: 'No pudimos optimizar este archivo. Sube otra versión del logo.',
        };
      }

      return {
        ok: true,
        estado: 'upgrade_listo',
        nota: demoMode
          ? 'Logo Upgrade completado en modo demo. Revisa el resultado y continúa.'
          : 'Logo Upgrade completado.',
        outputBuffer: selected,
        outputMime: 'image/webp',
        outputExt: 'webp',
      };
    },
  };
}

