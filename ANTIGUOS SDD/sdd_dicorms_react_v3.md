# SDD v3.0 — Módulo React (JavaScript) y Backend Unificado DICORMS (GRUPO DECORM)

| Campo | Valor |
|---|---|
| **Proyecto** | GRUPO DECORM — Sistema Maestro Unificado DICORMS + Abastecimiento Inteligente (`ForecastService`) |
| **Versión / Fecha** | 3.0 · 2026-11-19 |
| **Stack Frontend** | React 18+ (JavaScript ES6+, Vite, React Router, TanStack Query, Tailwind CSS, Recharts) |
| **Backend Unificado** | `DICORMS_Backend_Unificado_v3.js` (Google Apps Script Web App: CRUD v2.0 + ForecastService v3.0) |
| **Fuente de Verdad Auditada** | `DECORM_GROUP.xlsx` (20 hojas: `Catalogo`, `Compras`, `MOVIMIENTOSInsumosOperativo`, `InsumosInstaladores`, etc.) |

---

## 1. Evaluación y Auditoría Técnica del Sistema Actual

Tras auditar el libro `DECORM_GROUP.xlsx`, los scripts `dicorms_appsscript_crud*.js`, `ForecastService.gs` y los SDD previos (`sdd_dicorms_sistema_maestro_v2.md` y `SDD_InsumosInstaladores.md`), se confirman los siguientes hallazgos críticos y se documentan las mejoras aplicadas en **v3.0**:

### 1.1 Hallazgos Verificados en `DECORM_GROUP.xlsx`

1. **Desfase de Stock en `Catalogo` (Causa raíz confirmada):**
   - En la fila 3 de `Catalogo`, la columna `Q` (`Mov. neto post-conteo`) contiene la fórmula estática `=IF($A3="",0,0)` y la columna `R` (`STOCK ACTUAL`) copia directamente `Stock teórico` (`=IF($A3="",0,N3)`).
   - Como consecuencia, `ABR-001` (Disco Velcro 80) muestra `284` en `STOCK ACTUAL` aunque el conteo físico del `2026-11-14` fue `100` y posteriormente salieron unidades en `MOVIMIENTOSInsumosOperativo` (17, 18 y 19 de noviembre).
   - **Solución en Backend:** `fcVerifiedStock_()` ignora el valor congelado del libro y calcula el stock físico real como `ultimo_conteo + movimientos_posteriores + compras_posteriores`.

2. **Límites de Rango en Fórmulas de `Catalogo` (Riesgo Operativo Alto):**
   - Las fórmulas de `Catalogo` suman únicamente hasta la **fila 232** de `MOVIMIENTOSInsumosOperativo` (`$M$2:$M$232`) y hasta la **fila 250** de `Compras` (`$G$2:$G$250`).
   - Superados esos límites, las nuevas salidas y compras dejarán de reflejarse en Excel/Sheets, inflando o desfasando el stock teórico.
   - **Mitigación:** En Google Sheets, convertir esos rangos a columnas abiertas (`$M$2:$M`, `$G$2:$G`) o usar el cálculo del motor `ForecastService` en React como vista operativa autoritativa.

3. **Equivalencias y SKUs Pendientes de Confirmar:**
   - **Equivalencias `FC_SEEDS`:** Masilla = `SEL-002`, Disco Velcro 80 = `ABR-001`, Lija 320 disco = `ABR-005` (si es pliego, cambiar a `ABR-002`), Lija 1000 = `ABR-004`.
   - **Lija 240:** No existe aún en `Catalogo`; debe crearse vía `catalogo.create` antes de registrarse como semilla o en `Forecast_Config`.
   - **Alcance:** Solo pronostica ítems con `grupo_gasto === 'Insumos'` (excluyendo `Equipos` y `GEN-*`), salvo sobrescritura explícita en `Forecast_Config.modo_consumo = 'SALIDA'`.

### 1.2 Mejoras Implementadas en `DICORMS_Backend_Unificado_v3.js`

