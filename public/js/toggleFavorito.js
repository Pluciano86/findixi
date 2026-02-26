import { supabase } from '../shared/supabaseClient.js';
import { t } from './i18n.js';
import { requireAuth } from './authGuard.js';

document.addEventListener('DOMContentLoaded', async () => {
  const btn = document.getElementById('btnFavorito');
  const icono = btn?.querySelector('i');
  const texto = btn?.querySelector('span');
  const idComercio = new URLSearchParams(window.location.search).get('id');
  let usuarioId = null;
  let esFavorito = false;

  if (!btn || !idComercio) return;

  async function sincronizarEstadoFavorito() {
    if (!usuarioId) {
      esFavorito = false;
      actualizarUI();
      return;
    }
    const { data, error } = await supabase
      .from('favoritosusuarios')
      .select('id')
      .eq('idusuario', usuarioId)
      .eq('idcomercio', parseInt(idComercio, 10))
      .maybeSingle();
    if (error) {
      console.error('❌ Error verificando favorito:', error.message);
      return;
    }
    esFavorito = !!data;
    actualizarUI();
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      usuarioId = user.id;
      await sincronizarEstadoFavorito();
    } else {
      actualizarUI();
    }
  } catch (error) {
    console.warn('⚠️ No se pudo obtener el usuario actual:', error?.message);
    actualizarUI();
  }

  // Toggle favorito
  btn.addEventListener('click', async () => {
    if (!usuarioId) {
      try {
        const user = await requireAuth('favoriteCommerce');
        if (!user?.id) return;
        usuarioId = user.id;
        await sincronizarEstadoFavorito();
      } catch {
        return;
      }
    }

    if (esFavorito) {
      const { error } = await supabase
        .from('favoritosusuarios')
        .delete()
        .eq('idusuario', usuarioId)
        .eq('idcomercio', parseInt(idComercio));

      if (!error) {
        esFavorito = false;
        actualizarUI();
      } else {
        console.error('❌ Error eliminando favorito:', error.message);
      }
    } else {
      const { error } = await supabase
        .from('favoritosusuarios')
        .insert([
          { idusuario: usuarioId, idcomercio: parseInt(idComercio) }
        ]);

      if (!error) {
        esFavorito = true;
        actualizarUI();
      } else {
        console.error('❌ Error insertando favorito:', error.message);
        alert('Hubo un problema al añadir este comercio a favoritos.');
      }
    }
  });

  function actualizarUI() {
    if (!icono || !texto) return;

    if (esFavorito) {
      icono.className = 'fas fa-heart text-5xl mb-1 text-red-600 animate-bounce';
      texto.textContent = t('perfilComercio.miFavorito');
      texto.classList.add('text-red-600');
    } else {
      icono.className = 'far fa-heart text-5xl mb-1 text-gray-600';
      texto.innerHTML = `${t('perfilComercio.addFavoritoLine1')}<br>${t('perfilComercio.addFavoritoLine2')}`;
      texto.classList.remove('text-red-600');
    }
  }

  window.addEventListener('lang:changed', actualizarUI);
});
