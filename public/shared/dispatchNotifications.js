export async function triggerDispatchNotifications() {
  // El dispatcher corre exclusivamente mediante el schedule protegido de Netlify.
  // Se conserva esta función para no romper los callers existentes del frontend.
  return false;
}
