# SDD v3.1 — Sistema Maestro DICORMS (solo nuevas implementaciones)

Nov 20, 2026 · @Someone

## 1. Alcance del delta v3.0 → v3.1

Esta versión agrega **14 implementaciones** que cierran los vacíos detectados en la auditoría del 20-nov-2026 de `dicorms_backend_unificado_v3.js` contra el libro `DECORM_GROUP.xlsx`. No repite lo ya especificado: la línea base sigue vigente y los números nuevos continúan su serie.

| Elemento | Línea base (vigente) | Serie nueva en v3.1 |
| --- | --- | --- |
| Documento | SDD v1.0 (2026-11-16) + `ESPECIFICACION_HOJAS_DICORMS.md` + guía React v3.0 | Este documento |
| Requerimientos funcionales | RF-01 … RF-17 | **RF-18 … RF-31** |
| Requerimientos no funcionales | RNF-01 … RNF-08 | **RNF-09 … RNF-14** |
| Reglas de negocio | R-01 … R-30 | **R-31 … R-40** |
| Decisiones abiertas | D-1 … D-6 | **D-7 … D-11** |
| Backend / libro | Apps Script v3.0 sobre `DECORM_GROUP.xlsx` (29 hojas) | Mismo stack; cambios en §7 y §8 |

**Fuera de alcance de v3.1:** contabilización automática, app Flutter offline (F4 del SDD 1.0) y cambio de plataforma de datos, que se deja con umbral explícito en §9.

## 2. Hallazgos que originan los cambios

El esquema del backend coincide con las 9 entidades del libro (0 encabezados faltantes) y el código no tiene errores de sintaxis. Los 12 hallazgos siguientes son de **flujo, integridad y escala**, no de esquema.

| ID | Hallazgo | Evidencia en `DECORM_GROUP.xlsx` / backend | Se resuelve en |
| --- | --- | --- | --- |
| H-01 | Llave duplicada en la agenda de puertas | `DEC-26-009` aparece en las filas 9 y 12. El `UPDATE` del 20-nov 15:58 sobrescribió la puerta de Juan José Cornejo (NYRIX) con la de Luis Eliseo Paz | RF-18, R-31 |
| H-02 | Entregas a instaladores no descuentan stock | `handleInstaladoresBatch_` solo escribe en `InsumosInstaladores`; el stock del catálogo se calcula únicamente desde `MOVIMIENTOSInsumosOperativo` | RF-19, R-32 |
| H-03 | Vínculo puerta–movimiento por texto libre | `handleEntregarAPuerta_` escribe "Puerta DEC-…" en `observaciones`; el pronóstico lo detecta con una expresión regular (`/puerta\|dec-\d/i`) | RF-20, R-33 |
| H-04 | Rangos fijos de fórmulas ya excedidos | `Catalogo!A3:A128` valida SKUs y hay 4 SKUs más abajo (SEL-010, HER-016, HER-017, PIN-032): 2 compras salen "SKU no existe". `Compras` suma hasta la fila 250 (datos hasta la 103) y `Movimientos` hasta la 332 (datos hasta la 151) | RF-21 |
| H-05 | Referencias rotas | 52 `#REF!` en `GASTO_MES`, 4 en `SeguimientoManualStok`, 3 en la fila TOTAL de `Movimientos`, 1 `#N/A` en `Inicio` | RF-22 |
| H-06 | Filas TOTAL mezcladas con datos | TOTAL en `Compras` (fila 103), `Movimientos` (151), `AgendaDePuertas` (62) y `Catalogo` (179); cada llenado inserta 50 filas más | RF-22 |
| H-07 | Talleres sin catálogo cerrado | Datos usan "Taller 1" (12 movimientos, 2 puertas), "Por confirmar" y "-"; `Config` define Santa Ana, Sonsonate, Taller Central, Instaladores, Bodega | RF-23, R-35 |
| H-08 | Datos maestros incompletos | De 54 compras: 51 con DTE "Pendiente", 21 sin proveedor, 30 sin precio. Catálogo (130 SKUs): 43 "SIN CONTEO", ≈58 sin stock mínimo, 3 con stock negativo (ABR-004, ABR-005, HER-005). Valor de inventario: $43 | RF-24, R-36 |
| H-09 | Pronóstico sin insumos de entrada | `BOM_Puertas` vacía; movimientos de solo 4 días (17–20 nov); 1 fila en `Consumption_Observations` | RF-25, R-37 |
| H-10 | Escala del acceso a datos | `listEntity_` lee la hoja completa en cada llamada; `fcBuildContext_` carga catálogo, movimientos y compras enteros; un solo `getScriptLock()` de 15 s; lotes escritos fila por fila con `flush()` | RF-26, RNF-09, RNF-10 |
| H-11 | Seguridad | Los dos usuarios de `_USERS` comparten el mismo hash de PIN; con `enforceAuth=false` el backend devuelve a cualquiera como admin `cristian` | RNF-12 |
| H-12 | Desfase documental | La guía React dice lock de 30 s (código: 15 s) y 128 SKUs (hoy 130) | RNF-14 |

