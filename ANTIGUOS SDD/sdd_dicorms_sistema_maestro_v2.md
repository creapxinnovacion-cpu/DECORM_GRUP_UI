# SDD v2.0 — Sistema Maestro Unificado DICORMS (GRUPO DECORM)

| Campo | Valor |
|---|---|
| **Proyecto** | GRUPO DECORM — Sistema Unificado de Inventario, Conciliación, Compras DTE, Consumo Semanal y Backend Apps Script |
| **Versión / Fecha** | 2.0 · 2026-11-16 |
| **Libro Base Corregido** | `MaestraUnificada_Corregida.xlsx` (17 hojas interconectadas 100% con fórmulas, 0 errores `#REF!`/`#N/A`) |
| **Backend Serverless** | `DICORMS_AppsScript_CRUD.js` (Google Apps Script Web App con LockService, RBAC, Idempotencia y Auto-Expansión) |
| **Clientes Soportados** | Google Sheets / Excel directo · App Móvil Flutter (Bodega y Talleres) · Panel Web React (Compras y Contabilidad) |

## 1. Cambios Arquitectónicos Aplicados en v2.0 (Libro Unificado + SDD)

A partir de la auditoría contable y de ingeniería sobre `MaestraUnificada.xlsx`, se rediseñó la arquitectura del libro y del SDD para que el archivo funcione como **un solo sistema relacional gobernado por fórmulas**:

| Componente / Hoja | Problema en `MaestraUnificada.xlsx` Original | Solución Implementada en `MaestraUnificada_Corregida.xlsx` y SDD v2.0 |
|---|---|---|
| **1. `Inv. Herrajes`, `Inv. Pinturas`, `Inv. Lijas`, `Inv. Selladores y Silicones`, `Inv. Consumibles`, `Inv. Equipos`** | Apuntaban a `Movimientos` (hoja inexistente) generando `#N/A`, usaban códigos de proveedor (`748402`, `572931`) y tenían artículos en hojas equivocadas (`CON-008` disco de corte y `753869` bisagra en Consumibles). | Se normalizaron los **99 SKUs** de las 6 hojas al código maestro de `Catalogo` (conservando el código original en la columna `Cód. Anterior / Ref.`). Las fórmulas de `Entradas` ahora suman `Compras` + devoluciones/ajustes(+) de `MOVIMIENTOSInsumosOperativo`, y `Salidas` resta automáticamente de `Stock Actual`. |
| **2. `Compras`** | `D2`, `E2`, `M2`, `N2` usaban `MATCH($E2, ...)` en lugar de `MATCH($C2, ...)` creando referencia circular y `#REF!`. `Clave mes` (`Q`) y `Validación` (`T`) tenían `#REF!`, y las listas desplegables estaban rotas. | Se corrigieron todas las referencias hacia `$C2` (`SKU`), `$A2` (`Fecha`) y `$B2` (`Proveedor`), se añadieron las columnas `Tipo de DTE` (`U`) y `N.º DTE / Factura` (`V`) con cálculo automático de IVA crédito fiscal (13% en CCF) y se restauraron las listas desplegables desde `Config`. |
| **3. `MOVIMIENTOSInsumosOperativo` y `PrestamosEquipos`** | Mezclaba préstamos de herramientas (`A–F`) con salidas de insumos (`G–U`), buscaba el SKU en `$D2` (Cant. prestada) en vez de `$J2` (`SKU`) y generaba IDs negativos (`MOV--0002` con `ROW()-4`). | Se creó la hoja dedicada **`PrestamosEquipos`** para los 4 préstamos de herramientas (`EQU-*`), se dejaron las columnas `A–F` como histórico ignorado en el cálculo de consumo, se corrigieron los `INDEX/MATCH` hacia `$J2` y la fórmula de ID a `ROW()-1` (`MOV-0001` a `MOV-0009`), y se activaron las validaciones de `SKU`, `Cantidad > 0` y `Taller / destino`. |
| **4. `Equivalencias` y `SeguimientoManualStok`** | `SeguimientoManualStok` usaba IDs `INS-001` a `INS-021` (sin `INS-015`) que no cruzaban con los SKUs del `Catalogo`. | Se creó la hoja **`Equivalencias`** que vincula con fórmulas los 20 ítems `INS-0xx` a los **23 SKUs** correspondientes del `Catalogo` (incluyendo el desglose proporcional de `INS-013 Silicón` en 4 colores: 12 transp., 8 negros, 5 blancos, 2 cafés), marcando con `⚠ CONFIRMAR` los 13 casos sujetos a validación física. |
| **5. `Conciliacion`** | No existía hoja de conciliación entre el conteo físico (`SeguimientoManualStok`) y el inventario teórico (`Inv.*` / `Catalogo`). | Se creó la hoja **`Conciliacion`** con los 128 SKUs del Catálogo: cruza `Stock físico` vs. `Stock sistema (Inv.*)`, calcula `Diferencia`, `% diferencia`, `Estado` (`CUADRA`, `FALTANTE`, `SOBRANTE`, `SIN CONTEO`) según la tolerancia (`Inicio!H3 = 0`) y detalla la causa probable y el cuadro resumen final. |
| **6. `Inicio` (Dashboard)** | Solo tenía el texto `"GRUPO DECORM"` en `A1`. | Se construyó el Dashboard 100% con fórmulas y filtros interactivos (`Clave Mes`, `Filtro Taller`, `Lunes Semana Ref.`, `Tolerancia`): 6 tarjetas KPI, tabla de consumo semanal (Lunes–Domingo), consumo por taller, Top 10 con rango semanal (`Mín / Prom / Máx`), cobertura en semanas (`< 2 sem`), tablero de alertas y 2 gráficos nativos (`LineChart` y `BarChart`). |

