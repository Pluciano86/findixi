# Restaurant Experience — piloto Bahías

## Corrección vigente de Peter

Horarios y feriados: siempre leer Horarios en Supabase, no fuentes externas.
Se resolvió el pendiente 11AM/12PM dando prioridad al registro actual.
Pet Friendly: consultar comercioAmenidades/Amenidades al recomendar, no la copia
legada acepta_mascotas. No hay aún consumidor FE implementado.
Bahías: sillas altas sí, cambiador no, baño accesible sí, grupos grandes sí;
aforo máximo desconocido. Confirmación directa de Peter.
codigo_vestimenta: texto libre; N/A explícito significa no aplica, NULL pendiente.
No se asignó N/A a Bahías sin confirmación. Campo creado en DB, sin formulario aún.

## Campos adicionales para recomendaciones

Se añadieron 19 columnas: presupuesto mínimo/máximo por persona, moneda,
impuestos/propina incluidos y notas; opciones vegetarianas, veganas y sin gluten;
notas de alérgenos; acceso en silla de ruedas/baño accesible; grupos, tamaño máximo
y notas; ruido habitual; confirmación pendiente; fecha de verificación y revisión.
Todos los datos opcionales comienzan NULL; requiere_confirmar_datos comienza true.
Un plato barato no establece presupuesto por persona. Opciones sin gluten no
garantizan seguridad para celíacos/alergias. No se rellenan datos por inferencia.
Las amenidades, horarios, menús y productos existentes siguen siendo sus fuentes.
Campos de productos ya existentes: origen_catalogo, clover_item_id,
clover_merchant_id, disponible_clover, shopify_product_id, shopify_updated_at.
No se agregan integraciones externas ni se activan órdenes en esta fase.

Ficha `public.comercio_restaurante_experience`, 1:1 con `Comercios`.
Piloto interno: sin lectura/escritura anon o authenticated; RLS habilitado,
solo backend service_role. No cambia permisos, membresías, horarios ni perfiles.
No habilita automáticamente el Engine ni existe aún formulario de edición.

NULL = desconocido, nunca equivale a no. Arrays NULL = sin información.
Campos tipados por categoría: cocina/especialidades, desayuno/almuerzo/cena,
menú infantil/sillas altas/cambiador, mascotas/zona, reservas/canal, ambiente.
`fuentes` registra procedencia por grupo de campos y `pendientes` conflictos.
Cada actualización debe conservar procedencia y actualizar `actualizado_en`.

Bahías (ID 7): datos aportados por Peter el 2026-09-16. Reservas requeridas
reportadas de fuente turística sin corroboración directa: booleano queda NULL.
Horario reportado 11AM vs perfil 12PM: resolver antes de modificar horarios.
No inferir alergias, accesibilidad, precios vigentes o música en vivo hoy.

Relación de menú: ficha.comercio_id = menus.idComercio;
productos.idMenu = menus.id. Leer activos en ambos. No copiar precios a ficha.
Clover/Shopify futuros deben conservar IDs externos y autoridad del proveedor;
su incorporación no está implementada por esta migración.

Pendiente siguiente fase: formulario administrativo con autorización real,
validación y revisión de campos; después consumo por el Engine. Nunca publicar
el borrador mediante una política SELECT abierta. Separar datos públicos de notas.

Validación: perfil 7, 9 secciones/64 productos activos; booleanos desconocidos
NULL; permisos anon/authenticated denegados y service_role habilitado.
