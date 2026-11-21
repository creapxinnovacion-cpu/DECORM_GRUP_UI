# SDD v4.1.0.0 — Sistema Maestro DICORMS (Reestructura Integral, Clean Code y Módulo de Cotizaciones)

**Proyecto:** Sistema Maestro de Inventario, Producción, Cotizaciones y Abastecimiento — GRUPO DECORM

**Versión:** `4.1.0.0` (Proyecto Nuevo en Limpio — Go-Live Lunes)

**Stack:** React 19 + Vite + Tailwind CSS v4 + TanStack Query (Frontend) · Google Apps Script Modular (Backend) · Google Sheets `DECORM_GROUP_v4.xlsx` (Persistencia Etapa A)

**Fecha:** 21 de noviembre de 2026

## 1. Propósito, Alcance y Qué Cambia en v4.1.0.0

Este documento define **qué construir, cómo estructurarlo y para qué sirve cada pieza** al arrancar un proyecto nuevo y limpio de **DICORMS v4.1.0.0**. Consolida la línea base operativa (v1.0–v3.0), cierra los 12 hallazgos críticos de auditoría (v3.1) e incorpora los nuevos requerimientos operativos para operar desde el lunes con cero deuda técnica:

| Dimensión | Estado actual (v3.0 / `DECORM_GROUP.xlsx`) | Objetivo en v4.1.0.0 (Proyecto Limpio) | 
| ----- | ----- | ----- | 
| **Libro de Sheets** | 29 hojas, 6 `Inv.*` redundantes, 60 errores `#REF!`/`#N/A`, rangos con tope (`$2:$128`, `$2:$250`, `$2:$332`), filas `TOTAL` dentro de datos | **18 hojas limpias**, 0 `#REF!`/`#N/A`, rangos abiertos con nombre, totales aislados en `Resumen`, 0 redundancia | 
| **Backend Apps Script** | Monolito de \~1,100 líneas en un solo `Code.gs`, lecturas completas de hoja, candado de 15 s, `ENFORCE_AUTH=false` | **Arquitectura modular Clean Code** (10 archivos `.gs`), patrón Repository desacoplado, caché 60 s, escrituras `setValues()`, candado 30 s retenido ≤2 s, `ENFORCE_AUTH=true` | 
| **Alertas de Stock** | Pensadas para enviarse por Gmail (`ALERTAS_EMAIL` vacío) | **100% centralizadas en el Dashboard de React** (semáforo accionable con botón directo a cotizar; correo desactivado para alertas operativas) | 
| **Abastecimiento y Cotizaciones** | `forecast.plan` solo muestra sugerencias; `Catalogo!AA` cubre solo `1.0×` mínimo; sin flujo de cotización ni PDF para Finanzas | **Módulo de Cotizaciones con Checkboxes** (Materiales / Insumos / Equipos), precios mutables por proveedor, **1 hoja por cotización** y exportación a **PDF para Finanzas** (con IVA) o **PDF/PNG para Proveedor** (WhatsApp) | 
| **Integridad de Flujos** | Llave duplicada `DEC-26-009`, instaladores no descuentan stock, vínculo a puerta por regex en `observaciones`, talleres libres (`Taller 1`) | Llaves autogeneradas (`_SEQ`), `uid` + concurrencia optimista (`version`), instaladores descuentan stock atómicamente, `ref_tipo` + `ref_id`, catálogo cerrado de talleres | 
| **Diferido a v5.0** | — | Control fraccionado de **Thinner (`CON-002`)** y **Wiper por libra (`CON-003`)** (evaluación documentada en Sección 11) y migración a BD relacional Etapa B | 

## 2. Evaluaciones de Viabilidad y Decisiones Estratégicas

### 2.1 Viabilidad de Recrear `DECORM_GROUP.xlsx` desde Cero

**Veredicto: SÍ — Luz verde total (altamente recomendado antes de operar el lunes).**

La auditoría directa sobre el archivo actual `DECORM_GROUP.xlsx` confirma que parchar el libro existente cuesta más tiempo y riesgo que recrearlo limpio e importar los datos vigentes:

| Indicador Auditado en `DECORM_GROUP.xlsx` | Valor Real Medido | Impacto Operativo si No se Recrea | 
| ----- | ----- | ----- | 
| Hojas totales en el libro | **29** | 6 hojas `Inv.*` duplican `Catalogo` y generan desincronización | 
| Errores de fórmula (`#REF!` / `#N/A`) | **60** | `GASTO_MES` (52), `SeguimientoManualStok` (4), `MOVIMIENTOS` (3), `Inicio` (1) | 
| SKUs fuera de rango de validación (`A3:A128`) | **4** (`SEL-010`, `HER-016`, `HER-017`, `PIN-032`) | Compras recientes aparecen como `⚠ SKU no existe` | 
| SKUs sin stock mínimo (vacío o 0) | **68 de 130 (52.3%)** | Nunca disparan alerta `COMPRAR` | 
| SKUs sin proveedor preferido (`Por asignar`/vacío) | **82 de 130 (63.1%)** | No se pueden agrupar por proveedor al cotizar | 
| SKUs sin precio ref. neto (`$0`) | **124 de 130 (95.4%)** | Valoración de inventario en `$0` y presupuestos vacíos | 
| SKUs en estado `COMPRAR` hoy | **36** | Requieren orden/cotización priorizada | 
| SKUs con stock negativo | **3** (`ABR-004`, `ABR-005`, `HER-005`) | Distorsionan cálculo de cobertura y reposición | 

**Por qué recrearlo es más rápido y seguro:**

1. Se eliminan las 6 hojas `Inv.*` redundantes (React filtra `Catalogo` por categoría en 1 clic).

2. Se eliminan todas las filas `TOTAL` incrustadas al final de tablas transaccionales (`Catalogo`, `Compras`, `MOVIMIENTOS`, `AgendaDePuertas`), evitando que `ensureCapacity_()` corrompa rangos.

3. Todas las fórmulas nacen con **rangos abiertos y nombrados** (`Compras!$C$2:$C`) y con columnas de control (`uid`, `updated_at`) listas para concurrencia optimista.

4. Se migran en bloque los 130 SKUs, compras, movimientos y puertas vigentes (restaurando la puerta `DEC-26-009` de Juan José Cornejo y reasignando el siguiente correlativo a Luis Eliseo Paz).

### 2.2 Viabilidad de Operar sobre el +90% (`mínimo × 1.9`) vs. Solo Cotizar

**Fórmula actual verificada en `Catalogo!AA3`:**

```
=IF($A3="",0,IF(OR(F3="Cliente",LEFT(C3,11)="Sin detalle"),0,MAX(0,N(J3)+Y3+Z3-R3)))

```