## 3. Cambios al modelo de datos

`MOVIMIENTOSInsumosOperativo` pasa a ser el **único libro de salidas de insumos**: instaladores, puertas y pedidos de taller escriben allí con una referencia estructurada (`ref_tipo` + `ref_id`) en lugar de texto libre. Las llaves de puertas y movimientos las genera el servidor.

| Hoja | Cambio en v3.1 | Motivo |
| --- | --- | --- |
| `MOVIMIENTOSInsumosOperativo` | Agregar `uid`, `ref_tipo` (PUERTA, INSTALADOR, TALLER, CONTEO, MANUAL), `ref_id`, `lote_id`, `origen` (APP, MIGRACION, MANUAL). Retirar las columnas A–F de préstamos históricos y llevarlas a `PrestamosEquipos` | H-02, H-03 |
| `InsumosInstaladores` | Agregar `fecha`, `taller`, `lote_id`, `mov_uid`. `Check` pasa a ser confirmación física; la fuente del descuento es el movimiento enlazado por `mov_uid` | H-02 |
| `AgendaDePuertas` | `SKU Puerta` generado por `_SEQ`; agregar `uid`. Columna `Estado` y `Taller` con listas cerradas desde `Config` | H-01, H-07 |
| `BOM_Puertas` | Agregar `unidad`, `activo`, `version`; `modelo` validado contra la lista de modelos de `Config`. Poblar al menos los modelos con puertas abiertas en la agenda | H-09 |
| `Compras` | Agregar `uid`. `Proveedor`, `Precio unit. pagado` y `Tipo de DTE` obligatorios salvo SKU `GEN-*` (R-36) | H-08 |
| `Config` | Nuevas listas: **Talleres** (nombre + alias), **Estados de puerta**, **Modelos de puerta**, **Tipos de referencia** | H-07 |
| `_SEQ` | Nuevas claves: `PUERTA_DEC_AA`, `PUERTA_EXT_AA`, `MOV`, `LOTE` | H-01 |
| `_LOG` | Agregar `request_id` y política de archivo mensual | H-10 |
| `Movimientos_AAAA`, `Compras_AAAA` (nuevas) | Hojas de archivo anual; el libro vivo conserva el último año móvil (D-10) | H-10 |

**Estados de puerta cerrados (se unifican la guía React y los datos reales):** Por fabricar · Programado · En proceso · En armado · En pintura · Listo para entrega · Entregada · En confirmación · Cancelada. "Extra" deja de ser un estado y pasa al prefijo del SKU (`EXT-AA-NNN`).

## 4. Nuevos requerimientos funcionales (RF-18 … RF-31)

Catorce requerimientos, cada uno con un criterio verificable. Las fases (F0–F3) se detallan en §11.

