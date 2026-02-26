// especialesDiarios.js
const titulo = document.getElementById('tituloEspeciales');
const subtitulo = document.getElementById('subtituloDia');

const ahora = new Date();
const horaActual = ahora.getHours() + ahora.getMinutes() / 60;
const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const dia = diasSemana[ahora.getDay()];

const esAlmuerzo = horaActual >= 2 && horaActual < 15.5;

if (titulo) {
  titulo.innerHTML = esAlmuerzo
    ? `<i class="fas fa-utensils text-[#3ea6c4]"></i> Almuerzo`
    : `<i class="fas fa-glass-cheers text-pink-500"></i> Happy Hour`;
}

if (subtitulo) {
  subtitulo.textContent = `para Hoy ${dia}`;
}