Hoy la columna `AA` cubre solo `1.0 × Stock mínimo` (para `ABR-001` con mínimo 300 y stock 138, sugiere 162 discos, dejando 0 colchón).

**Evaluación de aplicar `mínimo × 1.9` (+90%) de forma fija:**

| Criterio | Aplicar `1.9×` como Orden Automática | Aplicar `1.9×` como **Sugerencia Editable para Cotizar (Recomendado)** | 
| ----- | ----- | ----- | 
| **Alta rotación** (ej. `ABR-001`, consumo \~53/día) | Excelente: objetivo 570 discos → pide 432 (\~1.5 semanas de colchón) | Igual de efectivo, con ajuste rápido antes de exportar PDF | 
| **Baja rotación** (ej. pinturas `PIN-002..028`, herrajes) | **Riesgo de caja:** pedir 4 galones cuando el consumo es esporádico inmoviliza efectivo | Permite usar factor `1.0`–`1.2` para Clase B/C o desmarcar con checkbox | 
| **Datos incompletos hoy** (68 sin mínimo, 124 sin precio) | Genera órdenes incompletas o con presupuesto `$0` | Permite marcar solo los SKUs reales a cotizar y editar precios del proveedor | 
| **Evolución con historial** | Rígido si queda fijo en fórmula | Arranca con factor configurable y a los 14+ días combina con EMA (`MAX(regla_factor, consumo_proyectado)`) | 

**Veredicto recomendado para v4.1.0.0:**

* **NO** activar emisión automática vinculante de órdenes con `1.9×` global.

* **SÍ** adoptar un **Modo Híbrido orientado a Cotización**:

  1. Crear el parámetro global `FACTOR_PEDIDO` (default `1.9`) en `Config` y permitir sobreescribirlo por SKU en `Forecast_Config` (`factor_reposicion`, por ejemplo `1.9` para Clase A / consumibles rápidos y `1.0` o `1.2` para pinturas y herrajes).

  2. Cambiar `Catalogo!AA` para usar el factor y descontar lo ya pedido/cotizado en tránsito:
     

     $$
     \text{Compra Sugerida} = \max\Big(0,\; \lceil (\text{Mínimo} \times \text{Factor}) + \text{Demanda Pend.} - \text{Stock Actual} - \text{En Tránsito} \rceil \Big)
     $$

  3. El sistema **solo genera sugerencias en el Dashboard**. Tú seleccionas con checkboxes qué materiales, insumos o equipos entran a la cotización, ajustas cantidades/precios si hace falta y exportas el PDF para Finanzas o WhatsApp.

### 2.3 Alertas en Dashboard vs. Gmail

**Veredicto: Mover todas las alertas operativas al Dashboard de React.**

* **Para qué:** Elimina ruido en Gmail, evita depender de `ALERTAS_EMAIL` y convierte cada alerta en una acción inmediata de 1 clic (*"Agregar a Cotización"*).

* **Rol del trigger diario (5:30 a.m.):** Sigue ejecutándose automáticamente para correr el aprendizaje EMA, guardar el snapshot en `Forecast_History` y refrescar el caché del Dashboard. El correo solo queda como opción apagada por defecto (`ALERTAS_ERROR_EMAIL` opcional únicamente si el script falla por excepción técnica).

### 2.4 Hallazgos de Cotizaciones Reales (`DatosDecorm.zip`)

El análisis de los documentos reales de proveedores en `DatosDecorm.zip` reveló **4 requisitos críticos** que el módulo de cotizaciones debe soportar nativamente:

| Proveedor (Carpeta) | Documentos Analizados | Código Propio del Proveedor | Convención Fiscal en Cotización | Uso Principal | 
| ----- | ----- | ----- | ----- | ----- | 
| **FREUND** (`FREUND, LTDA. DE C.V.`) | 23 PDFs (`CO_FREUND_*`, `COT-0003`, `COTIZACION DE ABASTECIMIENTO`) | Numérico (ej. `767400`, `673236`, `572931`) | **Precios SIN IVA** (+13% al pie) | Insumos, abrasivos, herrajes, equipos | 
| **DIDELCO** (Suc. Sonsonate) | 11 imágenes (`COTIZACION 5093303`, etc.) | Numérico largo (ej. `160100016`) | **Precios SIN IVA** (+13% al pie) | Láminas de hierro y estructura metálica | 
| **CONSTRULEMUS / LEMUS** (Suc. Constru-Sonsonate) | 5 imágenes (`NO. COTIZACION: 68889`, etc.) | Alfanumérico (ej. `TGAL-00014`, `TREC-00007`) | **Precios INCLUYEN IVA** (neto = precio ÷ 1.13) | Tubos galvanizados, perfiles y construcción liviana | 
| **Orden Interna Multi-Taller** (`Cotizacion Metales`) | `Orden_Materiales_Sonsonate_Santa_Ana_21-11-2026.pdf` | Sin código proveedor (solicitud por taller) | **Pendiente de cotizar** (solo cantidades) | Consolidado Sonsonate + Santa Ana para cotizar y presentar a Finanzas | 

**Implicación de diseño:** Un mismo SKU interno (ej. `MET-001`) puede tener códigos distintos en Freund, Didelco y Lemus, y sus precios cambian en cada cotización. Por eso el sistema separa el **Catálogo Maestro** de la tabla **`Precios_Proveedor`** (referencia histórica editable) y guarda el precio exacto pactado en cada **`Cotizaciones_Detalle`**.

## 3. Arquitectura Clean Code y Escalabilidad Horizontal

### 3.1 Principios de Diseño (Clean Code + Ergonomía)

1. **Separación estricta de responsabilidades (SRP):** El router HTTP nunca toca rangos de Sheets; los servicios de negocio nunca construyen respuestas HTTP; la capa de repositorio (`RepoSheets`) es la única que conoce `SpreadsheetApp`.

2. **Desacoplamiento para escalabilidad horizontal (Patrón Repository):** Todo el backend consume una interfaz uniforme (`Repo.findAll`, `Repo.findByUid`, `Repo.insertBatch`, `Repo.updateByUid`). Si en el futuro el volumen supera los umbrales de Google Sheets (Etapa B), se sustituye únicamente `04_RepoSheets.gs` por un adaptador HTTP hacia Postgres/Supabase o Firestore **sin cambiar ni una línea en React ni en las reglas de negocio**.

3. **Cero números mágicos y documentación viva:** Todas las constantes (lock, TTL de caché, IVA, estados de puerta, talleres) viven en `00_Config.gs` y la hoja `Config`.

4. **Concurrencia segura sin cuellos de botella:**

   * Validaciones y cálculos ocurren **fuera** del candado.

   * `LockService.getScriptLock()` con `waitLock(30000)` + reintento con backoff exponencial se adquiere **solo para escribir** (retención objetivo ≤ 2 s).

   * Escrituras por lote en una sola llamada `range.setValues(matrix)` + un solo `SpreadsheetApp.flush()`.

