# DICORMS Móvil — App Móvil Flutter (Bodega y Talleres)
## GRUPO DECORM · Versión 2.0

Aplicación móvil diseñada para operarios de bodega y supervisores de taller de **GRUPO DECORM**. Se conecta directamente al backend Serverless en Google Apps Script (`dicorms_appsscript_crud.js`), asegurando actualización en tiempo real de inventarios, salidas a puertas de producción y préstamos de herramientas.

---

### 📱 Funcionalidades Principales

1. **Autenticación con Roles (RBAC) y PIN**:
   - Inicio de sesión con validación HMAC-SHA256 contra hoja `_USERS`.
   - Credencial predeterminada: `cristian` / PIN: `123456`.
2. **Salida Rápida de Insumos a Talleres**:
   - Selección de SKU desde catálogo de 128 ítems.
   - Descuento atómico del stock en hojas `Inv.*` y `Catalogo`.
   - Registro en `MOVIMIENTOSInsumosOperativo` con taller (`Taller 1`, `Taller 2`, `Taller 3`).
3. **Despacho Vinculado a Puerta de Producción**:
   - Asignación de materiales directamente a pedidos de `AgendaDePuertas`.
   - Trazabilidad del material por modelo, medidas y cliente.
4. **Control de Préstamos de Equipos y Herramientas (`EQU-*`)**:
   - Registro de salida con persona responsable.
   - Devolución parcial o total con un toque.
   - Historial en hoja `PrestamosEquipos`.
5. **Toma de Inventario Físico en Anaquel**:
   - Captura de conteo físico para ítems manuales (`INS-001` a `INS-021`).
   - Sincronización para conciliación automática contra el inventario teórico.
6. **Consulta de Catálogo y Stock en Tiempo Real**:
   - Búsqueda instantánea por SKU o descripción.
   - Indicador de estado (`NORMAL`, `STOCK BAJO`, `AGOTADO`).

---

### 🚀 Cómo Ejecutar la App

#### Requisitos
- [Flutter SDK](https://flutter.dev/docs/get-started/install) (v3.0.0 o superior).
- Dispositivo Android conectado por USB o Emulador AVD.

#### Pasos
```bash
cd UI_MOVIL

# Obtener dependencias
flutter pub get

# Ejecutar en emulador o celular
flutter run
```

Para generar el APK de producción:
```bash
flutter build apk --release
```
El archivo compilado quedará listo en: `build/app/outputs/flutter-apk/app-release.apk`.

---

### 🌐 Conexión al Backend
La URL configurada en `lib/config/api_config.dart` es:
```
https://script.google.com/macros/s/AKfycbzGraoRcFGLcR4PEVXAJLH16xM_vI5G1YxhDZaRAmiu0DIhCqrIPOj_Rr2xbhs-obDE/exec
```
Usa peticiones HTTP con soporte CORS y fallback automático a GET.
