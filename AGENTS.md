# AGENTS.md – Configuración del proyecto APP_ENPR

## 🎯 Objetivo
Este proyecto está dividido en 3 aplicaciones principales más una carpeta compartida.  
Tu tarea como agente es mantener esta estructura organizada, revisar que los archivos estén en su lugar, y actualizar rutas (`import` y `<script>`) cuando sea necesario.

---

## 📂 Estructura del Proyecto

### 1. Administración (/admin)
- Para uso mío y de editores autorizados.
- Contiene:
  - `crearComercio.html`, `editarComercio.html`, `listadoComercios.html`
  - Archivos JS:  
    - `adminLogoComercio.js`  
    - `adminGaleriaComercio.js`  
    - `adminHorarioComercio.js`  
    - `adminAmenidadesComercio.js`  
    - `adminCategoriasComercio.js`  
    - `adminEditarComercio.js`
- Aquí estarán el dashboard y módulos de gestión (menús, especiales, etc.)

### 2. Comercio (/comercio)
- Panel limitado para dueños de comercios.
- Permite editar **solo su propio comercio** (logo, horarios, redes, menú, especiales, etc.)
- No debe tener acceso al resto de la administración.

### 3. Aplicación pública (/public)
- Lo que ve el usuario final.
- Contiene:
  - `index.html`, `listadoComercios.html`, `perfilComercio.html`
  - Archivos JS:  
    - `main.js`  
    - `CardComercio.js`  
    - `galeria.js`  
    - `footer.js`  
    - `cercaDeComercio.js`

### 4. Compartido (/shared)
- Archivos comunes para todas las apps.
- Contiene:
  - `supabaseClient.js`  
  - Funciones utilitarias (ej. distancia en vehículo, formateo de horarios).

---

## ✅ Responsabilidades del agente
1. Verificar que la estructura de carpetas se respete.  
2. Actualizar imports y `<script>` para que apunten a las rutas correctas.  
3. Mantener la lógica modular y organizada (cada parte en su carpeta correspondiente).  
4. Sugerir plan de migración si algún archivo no está en la ubicación correcta.  
5. No modificar la lógica de negocio sin instrucciones explícitas.  

---

## 🚀 Prioridad actual
- Validar que **/admin, /comercio y /public** funcionen en conjunto con **/shared**.  
- Corregir paths de archivos si es necesario.  
- Mantener el panel administrativo estable (crear, editar, listar comercios).  