5. **Lecturas rápidas con caché por capas:** `CacheService.getScriptCache()` guarda `Catalogo`, `Config` y `DashboardSnapshot` por 60–120 s (invalidación automática al escribir), reduciendo la latencia p95 a ≤ 2–3 s.

### 3.2 Estructura Modular del Backend (Google Apps Script — 10 Archivos `.gs`)

En el nuevo proyecto de Apps Script (se recomienda gestionar con `clasp` + Git), se divide el monolito en módulos cohesivos:

```
backend-gas/
├── appsscript.json              # Timezone America/El_Salvador, runtime V8, scopes mínimos
├── 00_Config.gs                 # Constantes globales, versiones, códigos de error estándar
├── 01_Schema.gs                 # Declaración de las 18 hojas (inputs, computed, types, uniqueKey)
├── 02_Router.gs                 # doGet / doPost, dispatchAction_, sobre {ok, data|error, meta}
├── 03_Auth.gs                   # Login, HMAC-SHA256, sal por usuario, bloqueo 5 intentos, RBAC
├── 04_RepoSheets.gs             # Capa única de acceso a Sheets (caché, batch setValues, lock, uid/version)
├── 05_Validators.gs             # Reglas R-31..R-48 (talleres, estados, DTE, stock negativo, SKU)
├── 06_CoreServices.gs           # Servicios: Catalogo, Compras (+DTE), Movimientos, Instaladores, Puertas, Préstamos, Calidad
├── 07_CotizacionesService.gs    # Motor de cotizaciones: CRUD, anti-duplicado, hoja por cotización, PDF Finanzas/Proveedor
├── 08_ForecastService.gs        # Motor EMA-1.2, umbral 14 días, factor reposición, proyección 30d
└── 09_JobsAndAdmin.gs           # Trigger 5:30 a.m., schema.validate, log.restore, archivo anual, setup inicial

```

### 3.3 Estructura Modular del Frontend (React 19 + Vite — Feature-Sliced)

```
frontend-react/
├── src/
│   ├── app/                     # Router, QueryClientProvider, AuthProvider, Layout responsivo
│   ├── shared/
│   │   ├── api/                 # client.js (POST text/plain, requestId UUID, manejo CONFLICT/AUTH)
│   │   ├── components/          # DataTable, StatusBadge, SkuPicker, ConfirmModal, PdfExportButton
│   │   ├── hooks/               # useDebounce, useConfig, useOfflineQueue
│   │   └── pdf/                 # Plantillas PDF limpias (Finanzas con IVA, Proveedor WhatsApp, Vale Entrega)
│   └── features/
│       ├── dashboard/           # KPIs, consumo semanal/taller, Centro de Alertas Accionable (sin Gmail)
│       ├── catalogo/            # Catálogo unificado (filtros por categoría), Kardex, Conteo Físico
│       ├── cotizaciones/        # NUEVO: Selector con Checkboxes (Mat/Ins/Equ), Multi-taller, PDF Finanzas/WhatsApp
│       ├── compras/             # Compras + Importador JSON DTE Hacienda + enlace a Cotización aprobada
│       ├── movimientos/         # Salidas, Devoluciones, Ajustes, Entrega a Puerta (ref_tipo/ref_id)
│       ├── instaladores/        # Despacho rápido 1-clic (descuenta stock en MOVIMIENTOS atómicamente)
│       ├── puertas/             # Agenda con máquina de estados, SKU autogenerado, consumo real vs BOM
│       ├── forecast/            # Semáforo (con umbral 14d), Proyección 14/30d, BOM, Parámetros
│       ├── calidad/             # NUEVO: 8 controles automáticos de higiene de datos + Conciliación
│       └── prestamos/           # Préstamos y devoluciones de equipos (EQU-*)

```

### 3.4 Umbrales de Escalabilidad Horizontal (Cuándo Saltar a Etapa B)

| Indicador Monitoreado | Umbral de Alerta | Acción Automática / Arquitectónica | 
| ----- | ----- | ----- | 
| Filas vivas en `MOVIMIENTOS` | ≥ 10,000 filas | Ejecutar cierre y archivo anual (`archivo.cerrar`) hacia `Movimientos_AAAA` | 
| p95 de respuesta en listados | \> 3 s por 2 semanas seguidas | Revisar paginación por fecha; iniciar migración a Etapa B | 
| Errores `LOCK_TIMEOUT` | ≥ 2 por semana | Reemplazar `04_RepoSheets.gs` por adaptador **Postgres/Supabase** o **Firestore** | 
| Escritores concurrentes sostenidos | \> 5 usuarios simultáneos | Migrar tablas transaccionales a Etapa B; Sheets queda como espejo de reportes | 
| Duración de `runDailyForecast` | \> 4 min (límite GAS: 6 min) | Mover cálculo EMA a Cloud Run / Worker externo (Etapa C) | 

## 4. Rediseño Limpio del Libro `DECORM_GROUP_v4.xlsx` (18 Hojas)

### 4.1 Inventario Consolidado de Hojas (29 → 18 Hojas)

Se eliminan las 6 hojas `Inv.*` duplicadas y se incorporan 4 hojas estructuradas para totales, cotizaciones y precios por proveedor. **Ninguna hoja transaccional lleva fila `TOTAL` al final.**