| Aspecto | Estado Anterior (`PATCHED` + `ForecastService.gs`) | Mejora Aplicada en v3.0 |
|---|---|---|
| **Empaquetado** | Dos archivos separados con parche manual de 2 líneas. | Archivo único modular (`DICORMS_Backend_Unificado_v3.js`) con router y RBAC unificados. |
| **Administración desde React** | `Forecast_Params`, `Forecast_Config` y `BOM_Puertas` solo editables abriendo Google Sheets. | Se agregan 8 rutas API: `forecast.params.get/update`, `forecast.config.list/update`, `forecast.bom.list/upsert/delete` y `forecast.history.list`. |
| **Escalabilidad en `forecast.get`** | Retornaba todo el catálogo sin paginación ni filtros de grupo/confianza. | Soporta filtros (`grupo_usuario`, `confianza`, `categoria`) y paginación opcional (`page`, `pageSize`). |
| **Colisión de IDs en aprendizaje** | `fcNewId_()` usaba `Math.random()` de 4 dígitos dentro de bucles. | Contador secuencial `FC_SEQ_COUNTER_` combinado con timestamp hasta el segundo. |
| **Escalado por plantilla** | `PERSONAL_*` era solo informativo. | Parámetro `ESCALAR_POR_PERSONAL` (`NO` por defecto; `SI` escala la tasa según `PERSONAL_<GRUPO> / PERSONAL_BASE_<GRUPO>`). |
| **Seguridad en producción** | Sin `ENFORCE_AUTH=true`, aceptaba peticiones anónimas como `admin`. | Helper `activarAutenticacionEstricta()` documentado y exposición de `enforce_auth` en `health`. |

---

## 2. Arquitectura del Frontend React (JavaScript)

### 2.1 Estructura de Carpetas Escalable

```text
src/
├── api/
│   ├── gasClient.js          # Cliente fetch adaptado a CORS de Apps Script (text/plain)
│   ├── forecastApi.js        # Wrappers de las rutas forecast.*
│   └── coreApi.js            # Wrappers de catalogo.*, compras.*, movimientos.*, auth.*
├── auth/
│   ├── AuthContext.jsx       # Sesión HMAC, usuario, rol, taller y cierre por expiración
│   └── RoleGuard.jsx         # Oculta o bloquea vistas/acciones según RBAC
├── hooks/
│   ├── useForecast.js        # Hooks TanStack Query (cache, invalidación y reintentos)
│   └── useIdempotency.js     # Generador de requestId único por envío de formulario
├── components/
│   ├── layout/               # AppShell, Sidebar (7 módulos), Topbar de estado
│   ├── forecast/
│   │   ├── AlertBadge.jsx    # Semáforo ROJO / NARANJA / AMARILLO / GRIS / VERDE
│   │   ├── ConfidencePill.jsx# Confianza ALTA / MEDIA / BAJA + indicador PROVISIONAL
│   │   ├── StockProjectionChart.jsx # Gráfica Recharts (stock proyectado vs ROP/seguridad)
│   │   └── ConciliationBanner.jsx   # Alerta de desfase conteo físico vs sistema
│   └── common/               # DataTable paginada, Modal de confirmación, ExportCSV
├── pages/
│   └── forecast/
│       ├── AlertsCenterPage.jsx       # Pantalla 1: Centro de Alertas
│       ├── ForecastOverviewPage.jsx   # Pantalla 2: Tablero General de Pronóstico
│       ├── SkuProjectionPage.jsx      # Pantalla 3: Detalle, Simulación y Conciliación
│       ├── PurchasePlanPage.jsx       # Pantalla 4: Plan Semanal y Emisión de Compras
│       ├── ObservationsPage.jsx       # Pantalla 5: Observaciones y Bandeja de Anomalías
│       ├── LearningAccuracyPage.jsx   # Pantalla 6: Aprendizaje EMA y Precisión (WAPE)
│       └── ForecastSettingsPage.jsx   # Pantalla 7: Parámetros, Config SKU y BOM Puertas
└── App.jsx
```