## 2. Modelo de Datos y Reglas de Cálculo en Hoja de Cálculo

### 2.1 Ecuación Maestra de Inventario Unificado

En `Catalogo` (128 SKUs) y en las 6 hojas `Inv.*` (99 SKUs operativos):

- `Entradas(SKU)` = `SUMIFS(Compras!CantRecibida) + SUMIFS(Movimientos!Devolución) + SUMIFS(Movimientos!Ajuste (+))`
- `Salidas(SKU)` = `SUMIFS(Movimientos!Salida) + SUMIFS(Movimientos!Ajuste (-))`
- `Stock Sistema (Teórico)` = `Stock Inicial + Entradas(SKU) - Salidas(SKU)`

### 2.2 Ecuación de Conciliación (`Conciliacion`)

Para cada artículo con conteo físico registrado en `SeguimientoManualStok` (mapeado vía `Equivalencias`):

- `Diferencia = Stock Físico - Stock Sistema (Inv.*)`
- Si el SKU no figura en `Equivalencias`: `Estado = "SIN CONTEO"`.
- Si `ABS(Diferencia) <= Tolerancia` (`Inicio!$H$3`, por defecto `0`): `Estado = "CUADRA"`.
- Si `Diferencia < -Tolerancia`: `Estado = "FALTANTE"` (hay menos unidades físicas que las que dice el sistema; indica salidas a talleres no registradas o compra duplicada con stock inicial).
- Si `Diferencia > +Tolerancia`: `Estado = "SOBRANTE"` (hay más unidades físicas que las que dice el sistema; indica stock inicial previo no cargado en `Catalogo` / `Inv.*`).

### 2.3 Consumo Semanal (Lunes a Domingo) y Cobertura (`Inicio`)

- Cada ventana semanal se define por su `Lunes Inicio` y su `Domingo Fin = Lunes Inicio + 6`.
- El consumo semanal filtra `MOVIMIENTOSInsumosOperativo` con `Tipo = "Salida"`, `Fecha >= Lunes Inicio`, `Fecha <= Domingo Fin` y respeta el selector `Filtro Taller` (`Inicio!$D$3 = "Todos"` o un taller específico).
- Para cada insumo del Top 10 en las 4 semanas del mes:
  - `Mínimo Semanal = MIN(Sem1:Sem4)`
  - `Promedio Semanal = AVERAGE(Sem1:Sem4)`
  - `Máximo Semanal = MAX(Sem1:Sem4)`
  - `Cobertura (semanas) = MAX(0, Stock Actual) / Promedio Semanal`
  - **Regla de Alerta de Cobertura**: Si `Stock Actual <= 0` → `"⚠ AGOTADO (0 sem)"`; si `Cobertura < 2` → `"⚠ ALERTA (< 2 sem)"`; si `Cobertura >= 2` → `"OK (>= 2 sem)"`.

## 3. Resultados de Conciliación (Físico vs. Sistema)