| \# | Hoja en v4.1.0.0 | Color de Pestaña | Propósito | Cambio vs v3.0 | 
| ----- | ----- | ----- | ----- | ----- | 
| 1 | `Inicio` | Azul Marino | Dashboard ejecutivo del libro (KPIs, semanal, taller) | Limpia, 0 `#N/A`, apunta a rangos nombrados | 
| 2 | `Resumen` | Azul Oscuro | **NUEVA:** Todos los `SUM`/`COUNT` globales de tablas | Saca las filas `TOTAL` fuera de las hojas de datos | 
| 3 | `Catalogo` | Verde | Maestro único de SKUs (130+ artículos) | Reemplaza las 6 `Inv.*`; añade `uid`, `updated_at`, `clase_abc` | 
| 4 | `Precios_Proveedor` | Verde Claro | **NUEVA:** Relación `sku` ↔ `proveedor` ↔ `cod_proveedor` ↔ último precio + flag IVA | Soporta códigos de Freund, Didelco y Lemus | 
| 5 | `Cotizaciones_Cabecera` | Índigo | **NUEVA:** Encabezados de cotizaciones (`COT-AA-NNN`, estado, proveedor, taller, totales) | Base relacional para anti-duplicado e historial | 
| 6 | `Cotizaciones_Detalle` | Índigo Claro | **NUEVA:** Líneas con checkbox `incluir`, tipo (`MATERIAL`/`INSUMO`/`EQUIPO`), precio editable | Fuente de exportación PDF y hoja individual | 
| 7 | `Plantilla_Cotizacion` | Violeta | **NUEVA:** Plantilla limpia para duplicar **1 hoja por cotización** (`COT-26-001`, etc.) con checkboxes e impresión PDF a Finanzas | Cumple requerimiento de 1 hoja por cotización | 
| 8 | `Compras` | Ámbar | Compras recibidas + DTE Hacienda El Salvador | Añade `uid`, `updated_at`, `cotizacion_id`; sin fila TOTAL | 
| 9 | `MOVIMIENTOSInsumosOperativo` | Naranja | **Único libro de salidas/entradas** de insumos | Retira cols A–F de préstamos; añade `uid`, `updated_at`, `ref_tipo`, `ref_id`, `lote_id`, `origen` | 
| 10 | `InsumosInstaladores` | Naranja Claro | Control físico de entregas a instaladores | Añade `fecha`, `taller`, `lote_id`, `mov_uid` enlazado a `MOVIMIENTOS` | 
| 11 | `AgendaDePuertas` | Cian | Plan de producción de puertas por taller | Añade `uid`, `updated_at`; SKU autogenerado (`DEC`/`EXT`); estados y talleres cerrados | 
| 12 | `BOM_Puertas` | Cian Claro | Receta de materiales por modelo de puerta | Añade `unidad`, `activo`, `version` | 
| 13 | `PrestamosEquipos` | Teal | Préstamos y devoluciones de equipos (`EQU-*`) | Añade `uid`, `updated_at`; absorbe históricos A–F | 
| 14 | `Conciliacion` | Gris Azulado | Cruce conteo físico vs stock teórico | Sin `#REF!`, ligada a rangos abiertos | 
| 15 | `Equivalencias` | Gris Claro | Mapeo histórico `INS-0xx` → `SKU` | Depuración de los 13 `⚠ CONFIRMAR` | 
| 16 | `GASTO_MES` | Amarillo | Matriz mensual de gasto por SKU (Ene–Dic) | Reconstruida desde cero con `SUMIFS` sobre rangos abiertos (0 `#REF!`) | 
| 17 | `Config` | Pizarra | Listas cerradas: Proveedores (+flag IVA), Talleres (+alias), Categorías, Estados Puerta, Modelos, Parámetros (`FACTOR_PEDIDO`, `BLOQUEAR_NEGATIVO`) | Fuente única de validación | 
| 18 | `Forecast_Data` + Sistema (`_USERS`, `_SEQ`, `_LOG`, `Forecast_*`) | Negro / Gris | Hojas técnicas ocultables para usuarios finales | `_USERS` con sal individual; `_LOG` con `request_id` y `duration_ms`; `Forecast_Config` añade `factor_reposicion` | 

*(Nota operativa: `SeguimientoManualStok` queda absorbida en el flujo de conteo físico directo de `Catalogo` + `Conciliacion`, o conservada como hoja histórica de solo lectura durante la semana 1 mientras se cierran las 13 equivalencias.)*

### 4.2 Rangos con Nombre Abiertos (Adiós a los Topes de Fila)

| Rango con Nombre | Referencia Abierta | Reemplaza | 
| ----- | ----- | ----- | 
| `rng_CatSKU` | `Catalogo!$A$3:$A` | `Catalogo!$A$3:$A$128` | 
| `rng_ComprasSKU`, `rng_ComprasRec`, `rng_ComprasNeto`, `rng_ComprasPrecio` | `Compras!$C$2:$C`, `$G$2:$G`, `$J$2:$J`, `$L$2:$L` | `...$2:$250` | 
| `rng_MovSKU`, `rng_MovTipo`, `rng_MovCant`, `rng_MovRefTipo`, `rng_MovRefId` | `MOVIMIENTOSInsumosOperativo!$D$2:$D`, `$C$2:$C`, `$G$2:$G`, `$L$2:$L`, `$M$2:$M` | `...$2:$332` | 
| `rng_CotSKU`, `rng_CotCant`, `rng_CotEstado` | `Cotizaciones_Detalle!$C$2:$C`, `$F$2:$F`, `$M$2:$M` | *(Nuevo: stock en tránsito / anti-duplicado)* | 
| `rng_Talleres`, `rng_EstadosPuerta`, `rng_ModelosPuerta`, `rng_Proveedores` | Listas cerradas en `Config` | Validaciones manuales | 

### 4.3 Fórmulas Críticas Corregidas en `Catalogo`

* **Stock en tránsito / cotización aprobada (nueva columna `Z2` o `En tránsito`):**

  ```
  =IF($A3="",0,SUMIFS(rng_CotCant, rng_CotSKU, $A3, rng_CotEstado, "APROBADA") + SUMIFS(rng_CotCant, rng_CotSKU, $A3, rng_CotEstado, "ENVIADA"))
  
  ```

* **Compra sugerida (`AA`) con `FACTOR_PEDIDO` configurable y anti-duplicado:**

  ```
  =IF($A3="",0,IF(OR(F3="Cliente",LEFT(C3,11)="Sin detalle",N(J3)=0),0,MAX(0,CEILING(N(J3)*IFERROR(VLOOKUP($A3,Forecast_Config!$A$2:$N,14,FALSE),Config!$Q$4) + Y3 + Z3 - R3 - AA_Transito, 1))))
  
  ```

  *(Donde `Config!$Q$4` es `FACTOR_PEDIDO` = `1.9` por defecto, sobreescribible por SKU en `Forecast_Config.factor_reposicion`.)*

## 5. Reglas de Negocio Completas (R-31 … R-48)

Estas 18 reglas cierran **todos** los vacíos operativos detectados entre v3.0, v3.1 y los nuevos flujos de v4.1.0.0. Todas se ejecutan en el **backend** (`05_Validators.gs`), nunca solo en el frontend ni en fórmulas vulnerables.