### 2.2 Cliente HTTP para Google Apps Script (`gasClient.js`)

Google Apps Script Web Apps no responden a preflight `OPTIONS` con cabeceras CORS personalizadas cuando se envía `application/json`. Por ello, **todas las peticiones `POST` desde React deben enviarse con `Content-Type: text/plain;charset=utf-8`** y el JSON serializado en el `body`:

```javascript
// src/api/gasClient.js
const GAS_URL = import.meta.env.VITE_GAS_WEBAPP_URL;

export async function callGas(action, params = {}, options = {}) {
  const token = localStorage.getItem('dicorms_token') || '';
  const payload = {
    action,
    token,
    requestId: options.requestId || undefined,
    params,
  };

  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Error HTTP ${res.status} al conectar con Apps Script`);
  }

  const json = await res.json();
  if (!json.ok) {
    const err = new Error(json.error?.message || 'Error desconocido en el servidor');
    err.code = json.error?.code || 'INTERNAL';
    if (err.code === 'AUTH') {
      localStorage.removeItem('dicorms_token');
      window.dispatchEvent(new Event('dicorms:unauthorized'));
    }
    throw err;
  }
  return json.data;
}
```

### 2.3 Control de Acceso (RBAC) en React

| Rol | Pantallas Visibles | Acciones Permitidas |
|---|---|---|
| `admin` | Las 7 pantallas + Configuración Crítica | Todo (`*`), incluyendo `forecast.setup` y `forecast.params.update`. |
| `compras` | Pantallas 1 a 7 | Consultar todo, emitir compras desde Plan Semanal, aprobar/rechazar anomalías, editar `Forecast_Config` y `BOM_Puertas`, ejecutar `forecast.run`. |
| `bodega` | Pantallas 1, 2, 3 y 5 (solo lectura en 7) | Ver alertas/proyecciones, registrar observaciones de consumo o faltantes (`forecast.observation.create`). |
| `lectura` | Pantallas 1, 2, 3, 4 y 6 (solo lectura) | Consultar alertas, pronósticos, plan de compras, historial y WAPE sin mutaciones. |
| `taller` | Sin acceso al módulo Forecast | Redirigido a módulo de Salidas / Puertas / Instaladores. |

---

## 3. Especificación de las 7 Pantallas del Módulo Forecast

### Pantalla 1: Centro de Alertas y Semáforo de Riesgos (`AlertsCenterPage.jsx`)
- **Ruta React:** `/forecast/alertas`
- **Endpoint principal:** `forecast.alerts` (`{ niveles: ['ROJO', 'NARANJA', 'AMARILLO'], incluirGris }`)
- **Componentes:**
  - Tarjetas resumen de conteo por severidad (`ROJO`, `NARANJA`, `AMARILLO`, `GRIS`).
  - Toggle `"Incluir materiales sin tasa (GRIS)"`.
  - Lista de tarjetas priorizadas por severidad y `dias_cobertura` ascendente mostrando: `sku`, `descripcion`, `stock_fisico`, `tasa_diaria`, `fecha_agotamiento`, `cantidad_sugerida`, badge `URGENTE`, badge de `conciliacion.alerta` (si existe desfase físico vs. sistema) y la acción recomendada (`accion`).
  - Botón directo `"Ver proyección"` (navega a Pantalla 3) y `"Ir a Plan de Compras"` (navega a Pantalla 4).

### Pantalla 2: Tablero General de Pronóstico (`ForecastOverviewPage.jsx`)
- **Ruta React:** `/forecast/tablero`
- **Endpoint principal:** `forecast.get` (`{ q, alerta, grupo_usuario, confianza, categoria, page, pageSize }`)
- **Componentes:**
  - Barra de filtros: buscador por SKU/descripción, selectores de `alerta`, `grupo_usuario` (`ENMASILLADO`, `SOLDADURA`, `INSTALACION`, `GENERAL`), `confianza` (`ALTA`, `MEDIA`, `BAJA`) y `categoria`.
  - Tabla paginada con columnas: `SKU`, `Descripción`, `Stock Físico` (indicando si viene de `CONTEO+MOVIMIENTOS` o `SISTEMA`), `Tasa/día` + `fuente_tasa` (etiqueta `PROVISIONAL` si viene de semilla), `Cobertura (días)`, `Agota el`, `Compra Sugerida`, `Confianza`, `Semáforo`.
  - Exportación a CSV del tablero filtrado.

### Pantalla 3: Detalle de SKU, Simulación y Conciliación (`SkuProjectionPage.jsx`)
- **Ruta React:** `/forecast/sku/:sku`
- **Endpoints:** `forecast.projection` (`{ sku }`), `forecast.history.list` (`{ sku }`) y `catalogo.kardex` (`{ sku }`).
- **Componentes:**
  - `ConciliationBanner`: Si `conciliacion.alerta === true`, muestra el comparativo exacto (`stock_sistema` vs `stock_fisico`) y un enlace rápido al módulo de Conciliación/Seguimiento.
  - Tarjetas de parámetros del SKU: `lead_time_dias`, `horizonte_proteccion_dias`, `stock_seguridad`, `punto_reorden`, `posicion_inventario`, `recepciones_pendientes`, `tasa_por_persona`.
  - **Gráfica `StockProjectionChart` (Recharts `ComposedChart`):** Eje X = `fecha` (próximos 30+ días operativos); Serie principal = `stock` proyectado; Barras = `recepcion` esperada; Líneas de referencia horizontales = `punto_reorden` y `stock_seguridad`.
  - Tabla diaria de simulación (`dia`, `fecha`, `recepcion`, `demanda`, `stock`) y botón `"Registrar observación"` (abre modal de Pantalla 5 prellenado con el SKU).

### Pantalla 4: Plan Semanal de Compras Sugeridas (`PurchasePlanPage.jsx`)
- **Ruta React:** `/forecast/compras-sugeridas`
- **Endpoints:** `forecast.plan` (lectura) y `compras.createBatch` (emisión autorizada).
- **Regla de Negocio Crítica:** El sistema **nunca emite compras automáticamente** (`requiere_autorizacion: true`).
- **Componentes:**
  - KPIs superiores: `total_items`, `urgentes`, `costo_estimado_total` (resaltando ítems sin `precio_ref_neto`).
  - Vista agrupada por `por_proveedor` (acordeón o pestañas por proveedor: `Freund`, `Por asignar`, etc.).
  - Cada fila muestra `cantidad_sugerida`, desglose de `entregas` programadas (cuando `maximo_entrega > 0`), `base_sugerencia` (`DEMANDA_HORIZONTE` vs `MINIMO_CATALOGO`) y un checkbox + input editable de `cantidad_a_pedir`.
  - Botón **"Autorizar y Generar Orden de Compra"**: abre modal de confirmación con resumen por proveedor, genera `requestId` idempotente y llama a `compras.createBatch` con `cant_pedida` y `cant_recibida` según recepción.

### Pantalla 5: Observaciones de Consumo y Bandeja de Anomalías (`ObservationsPage.jsx`)
- **Ruta React:** `/forecast/observaciones`
- **Endpoints:** `forecast.learning.history`, `forecast.observation.create`, `forecast.observation.approve`, `forecast.learning.run`.
- **Componentes:**
  - **Bandeja de Pendientes (Prioritaria):** Filtra observaciones con `validacion === 'ANOMALIA'` (consumo $> 2.5\times$ tasa vigente) y `tipo === 'FALTANTE'` (`PENDIENTE_CONTEO`).
    - Para `ANOMALIA`: botones **"Aprobar"** (exige campo `motivo` obligatorio) y **"Rechazar"**.
    - Para `FALTANTE`: botón **"Confirmar Faltante"** (`CONFIRMAR_FALTANTE`).
  - **Formulario "Nueva Observación":** Selector de tipo (`CONSUMO` | `FALTANTE`), selector de `SKU`, `cantidad`, rango `fecha_inicial` / `fecha_final` (para `CONSUMO`), `ubicacion`, `observaciones`, y checkbox `aprenderAhora`.
  - Botón **"Ejecutar Aprendizaje Manual"** (`forecast.learning.run`) para procesar ventanas cerradas del Kardex al instante.

### Pantalla 6: Aprendizaje EMA y Precisión del Modelo (`LearningAccuracyPage.jsx`)
- **Ruta React:** `/forecast/aprendizaje`
- **Endpoints:** `forecast.learning.history`, `forecast.feedback.list`, `forecast.feedback.create`, `forecast.history.list`.
- **Componentes:**
  - Indicador global **WAPE %** (`wape_pct`: $\sum|\text{error}| / \sum\text{consumo\_real}$), con semáforo de calidad.
  - Tabla `Consumption_Learning`: `sku`, `tasa_inicial`, `tasa_aprendida`, `desviacion_abs`, `observaciones_validas`, `confianza`, `origen_tasa` (`SEED`, `KARDEX`, `SEED+APRENDIDA`), `ultima_fecha_procesada`.
  - Bitácora `Learning_History`: muestra cada actualización del EMA con `tasa_anterior` → `tasa_nueva` y `motivo`.
  - Tabla `Forecast_Feedback` + modal para registrar feedback manual (`run_id`, `sku`, `consumo_real`).

### Pantalla 7: Configuración del Motor, Parámetros y BOM (`ForecastSettingsPage.jsx`)
- **Ruta React:** `/forecast/configuracion`
- **Endpoints:** `forecast.params.get/update`, `forecast.config.list/update`, `forecast.bom.list/upsert/delete`, `forecast.setup`, `forecast.run`.
- **Componentes (organizados en 3 pestañas):**
  1. **Parámetros Globales (`Forecast_Params`):** Formulario agrupado para editar `ALERTAS_EMAIL`, `DIAS_MODO` (`OPERATIVO`/`CALENDARIO`), `REVISION_DIAS`, `SEGURIDAD_DIAS`, `LEAD_TIME_DEFAULT`, `FACTOR_APRENDIZAJE`, `ANOMALIA_FACTOR`, `ESCALAR_POR_PERSONAL` y tabla de plantilla por grupo (`PERSONAL_*`).
  2. **Configuración por SKU (`Forecast_Config`):** Tabla editable en línea para ajustar `lead_time`, `modo_consumo` (automático, `SALIDA`, `NINGUNO`), `modo_prediccion` (`AUTO`, `VIGILANCIA`), `empaque`, `minimo_compra`, `maximo_entrega` y `grupo_usuario`.
  3. **Recetas por Puerta (`BOM_Puertas`):** CRUD para asociar `modelo` de puerta (ej. `LYNUX`, `NIRYX`, `LORVAK`) con `sku` y `cantidad_por_puerta`, activando el motor híbrido de demanda por proyecto.
  - Acciones de mantenimiento (solo `admin` / `compras`): **"Ejecutar Pronóstico Ahora"** (`forecast.run`) e **"Inicializar Tablas / Semillas"** (`forecast.setup`).

---

## 4. Contratos de API (`forecast.*` — Request / Response)

Todas las llamadas se envían vía `POST` al Web App URL con estructura `{ action, token, requestId?, params }`.

| Acción (`action`) | Parámetros (`params`) | Respuesta (`data`) |
|---|---|---|
| `forecast.get` | `{ sku?, alerta?, grupo_usuario?, confianza?, categoria?, q?, incluirProyeccion?, page?, pageSize? }` | `{ generado, hoy, version_modelo, modo_dias, resumen, total, page?, pageSize?, rows[] }` |
| `forecast.projection` | `{ sku }` | Objeto SKU completo incluyendo `proyeccion: [{ dia, fecha, recepcion, demanda, stock }]` |
| `forecast.alerts` | `{ niveles?, incluirGris? }` | `{ hoy, resumen, alertas[] }` |
| `forecast.plan` | `{}` | `{ hoy, semana_desde, nota, total_items, urgentes, costo_estimado_total, por_proveedor, items[] }` |
| `forecast.observation.create` | `{ sku, tipo: 'CONSUMO'\|'FALTANTE', cantidad, fecha_inicial?, fecha_final?, fecha?, ubicacion?, observaciones?, aprenderAhora? }` | `{ observacion, aprendizaje }` |
| `forecast.observation.approve` | `{ id, decision: 'APROBAR'\|'RECHAZAR'\|'CONFIRMAR_FALTANTE', motivo? }` | `{ observacion, aprendizaje }` |
| `forecast.learning.run` | `{}` | `{ ventanas_nuevas, incorporadas, anomalias, skus_actualizados[] }` |
| `forecast.learning.history` | `{ sku? }` | `{ aprendizaje_actual[], historial[], observaciones[] }` |
| `forecast.feedback.list` | `{ sku? }` | `{ wape_pct, nota, total, rows[] }` |
| `forecast.feedback.create` | `{ run_id, sku, consumo_real, observaciones? }` | Registro `Forecast_Feedback` creado |
| `forecast.history.list` | `{ sku?, desde?, hasta?, limit? }` | `{ total, rows[] }` |
| `forecast.params.get` | `{}` | `{ params: { ... }, rows[] }` |
| `forecast.params.update` | `{ updates: { CLAVE: valor } }` | `{ params: { ... }, rows[] }` |
| `forecast.config.list` | `{ sku? }` | `{ total, rows[] }` |
| `forecast.config.update` | `{ sku, changes: { lead_time?, modo_consumo?, ... } }` | `{ row }` |
| `forecast.bom.list` | `{ modelo?, sku? }` | `{ total, rows[] }` |
| `forecast.bom.upsert` | `{ modelo, sku, cantidad_por_puerta, notas? }` | `{ row }` |
| `forecast.bom.delete` | `{ modelo, sku }` | `{ deleted: true, modelo, sku }` |
| `forecast.run` | `{}` | `{ run_id, resumen, aprendizaje, feedback, correo_enviado }` |
| `forecast.setup` | `{}` | `{ hojas[], semillas[], skus_sin_catalogo[], config_agregada }` |

---

## 5. Plan de Despliegue y Criterios de Aceptación

1. **Despliegue Backend:** Reemplazar los archivos previos en Apps Script por `DICORMS_Backend_Unificado_v3.js`, ejecutar `setupForecast()` y `installForecastTriggers()`, configurar `ALERTAS_EMAIL` y ejecutar `activarAutenticacionEstricta()`.
2. **Validación de Datos en `Catalogo`:**
   - Confirmar las equivalencias de `FC_SEEDS` (`ABR-005` vs `ABR-002` para Lija 320).
   - Crear el SKU de **Lija 240** en `Catalogo` y agregarlo en `FC_SEEDS` / `Forecast_Config`.
   - Actualizar `lead_time` real por SKU desde la Pantalla 7 en React.
   - Corregir los rangos de fórmulas en `Catalogo` (`232` y `250`) a rangos abiertos en Google Sheets.
3. **Criterios de Aceptación del Frontend React:**
   - Ninguna pantalla permite emitir una compra sin confirmación explícita del usuario (`compras.createBatch` con `requestId`).
   - Las anomalías ($>2.5\times$) bloquean la actualización de la tasa EMA hasta que un usuario `compras` o `admin` las apruebe con justificación.
   - Los faltantes (`FALTANTE`) se muestran como alertas pendientes de conteo y nunca distorsionan el cálculo de `tasa_diaria`.
   - Toda mutación muestra feedback claro ante errores `AUTH`, `FORBIDDEN`, `CONFLICT` (traslape de fechas) y `VALIDATION`.