| ID | Requerimiento | Criterio de aceptación | Fase |
| --- | --- | --- | --- |
| RF-18 | El servidor genera el SKU de puerta (`DEC-AA-NNN`, `EXT-AA-NNN`) desde `_SEQ` y rechaza cualquier `puertas.create` o `puertas.update` cuya llave ya exista en otra fila | Crear dos puertas seguidas nunca repite SKU; un `update` con llave duplicada devuelve `CONFLICT` y no modifica la hoja | F0 |
| RF-19 | `instaladores.createBatch` crea, en la misma transacción, una Salida en `MOVIMIENTOS` por cada línea (`ref_tipo=INSTALADOR`, `ref_id=lote_id`, taller "Instaladores") y guarda el `mov_uid` en `InsumosInstaladores` | Entregar 5 discos ABR-001 a un instalador baja `STOCK ACTUAL` en 5; si falla una línea, no se guarda ninguna | F1 |
| RF-20 | `movimientos.entregarAPuerta` guarda `ref_tipo=PUERTA` y `ref_id=sku_puerta`; valida que la puerta exista y no esté Entregada ni Cancelada | Una entrega a puerta inexistente devuelve `VALIDATION`; el consumo real por puerta se calcula sumando `ref_id`, sin leer `observaciones` | F1 |
| RF-21 | Todas las fórmulas del libro usan rangos abiertos o rangos con nombre (`rng_SKU`, `rng_ComprasSKU`, `rng_MovSKU`…) | Un SKU en la fila 500 de `Catalogo` valida OK; una compra en la fila 600 suma al stock | F0 |
| RF-22 | Limpiar el libro: eliminar los 60 `#REF!`/`#N/A`, mover las filas TOTAL a la hoja `Inicio` o a una fila de encabezado, y retirar las columnas A–F heredadas de `MOVIMIENTOS` | `handleSchemaValidate_` reporta 0 errores y 0 filas TOTAL dentro de rangos de datos | F0 |
| RF-23 | Lista cerrada de talleres en `Config` con alias; migrar "Taller 1" a **Taller Central** (D-7) y rechazar valores fuera de lista | 0 movimientos o puertas con taller fuera de lista; "Sin asignar" solo en Ajustes | F0 |
| RF-24 | Pantalla "Calidad de datos" con 8 controles: compras sin DTE, sin proveedor, sin precio; SKU sin mínimo, sin conteo, con stock negativo; puertas sin taller; movimientos sin taller | Cada control muestra conteo y lista; el contador baja a 0 antes del cierre de mes | F1 |
| RF-25 | CRUD de `BOM_Puertas` en la app y acción `bom.fromAgenda` que lista los modelos de la agenda sin BOM | Todo modelo con puerta abierta tiene al menos una línea de BOM antes de activar el pronóstico por proyecto | F2 |
| RF-26 | Lecturas por rango de fechas y paginadas en el servidor; caché de catálogo y `Config` (60 s); escrituras en lote con `setValues` | `compras.createBatch` de 50 líneas termina con un solo `flush()` y en menos de 6 s | F2 |
| RF-27 | Vista calculada **Stock por taller** (SKU × taller) a partir de compras con `Taller destino` y movimientos con `Taller / destino` | La suma por taller coincide con `STOCK ACTUAL` global ±0 | F3 |
| RF-28 | Herramienta de recuperación desde `_LOG`: `log.restore {uid}` reconstruye una fila desde su campo "Antes (JSON)" | Restaurar la puerta NYRIX de J. J. Cornejo desde el `UPDATE` del 20-nov 15:58 | F0 |
| RF-29 | Control de concurrencia optimista: toda actualización envía `version` (marca de última edición) y el servidor rechaza con `CONFLICT` si cambió | Dos usuarios editando la misma puerta: el segundo recibe aviso en vez de pisar | F1 |
| RF-30 | Cierre y archivo anual: mover compras y movimientos cerrados a `*_AAAA`, dejando conteo de cierre como stock inicial | Tras el cierre, los saldos del catálogo no cambian y el libro vivo baja de tamaño | F3 |
| RF-31 | Administración de usuarios: PIN propio por usuario, cambio de PIN, bloqueo tras 5 intentos, desactivación | Dos usuarios nunca comparten hash de PIN; el bloqueo aparece en `_LOG` | F3 |

## 5. Nuevos requerimientos no funcionales (RNF-09 … RNF-14)

Los seis fijan los límites de escala y seguridad que hoy no están medidos. Los valores de rendimiento son metas de diseño a validar en la prueba de carga de §10.

| ID | Requisito | Meta medible |
| --- | --- | --- |
| RNF-09 | **Rendimiento de lectura.** Los listados leen solo el rango pedido (fecha, página) y usan caché de catálogo y `Config` | p95 ≤ 3 s con 20 000 filas en `MOVIMIENTOS`; `forecast.alerts` ≤ 20 s |
| RNF-10 | **Concurrencia.** El candado se toma solo para escribir (la validación y el cálculo van fuera); `waitLock` de 30 s con reintento y backoff | Retención del candado ≤ 2 s por escritura; 5 usuarios simultáneos con 0 `LOCK_TIMEOUT` |
| RNF-11 | **Integridad.** `handleSchemaValidate_` corre en cada despliegue y en el disparador diario; los lotes son atómicos y llevan `requestId` por línea | 0 encabezados faltantes, 0 llaves duplicadas, 0 fórmulas con `#REF!` |
| RNF-12 | **Seguridad.** `ENFORCE_AUTH=true` en producción; sin usuario por defecto; PIN con sal distinta por usuario | Una llamada sin token devuelve `AUTH`; ningún hash repetido en `_USERS` |
| RNF-13 | **Observabilidad.** `_LOG` registra `request_id`, duración y resultado; alerta por correo si falla `runDailyForecast` | Toda escritura rastreable de punta a punta; falla del disparador notificada en ≤ 1 h |
| RNF-14 | **Documentación sincronizada.** Constantes (lock, número de SKUs, hojas) se generan desde `SCRIPT_CONFIG` y `SCHEMA`, no se escriben a mano | La guía y el código no se contradicen en ninguna cifra |