| ID | Regla | Comportamiento Obligatorio del Sistema | 
| ----- | ----- | ----- | 
| **R-31** | **Llave única de puerta** | `sku_puerta` (`DEC-AA-NNN` o `EXT-AA-NNN`) es generado por `_SEQ` en el servidor y único sin distinguir mayúsculas. Toda edición usa `uid`; si una llave coincide con >1 fila, devuelve `CONFLICT`. | 
| **R-32** | **Instaladores descuentan stock atómicamente** | `instaladores.createBatch` crea una Salida en `MOVIMIENTOS` (`ref_tipo=INSTALADOR`, `ref_id=lote_id`, taller `Instaladores`) y guarda `mov_uid` en `InsumosInstaladores` en el mismo lote. Rechaza `EQU-*` (van a Préstamos). Si falla 1 línea, se cancela todo el lote. | 
| **R-33** | **Referencia estructurada** | Toda salida a puerta, instalador o taller guarda `ref_tipo` (`PUERTA`, `INSTALADOR`, `TALLER`, `CONTEO`, `MANUAL`) y `ref_id` existente. El consumo real por puerta = `Σ Salidas − Σ Devoluciones` por `ref_id` (adiós regex en `observaciones`). | 
| **R-34** | **Máquina de estados de puerta** | Flujo: `Por fabricar → Programado → En proceso → En armado → En pintura → Listo para entrega → Entregada`. Retroceder solo `admin`; `Cancelada` desde cualquier estado menos `Entregada`. Prohibido entregar insumos a puertas `Entregada` o `Cancelada`. | 
| **R-35** | **Catálogo cerrado de talleres** | Solo valores de `Config.Talleres` (`Santa Ana`, `Sonsonate`, `Taller Central`, `Instaladores`, `Bodega`). Alias (`Taller 1` → `Taller Central`) se normalizan automáticamente al guardar. `Sin asignar` solo permitido en `Ajuste`. | 
| **R-36** | **Compra completa y control DTE** | `Proveedor`, `Precio unit. pagado > 0` y `Tipo de DTE` son obligatorios (salvo `GEN-*`). DTE `Pendiente` se tolera máximo **5 días hábiles**; al día 6 levanta alerta en Calidad de Datos. Todo SKU nuevo exige `stock_minimo >= 0`. | 
| **R-37** | **Umbral mínimo para pronóstico IA** | Un SKU entra a semáforo `ROJO`/`NARANJA` por tasa EMA solo con **≥ 14 días de historial y ≥ 3 salidas**; antes se evalúa solo por `stock <= 0` o `stock <= mínimo` y muestra confianza `BAJA` / `Datos en calibración`. | 
| **R-38** | **Política de stock negativo** | Configurable vía `BLOQUEAR_NEGATIVO` en `Config` (`false` al arrancar el lunes para no frenar taller, con advertencia visible + conteo en Calidad de Datos; activar `true` tras conciliar en semana 2). | 
| **R-39** | **Concurrencia optimista** | Cada registro transaccional almacena `uid` y `updated_at` (`version`). Cualquier `update` debe enviar `version`; si otro usuario editó primero, el servidor rechaza con `CONFLICT` y devuelve la fila vigente. | 
| **R-40** | **Cierre y archivo anual** | `archivo.cerrar` solo corre si Conciliación tiene 0 diferencias fuera de tolerancia y Calidad de Datos está en 0; traslada el año cerrado a `*_AAAA` y fija el conteo de cierre como nuevo `Stock inicial`. | 
| **R-41** | **Cálculo híbrido de compra sugerida** | Usa `FACTOR_PEDIDO` (default `1.9` para Clase A, configurable por SKU en `Forecast_Config`) descontando stock actual y cantidades en cotizaciones `APROBADA`/`ENVIADA`. Al alcanzar confianza `MEDIA`, permite conmutar a `MAX(regla_factor, consumo_semanal_EMA)`. | 
| **R-42** | **Anti-duplicado de abastecimiento** | Un SKU incluido en una cotización en estado `BORRADOR`, `APROBADA` o `ENVIADA` se marca como *"En gestión"* en el Dashboard de Alertas y no vuelve a sugerirse hasta que se reciba (`Compras`) o se cancele la cotización. | 
| **R-43** | **Precios variables y fiscalidad por proveedor** | Cada proveedor en `Config` define `precios_incluyen_iva` (`SI` para Construlemus/Lemus; `NO` para Freund y Didelco). Al cotizar, el precio unitario se precarga como referencia desde `Precios_Proveedor`, pero **siempre es editable**. El cálculo de Subtotal, IVA 13% y Total se normaliza automáticamente según la bandera fiscal del proveedor. | 
| **R-44** | **Cotización seleccionable y hoja dedicada** | Cada cotización tiene una sección de selección por checkboxes (`incluir = TRUE/FALSE`) filtrable por tipo (**Materiales**, **Insumos**, **Equipos**). Solo las líneas marcadas suman al total y se exportan a: (a) **1 hoja individual en Sheets** (`COT-AA-NNN`) y/o **PDF Ejecutivo para Finanzas** (con precios, IVA y firmas), y (b) **PDF/PNG para Proveedor** (sin precios, con código del proveedor y cantidades, listo para WhatsApp). | 
| **R-45** | **Alertas en Dashboard, cero spam en Gmail** | `runDailyForecast` (5:30 a.m.) actualiza datos y caché para el Dashboard sin enviar correos diarios de stock. El Dashboard muestra las alertas clasificadas (`ROJO`, `NARANJA`, `CALIDAD`) con acción directa de 1 clic. | 
| **R-46** | **Calidad de datos guiada** | Pantalla dedicada con 8 controles automáticos en tiempo real (compras sin DTE/proveedor/precio; SKUs sin mínimo/conteo/stock negativo; puertas/movimientos sin taller) para limpiar los huecos de datos durante la semana 1. | 
| **R-47** | **Seguridad endurecida de producción** | `ENFORCE_AUTH=true` obligatorio. Eliminado usuario por defecto `anon/cristian`. Cada usuario en `_USERS` tiene `salt` único (`sha256(salt + pin)`), bloqueo automático tras **5 intentos fallidos** (15 min) y rotación de PIN desde la app. | 
| **R-48** | **Trazabilidad SKU ↔ Código Proveedor** | Al aprobar o recibir una cotización, `Precios_Proveedor` actualiza automáticamente `codigo_proveedor`, `ultimo_precio_unitario`, `incluye_iva` y `fecha_actualizacion` para acelerar la siguiente cotización. | 

## 6. Flujo de Trabajo Operativo (Día a Día desde el Lunes)

### 6.1 Ciclo Diario en 4 Pasos Simples

1. **5:30 a.m. (Automático, silencioso):** El trigger `runDailyForecast` corre en Apps Script, actualiza tasas EMA, refresca el snapshot de alertas y valida la integridad del esquema (`schema.validate`). Sin correos molestos.

2. **7:00 a.m. — Revisión en Dashboard (2 minutos):** Abres el Dashboard en React (celular o PC). Ves las tarjetas KPI y el **Centro de Alertas en Vivo** (SKUs en `ROJO`/`NARANJA` y pendientes de Calidad de Datos).

3. **Durante el día — Operación de Taller y Bodega:**

   * **Salidas a taller / puerta:** Se registran en `Movimientos` eligiendo `ref_tipo` (`PUERTA` o `TALLER`) y `ref_id`.

   * **Entregas a instaladores:** Se registran en `Instaladores` con chips de 1 clic → el backend descuenta stock automáticamente en `MOVIMIENTOS`.

   * **Avance de puertas:** Cambio de estado directo en tarjeta (`AgendaDePuertas`) respetando R-34.