| Estado de Conciliación | Cantidad de SKUs | Detalle de Artículos |
|---|---:|---|
| **CUADRA (`Diferencia = 0`)** | **3 SKUs** | `ABR-004` (`INS-004`, Fis=0, Sis=0), `ABR-005` (`INS-005`, Fis=0, Sis=0), `HER-010` (`INS-019`, Fis=0, Sis=0) |
| **FALTANTE (`Físico < Sistema`)** | **8 SKUs** | `ABR-001` (-240), `SEL-001` (-49), `ABR-002` (-26), `CON-003` (-21), `ABR-003` (-16), `CON-010` (-10), `HER-007` (-5), `SEL-002` (-3) |
| **SOBRANTE (`Físico > Sistema`)** | **12 SKUs** | `ABR-007` (+159), `ABR-009` (+49), `ABR-008` (+20), `ABR-006` (+12), `SEL-003` (+12), `SEL-004` (+8), `PIN-031` (+6), `SEL-005` (+5), `HER-009` (+5), `SEL-006` (+2), `SEL-008` (+2), `PIN-011` (+1) |
| **SIN CONTEO (`No en SeguimientoManualStok`)** | **105 SKUs** | 48 SKUs con stock en sistema (`PIN-001..028`, `HER-006`, `HER-008`, `CON-011..019`, `EQU-001..011`, `SEL-009`), 1 negativo (`CON-002` = -2), 56 en cero |
| **TOTAL CATÁLOGO** | **128 SKUs** | **3 cuadran / 20 con diferencia (de 23 SKUs con conteo físico) / 105 sin conteo físico** |

## 4. Especificación del Backend CRUD en Google Apps Script (`DICORMS_AppsScript_CRUD.js`)

| Endpoint (`action`) | Parámetros Principales (`params`) | Descripción y Reglas de Negocio |
|---|---|---|
| `auth.login` | `{ username, pin }` | Valida contra hoja `_USERS` (creada automáticamente si no existe) y firma token HMAC-SHA256 por 12 h. |
| `config.get` | `{}` | Devuelve todas las listas de `Config` (proveedores, talleres, categorías, unidades, operadores, tipos DTE, tasa IVA). |
| `schema.validate` | `{}` | Verifica que todas las hojas y encabezados de `SCHEMA` coincidan exactamente con el libro. |
| `catalogo.list` / `get` / `create` / `update` | `{ q, filters, sort, page, pageSize }` | CRUD del Catálogo Maestro; escribe solo en las 9 columnas de captura y retorna las 19 columnas calculadas. |
| `catalogo.nextSku` | `{ prefijo }` | Genera correlativo atómico en hoja `_SEQ` (ej. `ABR-010`, `CON-021`). |
| `catalogo.kardex` | `{ sku }` | Reconstruye el historial cronológico (Stock Inicial + Compras + Movimientos) con saldo corrido y conteo físico. |
| `compras.list` / `create` / `createBatch` / `update` / `clear` | `{ fecha, proveedor, sku, cant_recibida, precio_unit_pagado, tipo_dte, n_dte }` | Registra compras recibidas, valida SKU y cantidad $> 0$, y recalcula IVA crédito fiscal (13% si `CCF`), PMP y Stock Actual. |
| `compras.importDte` | `{ dteJson, defaultSku, taller_destino }` | Importa un JSON de DTE salvadoreño (`03` CCF, `01` Factura, `14` Sujeto Excluido), valida no duplicar `codigoGeneracion` y convierte `precioUni` sin IVA a precio con IVA. |
| `movimientos.list` / `create` / `createBatch` / `update` / `clear` | `{ fecha, tipo, sku, cantidad, taller_destino, entregado_a }` | Registra salidas/devoluciones/ajustes validando `SKU`, `cantidad > 0` y `taller_destino` obligatorio en salidas. |
| `movimientos.entregarAPuerta` | `{ sku_puerta, sku, cantidad, entregado_a }` | Valida la puerta en `AgendaDePuertas`, hereda su taller y registra la salida vinculada al código de puerta. |
| `prestamos.list` / `create` / `devolver` | `{ fecha_salida, persona, sku_equipo, cant_prestada }` | Restringe préstamos exclusivamente a SKUs de equipos (`EQU-*`) y controla devoluciones parciales o totales. |
| `seguimiento.list` / `upsert` | `{ id_articulo, stock, stock_minimo, estado, notas }` | Actualiza el conteo físico manual (`INS-0xx`) y devuelve la diferencia contra el stock del sistema. |
| `equivalencias.list` / `confirmar` | `{ sku_catalogo, factor_desglose, detalle }` | Cambia el estado de una equivalencia `INS → SKU` de `⚠ CONFIRMAR` a `CONFIRMADO` dejando rastro en `_LOG`. |
| `conciliacion.get` | `{ estado?, soloConConteo? }` | Devuelve el resumen ejecutivo (`cuadra`, `faltante`, `sobrante`, `sin_conteo`) y el detalle por SKU. |
| `dashboard.get` | `{ clave_mes?, taller?, lunes_semana?, tolerancia? }` | Actualiza los selectores de `Inicio` (si se envían) y retorna tarjetas KPI, consumo semanal, consumo por taller, Top 10 con cobertura y alertas. |
| `puertas.list` / `create` / `update` | `{ sku_puerta, dia_entrega, cliente, modelo, taller, ... }` | CRUD de `AgendaDePuertas`. |