## 6. Nuevas reglas de negocio (R-31 … R-40)

Estas reglas se suman a R-01…R-30 y se implementan en el backend, no en fórmulas, para que no dependan de rangos de la hoja.

| ID | Regla | Qué hace el sistema |
| --- | --- | --- |
| R-31 | **Llave única de puerta.** `sku_puerta` es único sin distinguir mayúsculas. Una actualización se ubica por `uid`; si la llave coincide con más de una fila, nunca se toma "la primera" | Devuelve `CONFLICT` con las filas en conflicto |
| R-32 | **Entrega a instalador = salida de stock.** Cada línea con cantidad > 0 genera una Salida; los SKU de categoría "Equipos y herramientas" se rechazan (van a Préstamos). Una devolución del instalador es una Devolución con el mismo `ref_id` | Lote atómico; una línea inválida cancela todo el lote |
| R-33 | **Referencia estructurada.** `ref_tipo` pertenece a la lista cerrada y `ref_id` debe existir en su hoja de origen. Consumo real de una puerta = Σ Salidas − Σ Devoluciones con `ref_tipo=PUERTA` y ese `ref_id` | Sustituye la lectura por expresión regular de `observaciones` |
| R-34 | **Transiciones de estado de puerta.** Por fabricar → Programado → En proceso → En armado → En pintura → Listo para entrega → Entregada. Retroceder solo lo hace el admin; Cancelada se permite desde cualquier estado excepto Entregada. No se entregan insumos a puertas Entregada o Cancelada | Rechaza con `VALIDATION` y deja el motivo en `_LOG` |
| R-35 | **Taller válido.** El valor debe estar en `Config.Talleres` o ser un alias que se normaliza al nombre canónico. "Sin asignar" solo se acepta en Ajustes | Normaliza "Taller 1" a Taller Central (D-7) |
| R-36 | **Compra completa.** Proveedor, precio y tipo de DTE son obligatorios (excepto SKU `GEN-*`). Un DTE "Pendiente" se tolera hasta 5 días hábiles (D-8); desde el día 6 aparece como alerta. Todo SKU nuevo exige stock mínimo ≥ 0 | Bloquea el guardado o marca la línea según la regla |
| R-37 | **Umbral de datos para pronosticar.** Un SKU entra al semáforo rojo o naranja solo con ≥ 14 días de historia y ≥ 3 salidas; antes se muestra GRIS "Datos insuficientes". La proyección por BOM solo cuenta modelos que tienen BOM | Complementa `fcConfidence_`; evita alertas falsas con 4 días de datos |
| R-38 | **Stock negativo.** Se advierte y aparece en Calidad de datos. El parámetro `BLOQUEAR_NEGATIVO` (por defecto `false`) hace que una salida que deje el stock < 0 se rechace salvo para admin (decide D-4) | Aplica en `movimientos.create` y `instaladores.createBatch` |
| R-39 | **Concurrencia optimista.** Cada fila transaccional lleva `updated_at`; un `update` sin `version` o con una versión distinta se rechaza | Devuelve `CONFLICT` con la versión vigente |
| R-40 | **Cierre anual.** Solo si Conciliación tiene 0 diferencias fuera de tolerancia y Calidad de datos está en 0; el conteo de cierre pasa a Stock inicial del nuevo libro | Bloquea `archivo.cerrar` en caso contrario |

## 7. Cambios de API y backend

Se agregan 11 acciones y se modifican 8. Todas conservan el sobre `{ok, data|error}`, `requestId` y el control de roles ya definidos en el SDD 1.0.