4. **Cuando toca cotizar / abastecer — Flujo de Cotizaciones (2–5 minutos):**

   * **Desde Alertas o desde cero:** Pulsas *"Crear Cotización"* (agrupada por proveedor: Freund / Didelco / Lemus, o **Consolidado Multi-Taller** Sonsonate + Santa Ana).

   * **Selección con Checkboxes:** Filtras por pestaña o etiqueta (**Materiales**, **Insumos**, **Equipos**), marcas solo los ítems que vas a pedir y ajustas cantidades o precios cotizados.

   * **Dos salidas en 1 clic:**

     * **Para Proveedor (WhatsApp):** Exporta PDF/PNG limpio con código del proveedor, descripción, unidad y cantidad (sin precios internos).

     * **Para Finanzas (Aprobación):** Crea la hoja individual `COT-26-NNN` en Sheets (si se requiere respaldo en libro) y/o descarga el **PDF Ejecutivo de Cotización** con solo los ítems marcados, Subtotal, IVA 13%, Total y bloque de firma/aprobación.

   * **Cierre al recibir mercadería:** Al llegar la factura/DTE de Hacienda, importas el JSON DTE en `Compras` enlazándolo a `cotizacion_id` → la cotización pasa a `RECIBIDA`, el stock sube, se actualizan los precios de referencia y se libera el anti-duplicado.

## 7. Contrato de API Unificado (Apps Script v4.1.0.0)

### 7.1 Sobre Estándar de Respuesta

Todas las peticiones (`POST` con `Content-Type: text/plain;charset=utf-8` o `GET` para lectura rápida) devuelven el mismo formato:

```
{
  "ok": true,
  "data": { "...": "..." },
  "meta": {
    "requestId": "req_9f8a7b6c",
    "version": "4.1.0.0",
    "durationMs": 420
  }
}

```

Errores estandarizados: `AUTH`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `LOCK_TIMEOUT`, `SCHEMA_MISMATCH`, `INTERNAL`.

### 7.2 Catálogo de Endpoints (Nuevos y Modificados en v4.1.0.0)

| Módulo | Acción | Tipo | Qué Hace | 
| ----- | ----- | ----- | ----- | 
| **Sistema / Auth** | `auth.login`, `auth.me`, `auth.setPin`, `auth.users.update` | Actualizado | Login con sal única, bloqueo 5 intentos, gestión de usuarios | 
| **Sistema / Admin** | `schema.validate`, `log.restore`, `archivo.preview`, `archivo.cerrar` | Nuevo / Mejora | Integridad 0 `#REF!`, restauración desde `_LOG`, cierre anual | 
| **Dashboard** | `dashboard.get {clave_mes, taller}` | Optimizado | Lee snapshot cacheado + **Alertas en vivo** (stock + calidad + cotizaciones abiertas) | 
| **Catálogo** | `catalogo.list`, `catalogo.create`, `catalogo.update`, `catalogo.kardex`, `catalogo.nextSku` | Optimizado | Caché 60 s, filtro por categoría (reemplaza `Inv.*`), `uid` + `version` | 
| **Cotizaciones** | `cotizaciones.list {estado?, proveedor?}` | **NUEVO** | Lista cotizaciones (`BORRADOR`, `APROBADA`, `ENVIADA`, `RECIBIDA`, `CANCELADA`) | 
| **Cotizaciones** | `cotizaciones.fromAlerts {proveedor?, incluirClase?}` | **NUEVO** | Pre-arma borrador desde alertas activas aplicando `FACTOR_PEDIDO` y anti-duplicado (R-41, R-42) | 
| **Cotizaciones** | `cotizaciones.create` / `cotizaciones.update` | **NUEVO** | Guarda cabecera + líneas con flag `incluir` (checkbox), tipo (`MATERIAL`/`INSUMO`/`EQUIPO`) y precios editables | 
| **Cotizaciones** | `cotizaciones.setEstado {cot_id, estado}` | **NUEVO** | Controla transiciones (`BORRADOR → APROBADA → ENVIADA → RECIBIDA` / `CANCELADA`) | 
| **Cotizaciones** | `cotizaciones.createSheet {cot_id}` | **NUEVO** | Genera **1 hoja dedicada** en Sheets (`COT-26-NNN`) a partir de `Plantilla_Cotizacion` solo con líneas marcadas (`incluir=true`) lista para imprimir/archivar | 
| **Precios Prov.** | `precios.list {sku?, proveedor?}` / `precios.upsert` | **NUEVO** | Consulta y actualiza código de proveedor, último precio y flag IVA | 
| **Compras** | `compras.list`, `compras.createBatch`, `compras.importDte` | Mejorado | Validación R-36, enlace opcional a `cotizacion_id`, escritura batch `setValues()` | 
| **Movimientos** | `movimientos.list {desde, hasta}`, `movimientos.createBatch`, `movimientos.entregarAPuerta`, `movimientos.listByRef` | Mejorado | Paginación por rango de fechas, `ref_tipo` + `ref_id`, validación taller R-35 y stock R-38 | 
| **Instaladores** | `instaladores.createBatch` | Mejorado | Atómico: escribe en `MOVIMIENTOS` (`ref_tipo=INSTALADOR`) y guarda `mov_uid` en `InsumosInstaladores` | 
| **Puertas** | `puertas.nextSku`, `puertas.create`, `puertas.update`, `puertas.setEstado`, `puertas.consumo` | Mejorado | SKU desde `_SEQ`, llave única R-31, máquina de estados R-34, comparativo BOM vs consumo real | 
| **Calidad / Stock** | `calidad.get`, `stock.porTaller`, `bom.fromAgenda` | **NUEVO** | 8 controles de calidad, matriz SKU × taller, modelos abiertos sin BOM | 
| **Forecast** | `forecast.get`, `forecast.alerts`, `forecast.projection`, `forecast.params.*`, `forecast.config.*`, `forecast.bom.*`, `forecast.run` | Mejorado | Umbral 14 días (R-37), `factor_reposicion` por SKU, sin spam por correo | 

### 7.3 Payload de Ejemplo: `cotizaciones.create`

```
{
  "action": "cotizaciones.create",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "params": {
    "cabecera": {
      "proveedor": "FREUND",
      "taller_destino": "Sonsonate",
      "precios_incluyen_iva": false,
      "notas": "Abastecimiento semanal abrasivos y selladores"
    },
    "lineas": [
      {
        "incluir": true,
        "tipo_item": "INSUMO",
        "sku": "ABR-001",
        "codigo_proveedor": "572931",
        "descripcion": "Disco de lija seco 127 mm Pferd grano 80 (velcro)",
        "unidad": "disco",
        "cantidad": 432,
        "precio_unitario": 0.45,
        "taller_linea": "Sonsonate"
      }
    ]
  }
}

```

