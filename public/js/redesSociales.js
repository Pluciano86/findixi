// redesSociales.js - pendiente de implementar
import { supabase } from '../shared/supabaseClient.js';

const idComercio = new URLSearchParams(window.location.search).get('id');

async function cargarRedesSociales() {
  const { data, error } = await supabase
    .from('Comercios')
    .select('facebook, instagram, tiktok, whatsapp, email, webpage')
    .eq('id', idComercio)
    .maybeSingle();

  if (error || !data) {
    console.error('Error cargando redes sociales:', error);
    return;
  }

  const redesContainer = document.querySelector('.flex.justify-center.gap-3.mb-6');
  redesContainer.innerHTML = ''; // limpiar contenido previo

  const redes = [
    { campo: 'facebook', src: 'logoFacebook.png', alt: 'Facebook' },
    { campo: 'instagram', src: 'logoInsta.png', alt: 'Instagram' },
    { campo: 'tiktok', src: 'logoTikTok.png', alt: 'TikTok' },
    { campo: 'whatsapp', src: 'logoWhatsApp.png', alt: 'WhatsApp', prefix: 'https://wa.me/' },
    { campo: 'email', src: 'logoEmail.png', alt: 'Email', prefix: 'mailto:' },
    { campo: 'webpage', src: 'logoWeb.png', alt: 'Web' }
  ];

  redes.forEach(({ campo, src, alt, prefix = '' }) => {
    const valor = data[campo];
    if (valor && valor.trim() !== '') {
      const a = document.createElement('a');
      a.href = prefix + valor.trim();
      a.target = '_blank';
      a.className = 'w-10 h-10';

      const img = document.createElement('img');
      img.src = `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios//${src}`;
      img.alt = alt;

      a.appendChild(img);
      redesContainer.appendChild(a);
    }
  });
}

cargarRedesSociales();