| Acción | Tipo | Cambio | Req. |
| --- | --- | --- | --- |
| `puertas.nextSku {tipo}` | Nueva | Devuelve el siguiente `DEC-AA-NNN` o `EXT-AA-NNN` desde `_SEQ` | RF-18 |
| `puertas.create` | Modificada | Ignora el SKU enviado y lo genera; rechaza duplicados | RF-18, R-31 |
| `puertas.update` | Modificada | Exige `uid` y `version`; si hay más de una fila con la llave, `CONFLICT` | RF-18, RF-29 |
| `puertas.setEstado` | Modificada | Valida transiciones de R-34 | R-34 |
| `puertas.consumo {sku_puerta}` | Nueva | Plan según BOM contra consumo real por `ref_id`, con diferencia | RF-20 |
| `instaladores.createBatch` | Modificada | Crea Salidas y enlaza `mov_uid`; devuelve `lote_id` y `affected[]` | RF-19 |
| `movimientos.entregarAPuerta` | Modificada | Escribe `ref_tipo` y `ref_id`; valida puerta y estado | RF-20 |
| `movimientos.create` | Modificada | Acepta `ref_tipo`, `ref_id`; valida taller (R-35) y stock (R-38) | RF-23 |
| `movimientos.listByRef {ref_tipo, ref_id}` | Nueva | Trazabilidad de todo lo entregado a una puerta, lote o taller | RF-20 |
| `bom.fromAgenda` | Nueva | Lista modelos de la agenda sin BOM | RF-25 |
| `calidad.get` | Nueva | Los 8 controles de Calidad de datos con conteo y lista | RF-24 |
| `stock.porTaller {sku?}` | Nueva | Matriz SKU × taller | RF-27 |
| `log.restore {uid}` | Nueva | Reconstruye una fila desde el "Antes (JSON)" del `_LOG`; solo admin | RF-28 |
| `archivo.preview` / `archivo.cerrar {anio}` | Nuevas | Simula y ejecuta el cierre anual | RF-30 |
| `auth.setPin` / `auth.users.update` | Nuevas | Cambio de PIN, bloqueo y desactivación | RF-31 |
| `*.list` | Modificada | Agrega `desde`, `hasta`, `fields` y caché; lee solo el rango pedido | RF-26 |
| `schema.validate` | Modificada | Detecta fórmulas con `#REF!`, filas TOTAL en rango, llaves duplicadas y hashes de PIN repetidos | RNF-11 |

### 7.1 Parche de llave única (RF-18, R-31)

```javascript
// SCHEMA.agenda_puertas: agregar  uniqueKey: 'sku_puerta'
// createRow_: antes de firstFreeRow_(sh, def, cols)
if (def.uniqueKey) {
  const key = String(payload[def.uniqueKey] || '').trim().toUpperCase();
  if (!key) throw appError_('VALIDATION', 'Falta ' + def.uniqueKey);
  if (findRowsByKey_(sh, def, cols, key).length > 0) {
    throw appError_('CONFLICT', 'Ya existe ' + key + ' en ' + def.sheet);
  }
}
// updateByPk_: si findRowsByKey_ devuelve más de una fila -> CONFLICT, nunca la primera
```

### 7.2 Lote de instaladores con descuento de stock (RF-19, R-32)

```javascript
function handleInstaladoresBatch_(params, user, requestId) {
  const lote = nextCorrelative_('LOTE', 'LOT', 5);   // fuera del candado: toma el suyo
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    validarLineas_(params.lineas, params.cabecera);        // SKU existe, no es equipo, cantidad > 0, R-38
    const movs = params.lineas.map(function (l) {
      return buildMov_(l, { tipo: 'Salida', ref_tipo: 'INSTALADOR', ref_id: lote,
        taller_destino: 'Instaladores', entregado_a: params.cabecera.encargado_instalacion });
    });
    const rows = appendMovimientosBatch_(movs);           // un solo setValues
    appendInstaladores_(params, rows, lote);              // guarda mov_uid por línea
    SpreadsheetApp.flush();
    return { lote_id: lote, items: rows, affected: affectedBySkus_(movs) };
  } finally { lock.releaseLock(); }
}
```

`validarLineas_`, `buildMov_`, `appendMovimientosBatch_`, `appendInstaladores_`, `affectedBySkus_` y `findRowsByKey_` son funciones nuevas; las demás ya existen en el backend v3.0. Los nombres son propuesta de diseño y se confirman al implementar.

## 8. Cambios en el libro de Sheets