## 8. Especificación de Pantallas y Ergonomía UX (React 19)

### 8.1 Mapa de Navegación Limpio (9 Módulos)

| \# | Módulo en Sidebar | Rol Principal | Objetivo Ergonómico | 
| ----- | ----- | ----- | ----- | 
| 1 | **Dashboard y Alertas** | Todos (según rol) | KPIs + **Centro de Alertas en Vivo** (reemplaza Gmail) con botón *"Cotizar seleccionados"* | 
| 2 | **Cotizaciones (NUEVO)** | Admin, Compras | Selector por checkboxes (**Materiales / Insumos / Equipos**), precios editables, **PDF Finanzas** y **PDF WhatsApp** | 
| 3 | **Catálogo y Kardex** | Admin, Compras, Bodega | Vista única con filtros por categoría (sustituye las 6 hojas `Inv.*`), Kardex y Conteo Físico | 
| 4 | **Compras y DTE** | Admin, Compras | Importador JSON DTE Hacienda + cierre automático de cotizaciones aprobadas | 
| 5 | **Movimientos** | Admin, Bodega | Salidas, Devoluciones, Ajustes y Entrega a Puerta (`ref_tipo` + `ref_id`) | 
| 6 | **Instaladores** | Admin, Bodega, Taller | Chips de 1 clic para insumos frecuentes con descuento real de inventario | 
| 7 | **Agenda de Puertas** | Todos | Tarjetas por taller, selector de estado validado (R-34), consumo real vs BOM | 
| 8 | **Abastecimiento IA** | Admin, Compras, Bodega | Proyección 14/30 días, BOM por modelo y parámetros (`FACTOR_PEDIDO`, lead times) | 
| 9 | **Calidad y Préstamos** | Admin, Compras, Bodega | Tab 1: **8 Controles de Calidad de Datos**; Tab 2: Conciliación; Tab 3: Préstamos `EQU-*` | 

### 8.2 Diseño de la Pantalla Estrella: Generador de Cotizaciones (`CotizacionesView.jsx`)

Pensada para operar en **2 minutos desde el celular o escritorio**:

* **Selector de modo:** *Por Proveedor* (Freund, Didelco, Construlemus, Todokolor, Golem) o *Consolidado Multi-Taller* (columnas Sonsonate + Santa Ana + Total, igual al formato real de `Orden_Materiales_Sonsonate_Santa_Ana`).

* **Pestañas / Filtros rápidos con Checkbox maestro:** `Todos` · `Materiales` (`MET-*`, `VID-*`, `CLI-*`) · `Insumos` (`ABR-*`, `PIN-*`, `SEL-*`, `CON-*`) · `Equipos` (`EQU-*`).

* **Tabla interactiva:**

  * Checkbox `Incluir` por fila (solo lo marcado entra al PDF y a los totales).

  * Cantidad precargada con la sugerencia (`FACTOR_PEDIDO`), editable con botones `- / +`.

  * Precio unitario precargado desde `Precios_Proveedor`, editable en línea (porque los precios varían).

  * Switch fiscal automático según proveedor: *"Precios + IVA 13%"* (Freund/Didelco) vs *"Precios incluyen IVA"* (Lemus).

* **Barra de exportación fija (sticky bottom en móvil):**

  * **Botón 1 — PDF para Finanzas:** Documento formal de GRUPO DECORM con N.º de cotización (`COT-26-NNN`), fecha, proveedor, tabla solo de ítems marcados, Subtotal, IVA 13%, Total a aprobar y espacios de firma (*Elaborado por / Aprobado Finanzas*).

  * **Botón 2 — PDF / Imagen para Proveedor (WhatsApp):** Misma selección de ítems **sin columna de precios**, resaltando el código del proveedor y las cantidades por taller.

  * **Botón 3 — Crear Hoja en Google Sheets:** Invoca `cotizaciones.createSheet` para dejar una pestaña individual `COT-26-NNN` archivada en el libro maestro cuando Finanzas o auditoría lo requieran.

## 9. Plan de Implementación en Limpio para Arrancar el Lunes

### Fase 0 — Sábado / Domingo (Construcción en Limpio y Migración)

1. **Crear el libro nuevo `DECORM_GROUP_v4.xlsx` en Google Sheets** con las 18 hojas limpias, rangos con nombre abiertos, sin filas `TOTAL` en tablas y `Plantilla_Cotizacion`.

2. **Migrar datos limpios desde `DECORM_GROUP.xlsx`:**

   * Copiar los 130 SKUs a `Catalogo` (corrigiendo los 4 SKUs fuera de rango: `SEL-010`, `HER-016`, `HER-017`, `PIN-032`).

   * Copiar compras y movimientos normalizando `Taller 1` → `Taller Central` y agregando `uid` + `updated_at`.

   * Restaurar la puerta `DEC-26-009` de Juan José Cornejo (`NYRIX`) desde `_LOG` y asignar `DEC-26-010` a Luis Eliseo Paz.

   * Poblar `Config` con proveedores + bandera fiscal (`Freund`: sin IVA, `Didelco`: sin IVA, `Lemus`: con IVA), talleres cerrados, estados de puerta y `FACTOR_PEDIDO = 1.9`.

   * Cargar en `Precios_Proveedor` los códigos y últimos precios conocidos de `DatosDecorm.zip` (Freund, Didelco, Lemus).

3. **Desplegar Backend Apps Script v4.1.0.0** (10 archivos `.gs`) en el nuevo proyecto vinculado a `DECORM_GROUP_v4`:

   * Ejecutar `setupV4()`, `installDailyTrigger()` (5:30 a.m.) y `activarAutenticacionEstricta()` (`ENFORCE_AUTH=true`).

   * Crear PINs distintos con sal única para `cristian` y `emma` en `_USERS`.

   * Correr `schema.validate` y exigir **0 errores**.

4. **Inicializar nuevo repositorio React 19 + Vite** con la estructura modular de §3.3 apuntando a la nueva URL `/exec` de v4.1.0.0.

### Fase 1 — Lunes 7:00 a.m. (Go-Live Operativo)

* Operación normal de salidas (`Movimientos`), entregas a instaladores (ya descontando stock), agenda de puertas (con SKU autogenerado) y primeras cotizaciones desde la pantalla con checkboxes + PDF para Finanzas.

### Fase 2 — Semana 1 y 2 (Cierre de Huecos de Datos)

* Usar la pantalla **Calidad de Datos** para bajar a 0 los huecos críticos en el Top 30 de SKUs más comprados: completar `Stock mínimo`, `Proveedor preferido` y `Precio ref.` (o vía primeras compras/cotizaciones).

