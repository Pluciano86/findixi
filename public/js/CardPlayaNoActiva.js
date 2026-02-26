import { buildPlayaCard } from './CardPlaya.js';

export function cardPlayaNoActiva(playa) {
  const card = buildPlayaCard(playa);
  card.classList.add('relative', 'opacity-80', 'pointer-events-none');

  const overlay = document.createElement('div');
  overlay.className =
    'absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white font-semibold tracking-wide text-sm uppercase';
  overlay.innerHTML = `
    <span class="mb-1 text-base">No disponible</span>
    <span class="text-xs font-normal">Próximamente</span>
  `;

  card.appendChild(overlay);
  return card;
}