Las fórmulas dejan de apuntar a rangos con tope y pasan a **rangos con nombre abiertos** (por ejemplo `Compras!$G$2:$G`), que crecen solos. Con eso desaparece el riesgo de que una fila nueva quede fuera del cálculo.

| Rango con nombre | Apunta a | Reemplaza |
| --- | --- | --- |
| `rng_CatSKU` | `Catalogo!$A$3:$A` | `Catalogo!$A$3:$A$128` (validaciones de `Compras` y `Movimientos`) |
| `rng_ComprasSKU`, `rng_ComprasCant`, `rng_ComprasNeto`, `rng_ComprasPrecio` | `Compras!$C$2:$C`, `$G$2:$G`, `$J$2:$J`, `$L$2:$L` | `…$2:$250` en `Catalogo` K, T, U |
| `rng_MovSKU`, `rng_MovTipo`, `rng_MovCant` | `MOVIMIENTOSInsumosOperativo!$J$2:$J`, `$I$2:$I`, `$M$2:$M` | `…$2:$332` en `Catalogo` L y M |
| `rng_Talleres`, `rng_EstadosPuerta`, `rng_ModelosPuerta` | Listas nuevas en `Config` | Listas de validación escritas a mano |

**Otros cambios en el libro**

- **Columnas de control:** `uid` y `updated_at` en todas las hojas transaccionales, escritas solo por el backend (R-39).
- **Totales:** las filas TOTAL de `Compras`, `Movimientos`, `AgendaDePuertas` y `Catalogo` se reemplazan por una hoja `Resumen` con `SUM` sobre los rangos con nombre; así `ensureCapacity_` deja de buscar la fila TOTAL.
- **Errores heredados:** `GASTO_MES` (52 `#REF!`) se reconstruye desde `Compras`; `SeguimientoManualStok!J` y `Inicio!L6` se re-apuntan a `STOCK ACTUAL` y a los rangos de movimientos; `D151`, `M151` y `R151` de `Movimientos` desaparecen con la fila TOTAL.
- **Protección:** las columnas calculadas pasan de aviso a protección con edición solo para el propietario del script.

**Orden de aplicación (una sola ventana de mantenimiento, sin escrituras de talleres)**

1. Copia de seguridad del libro y exportación del `_LOG`.
2. Restaurar la puerta de J. J. Cornejo en la fila 9 desde el campo "Antes (JSON)" del `UPDATE` del 20-nov 15:58; reasignar a la puerta de L. E. Paz el siguiente SKU libre (confirmar con el encargado).
3. Crear rangos con nombre y reapuntar las fórmulas de `Catalogo`, `Compras` y `Movimientos`.
4. Limpiar `#REF!`/`#N/A` y mover los totales a `Resumen`.
5. Normalizar talleres (D-7) y estados de puerta.
6. Agregar las columnas nuevas de §3.
7. Ejecutar `schema.validate` ampliado y exigir 0 errores.
8. Desplegar la **nueva versión** de la Web App (v3.1) y activar `ENFORCE_AUTH`.

## 9. Escalabilidad y ruta de migración

Google Sheets con Apps Script sostiene la operación actual, pero el ritmo observado (106 movimientos en 4 días, unos 26 al día, ≈ 8 000 al año) ya supera el umbral de 5 000 movimientos anuales que el SDD 1.0 fijó para evaluar una base de datos real. v3.1 compra tiempo con caché, archivo anual y lecturas acotadas, y define **cuándo** migrar con umbrales medibles.

| Indicador | Umbral de alerta | Acción al cruzarlo |
| --- | --- | --- |
| Filas vivas en `MOVIMIENTOS` | 10 000 | Ejecutar cierre y archivo (RF-30) |
| p95 de lectura de listados | > 3 s dos semanas seguidas | Revisar caché y rangos; preparar Etapa B |
| `LOCK_TIMEOUT` | ≥ 2 por semana | Reducir retención del candado; preparar Etapa B |
| Usuarios que escriben a la vez, de forma sostenida | > 5 | Iniciar Etapa B |
| Duración de `runDailyForecast` | > 4 min (límite de Apps Script: 6 min) | Mover el pronóstico fuera de Apps Script (Etapa C) |

**Etapas**