* Confirmar las 13 equivalencias `⚠ CONFIRMAR` en `Equivalencias`.

* Poblar `BOM_Puertas` para los modelos activos (`LYNUX`, `NYRIX`, `ANDRÓMEDA`, `LORVAK`, `IMPERIUM`, `ITZEL`).

* Al cumplir 14 días de historial limpio, activar `BLOQUEAR_NEGATIVO = true` (si se desea control estricto) y evaluar el modo híbrido EMA en el pronóstico.

## 10. Matriz de Pruebas de Aceptación (T-01 … T-20)

Todas las pruebas se ejecutan sobre el nuevo libro `DECORM_GROUP_v4` antes de abrir el lunes:

| ID | Prueba | Resultado Esperado | Regla / Req. | 
| ----- | ----- | ----- | ----- | 
| **T-01** | Crear dos puertas seguidas | SKUs consecutivos distintos desde `_SEQ` (`DEC-26-011`, `DEC-26-012`) | R-31 | 
| **T-02** | Editar misma puerta desde dos sesiones | La segunda recibe `CONFLICT` con la versión vigente, sin pisar datos | R-39 | 
| **T-03** | Lote de 3 insumos a instalador + lote con 1 equipo `EQU-001` | El 1.º descuenta los 3 SKUs en `MOVIMIENTOS` y enlaza `mov_uid`; el 2.º rechaza todo el lote | R-32 | 
| **T-04** | Entrega a puerta `Entregada` o inexistente | Rechazada con `VALIDATION`; consumo real por puerta suma solo `ref_id` | R-33, R-34 | 
| **T-05** | Agregar SKU en fila 500 de `Catalogo` y compra en fila 600 | Validación OK y stock actualizado automáticamente | Rangos abiertos | 
| **T-06** | Ejecutar `schema.validate` | 0 encabezados faltantes, 0 `#REF!`/`#N/A`, 0 filas `TOTAL` en datos, 0 hashes PIN repetidos | R-47 | 
| **T-07** | Movimiento con taller `"Taller 1"` | Normalizado automáticamente a `Taller Central` | R-35 | 
| **T-08** | Compra CCF sin proveedor o con precio `$0` | Rechazada con `VALIDATION` (excepto `GEN-*`) | R-36 | 
| **T-09** | Pronóstico de SKU con 4 días de historial | No dispara falsa alarma EMA; evalúa solo por mínimo/agotado con confianza `BAJA` | R-37 | 
| **T-10** | Llamada sin token + 5 PINs erróneos | Sin token → `AUTH`; 5 intentos fallidos → usuario bloqueado y registrado en `_LOG` | R-47 | 
| **T-11** | Sugerencia `ABR-001` con `FACTOR_PEDIDO=1.9`, mínimo 300, stock 138 | Sugiere `432` discos; tras crear cotización `APROBADA` por 432, sugerencia pasa a `0` | R-41, R-42 | 
| **T-12** | Cotización con 10 líneas donde solo 6 tienen checkbox `incluir=true` | Totales, hoja `COT-26-001` y PDF para Finanzas muestran **únicamente las 6 líneas marcadas** | R-44 | 
| **T-13** | Cotización `FREUND` (sin IVA) vs `LEMUS` (con IVA) | `FREUND` suma +13% IVA sobre subtotal; `LEMUS` desglosa IVA incluido sin duplicar 13% | R-43 | 
| **T-14** | Exportar PDF Proveedor vs PDF Finanzas | PDF Proveedor oculta precios y muestra código proveedor; PDF Finanzas incluye precios, IVA y firmas | R-44 | 
| **T-15** | Corrida diaria `runDailyForecast` (5:30 a.m.) | Actualiza Dashboard y caché en <20 s sin enviar spam a Gmail | R-45 | 
| **T-16** | Importar JSON DTE enlazado a `cotizacion_id` | Registra compra, actualiza `Precios_Proveedor`, marca cotización `RECIBIDA` y libera anti-duplicado | R-42, R-48 | 
| **T-17** | Restauración `log.restore` sobre fila modificada | Reconstruye exactamente el estado `"Antes (JSON)"` | Auditoría | 
| **T-18** | Prueba de carga (5 usuarios simultáneos, lote 50 líneas) | 0 `LOCK_TIMEOUT`, escritura batch <6 s, lecturas cacheadas p95 ≤3 s | Escalabilidad | 
| **T-19** | `calidad.get` sobre libro recién migrado | Reporta conteos exactos de los 8 controles (mínimos, proveedores, precios, DTE, negativos) | R-46 | 
| **T-20** | Simulación de `archivo.preview` | Bloquea cierre si Calidad > 0; proyecta saldos iniciales sin alteración al conciliar | R-40 | 

## 11. Hoja de Ruta v5.0 — Control de Thinner (`CON-002`) y Wiper (`CON-003`)

Tal como se acordó, el control fino de consumibles a granel queda fuera de v4.1.0.0 para no frenar el arranque del lunes, pero el diseño v4.1.0.0 ya deja las bases listas (`unidad_compra` vs `unidad_despacho` y `ref_tipo=TALLER`) para evaluar en **v5.0** el mejor mecanismo sin burocracia:

1. **Thinner (`CON-002`):**

   * **Problema real:** Se compra en galón o tambor, pero en pintura se consume por chorros/ml difíciles de registrar en cada salida.

   * **Propuesta a evaluar en v5.0 (Control por Envase Dosificador):** Bodega despacha únicamente **envases cerrados de 1 L o 1 Galón** al área de pintura/enmasillado (1 salida = 1 envase completo asignado a estación/taller). Solo se entrega un envase nuevo contra devolución del envase vacío (regla *"envase por envase"*), registrando fecha y consumo real por semana sin medir mililitros.

2. **Wiper de tela por libra (`CON-003`):**

   * **Problema real:** Se compra por fardo/libras (0.453 kg), pero el personal pide retazos sueltos y las salidas parciales generan diferencias de conciliación (hoy: 8 físico vs 23 sistema).

   * **Propuesta a evaluar en v5.0 (Paquetes Pre-Pesados o Cuota Semanal):** Fraccionar el ingreso en bodega en **bolsas estándar de 1 libra** (o 0.5 lb) y asignar una **cuota semanal por estación/instalador** (ej. 1 lb por cuadrilla/semana). Cualquier entrega extra fuera de cuota exige motivo en `observaciones`, permitiendo detectar desperdicio sin pesar cada trapo.

3. **Evolución a Etapa B (Base de Datos Transaccional):**

   * Evaluar migración de `04_RepoSheets.gs` → Postgres/Supabase cuando se cruce cualquiera de los umbrales de la Sección 3.4, manteniendo Google Sheets como tablero exportable para gerencia y Finanzas.