- **Etapa A · v3.1 (ahora):** Sheets como base; rangos abiertos, caché, lotes atómicos, archivo anual.
- **Etapa B · base transaccional:** `movimientos`, `compras` y `puertas` pasan a Postgres o Firestore como fuente de verdad. Sheets queda como hoja de reporte de solo lectura, alimentada por sincronización. **El contrato `{action, params}` no cambia**: solo se sustituye el repositorio (`Repo.gs`), así que React no se toca.
- **Etapa C · pronóstico independiente:** el motor EMA/WAPE corre como servicio programado fuera de Apps Script y publica alertas al mismo endpoint.

La decisión de plataforma para la Etapa B queda abierta en D-11.

## 10. Pruebas de aceptación v3.1

Quince pruebas nuevas, ejecutadas sobre una **copia** del libro. Además deben seguir pasando las pruebas de paridad del SDD 1.0 (§13) sobre R-01…R-30.

| ID | Prueba | Resultado esperado | Cubre |
| --- | --- | --- | --- |
| T-01 | Crear dos puertas seguidas | SKU consecutivos y distintos | RF-18 |
| T-02 | `puertas.update` con llave que existe en dos filas | `CONFLICT`; la hoja no cambia | R-31 |
| T-03 | `log.restore` del `UPDATE` del 20-nov 15:58 | La puerta NYRIX de J. J. Cornejo vuelve a la fila 9 | RF-28 |
| T-04 | Lote de 3 líneas a un instalador; luego otro lote con una línea inválida | El primero baja el stock de los 3 SKU; el segundo no guarda ninguna línea | RF-19, R-32 |
| T-05 | `entregarAPuerta` a una puerta Entregada | `VALIDATION` | RF-20, R-34 |
| T-06 | SKU en la fila 500 de `Catalogo` y compra en la fila 600 de `Compras` | Validación OK y stock actualizado | RF-21 |
| T-07 | `schema.validate` tras la limpieza | 0 errores, 0 filas TOTAL en rango, 0 hashes repetidos | RF-22, RNF-11 |
| T-08 | Movimiento con taller "Taller 1" | Se guarda como Taller Central | RF-23, R-35 |
| T-09 | Compra CCF sin proveedor | Rechazada | R-36 |
| T-10 | Pronóstico de un SKU con 4 días de historia | Semáforo GRIS "Datos insuficientes" | R-37 |
| T-11 | Dos usuarios editan la misma puerta | El segundo recibe `CONFLICT` con la versión vigente | RF-29, R-39 |
| T-12 | Prueba de carga: 20 000 movimientos sintéticos y 5 escritores simultáneos | p95 de lectura ≤ 3 s y 0 `LOCK_TIMEOUT` | RNF-09, RNF-10 |
| T-13 | Llamada sin token | `AUTH` | RNF-12 |
| T-14 | Cierre anual en la copia | Saldos de `STOCK ACTUAL` sin cambios; libro vivo más liviano | RF-30, R-40 |
| T-15 | Stock por taller | La suma por taller es igual al `STOCK ACTUAL` global | RF-27 |

## 11. Fases y decisiones abiertas

La F0 va primero y bloquea las demás: mientras la llave de puertas siga sin protección y las fórmulas tengan tope, cada edición nueva puede perder datos o dejar stock sin calcular. Duración estimada, por validar con el equipo: F0 1 semana, F1 2, F2 2 y F3 3.

&#91;embedded content: hoja de ruta v3.1 · 4 fases con compuerta de pruebas\]

Las compuertas usan las pruebas T-01 a T-15 de la sección 10; la F0 está resaltada porque bloquea a las demás.

### 11.1 Decisiones abiertas (D-7 … D-11)

| ID | Decisión | Propuesta | Bloquea |
| --- | --- | --- | --- |
| D-7 | ¿"Taller 1" es lo mismo que Taller Central? | Sí, se guarda como alias | RF-23, F0 |
| D-8 | Plazo máximo para un DTE "Pendiente" | 5 días hábiles | R-36, F1 |
| D-9 | Qué puerta conserva `DEC-26-009` | La de J. J. Cornejo (NYRIX) conserva el SKU; la de L. E. Paz recibe el siguiente | RF-28, F0 |
| D-10 | Retención del libro vivo | 12 meses móviles; lo anterior va a hojas `*_AAAA` | RF-30, F3 |
| D-11 | Plataforma de la Etapa B | Postgres administrado o Firestore; decidir al cruzar el primer umbral de §9 | Etapa B |

Se mantiene abierta D-4 del SDD 1.0 (política de stock negativo): R-38 la deja configurable con `BLOQUEAR_NEGATIVO`.
