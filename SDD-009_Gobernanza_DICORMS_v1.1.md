# SDD-009 v1.1: Gobernanza Financiera, Reabastecimiento y Control Gerencial (DICORMS v4.2)

| Campo | Valor |
|---|---|
| Código | SDD-009 (Gobernanza, reabastecimiento, costeo y control contable) |
| Versión / fecha | **1.1** · 2026-11-22 (sustituye a 1.0) |
| Sistema base | DICORMS v4.1.0.0 (`DECORM_GROUP_v4.xlsx` + React + Apps Script) |
| Fuente única de verdad (SSOT) | Libro `DECORM_GROUP_v4.xlsx`. Se deprecian los reportes estáticos con cifras no conciliadas |
| Línea base | Noviembre 2026: 130 SKUs · $4,600.39 en compras · 107 movimientos · 12 puertas en agenda |
| Documentos relacionados | `SDD_DICORMS_Sistema_Maestro.md` (R-01…R-30), `ESPECIFICACION_HOJAS_DICORMS.md` |

---

## 0. Control de cambios respecto a v1.0

| # | Regla | Cambio en v1.1 | Motivo |
|---|---|---|---|
| 1 | R-41 | El ajuste por conteo es **contable** (`afecta_stock = NO`); no vuelve a mover stock | Evita doble descuento: el stock ya es `conteo + movimientos posteriores` |
| 2 | R-43 | Neto, IVA, percepción y retención se **capturan del DTE**, no se derivan con `/1.13` cuando hay retención o percepción | `Total / 1.13` deja de cuadrar si el total incluye 1 % |
| 3 | R-39 | Excepción formal de compra de emergencia con autorización y tope; "En confirmación" no cuenta como puerta que genera demanda | Contradicción entre bloquear `SIN CONTEO` y comprar `COMPRAR` sin conteo; R-16 |
| 4 | Hoja de ruta | Orden: conteo → desglose `GEN-*` → investigación → ajustes | El desglose mueve el teórico y puede aumentar los faltantes |
| 5 | R-39 | Regla de corte explícita (`>=` con conteo a primera hora, u hora en los registros) | El libro compara fecha con `>` estricto y no tiene hora |
| 6 | R-40 | Jerarquía de respaldo según confianza, `REVISION_DIAS = 6`, anti doble conteo de puertas, lote mínimo y múltiplo | Un solo mes de historial: σ y tasa poco fiables |
| 7 | Parámetros | Cada parámetro vive en **un solo lugar**; tolerancia de conciliación por categoría | `TOLERANCIA_CONCILIACION` estaba duplicada y en 0 |
| 8 | Anexo A | Nuevos asientos: NC DTE-05, percepción/retención, `GEN-*` transitorio, capitalización de equipo | Faltaban en v1.0 |

> **Corrección de lectura:** las cifras $1,695.60 / $1,250.76 / $1,203.24 / $85.70 **son** compras `GEN-*` (suman $4,235.30). No son totales por grupo independientes de `GEN-*`.

---

## 1. Línea base auditada (SSOT)

| Dimensión | Valor real (`DECORM_GROUP_v4.xlsx`) | Regla de gobernanza |
|---|---|---|
| Universo de catálogo | **130 SKUs** | Bloquear SKUs duplicados y filas resumen dentro de tablas transaccionales |
| Criticidad de stock | **38 críticos** (COMPRAR 36 · AGOTADO 1 · NEGATIVO 1) · SIN CONTEO 42 · DEFINIR MÍN. 28 · OK 18 · SIN DETALLE 4 (total 130) | Prohibido ordenar sobre "80 SKUs críticos" |
| Conciliación física | FALTANTE 15 · SOBRANTE 7 · CUADRA 1 (`CON-010`) · SIN CONTEO 107 (total 130) | Ningún `SIN CONTEO` entra a cotización ordinaria hasta contarse |
| Valoración | Inventario **$870.88**; **111 de 130 SKUs (85.4 %)** con costo $0.00. Faltantes valorizados: −$293.17 en 4 ítems (`SEL-002` −146.02 · `HER-007` −95.52 · `ABR-001` −39.03 · `CON-003` −12.61) | PMP etiquetado **Provisional** hasta regularizar las 30 líneas de compra con precio $0.00 |
| Compras `GEN-*` | **$4,235.30** en 21 registros (92.1 % de $4,600.39): Materia prima 1,695.60 · Equipos 1,250.76 · Insumos 1,203.24 · Herrajes 85.70 | Son **bolsas por grupo pendientes de desglose**; no alimentan PMP por SKU ni consumo. Base real de PMP: $365.09 |
| Trazabilidad | 107 movimientos (106 salidas, 1 devolución; 302.5 u). `BOM_Puertas` e `InsumosInstaladores`: 0 registros | Todo despacho se vincula a `SKU Puerta` (`DEC-26-xxx`) o centro de costo |

---

## 2. Reglas de negocio

### R-39 · Secuencia obligatoria de abastecimiento (gatekeeping)

El sistema bloquea cotizaciones consolidadas (`Cotizaciones_Cabecera`) mientras haya brechas de datos en los ítems seleccionados.

**Fase 1: Cierre físico (P0)**
1. Conteo de los 107 SKUs **a primera hora, antes de abrir despacho**.
2. Confirmar las 13 equivalencias `INS-0xx` en `Equivalencias`.

**Regla de corte (decisión D-5):** mientras el libro compare con `>` estricto, el conteo debe ser a primera hora y los movimientos del día se consideran **posteriores**; para lograrlo se cambia la comparación a `>=` en el cálculo de "mov. neto post-conteo". Alternativa: agregar columna `hora` a MOVIMIENTOS y CONTEO y comparar fecha-hora.

**Fase 2: Abastecimiento de emergencia acotado (P0)**
- Solo se autoriza para: los 2 SKUs `AGOTADO`/`NEGATIVO` y los `COMPRAR` ligados a puertas **que generan demanda**: En proceso (2), Programado (2) y Por fabricar (1) = **5**. La puerta "En confirmación" **no genera compra** (R-16 del Maestro) y queda fuera.
- **Excepción formal:** compra sobre SKU `SIN CONTEO` permitida solo con (a) autorización de gerencia registrada, (b) tope en $ por orden (parámetro `TOPE_COMPRA_EMERGENCIA`, a definir) y (c) motivo (`AGOTADO` / puerta comprometida).

**Fase 3: Compra planificada (P1)**
- Se habilita al regularizar precios y mínimos de los SKUs de alta rotación y completar el conteo.

### R-40 · Reposición basada en demanda y lead time (sustituye al factor fijo 1.9x)

Parámetros de `Forecast_Params`: `REVISION_DIAS`, `SEGURIDAD_DIAS = 2`, `LEAD_TIME_DEFAULT = 2`, `Z_SERVICIO = 1.65`. **`REVISION_DIAS` pasa de 7 a 6** porque `DIAS_MODO = OPERATIVO` (lunes a sábado): 7 días operativos exceden una semana.

```
SS    = max( Stock_mínimo_catálogo , Z · σd · √(LT + R) )
ROP   = d̂ · LT + SS
S_obj = d̂ · (LT + R) + SS
Pos   = Stock_físico − Comprometido_puertas + En_tránsito
Q     = max(0, S_obj − Pos)          → redondear al alza al múltiplo del proveedor
Q     = max(Q, Lote_mínimo)  si Q > 0
```

Donde `d̂` = `Consumption_Learning!tasa_aprendida`; `LT` y `R` en días operativos.

**Jerarquía de respaldo según confianza (obligatoria, un mes de historial):**

| Confianza del SKU | Tasa `d̂` usada | σd |
|---|---|---|
| ALTA (≥10 obs. y ≥28 días) | `tasa_aprendida` | Observada |
| MEDIA (≥5 obs. y ≥14 días) | `tasa_aprendida` | Observada, con piso del mínimo de catálogo |
| BAJA | Tasa reciente de 14 días (`VENTANA_RECIENTE_DIAS`) | No se usa; `SS = Stock_mínimo` |
| Sin historial | `Stock_mínimo` de catálogo | No aplica |
| Sin historial **y** sin mínimo | `FACTOR_PEDIDO = 1.9` como **último recurso**, marcado "heurística" y con aprobación de gerencia | No aplica |

**Anti doble conteo de puertas:** si la proporción de consumo atribuido a puertas es ≥ `ATRIBUCION_MIN` (0.8), la tasa `d̂` ya contiene demanda de puertas y **no** se resta `Comprometido_puertas`; si es menor, se suma proyecto + general (SDD-008). Debe quedar visible por SKU qué modo se aplicó.

**Datos nuevos por proveedor/SKU:** `lote_minimo`, `multiplo_compra`, `lead_time` propio (si no, el default).

### R-41 · Gobernanza de diferencias y ajuste contable

1. **Clasificación:** toda diferencia fuera de tolerancia se marca `PENDIENTE_INVESTIGACION`. Prohibido imputar responsabilidad individual sin auditoría.
2. **Tolerancia por categoría** (reemplaza el 0 global). Ejemplo inicial a validar: unidades discretas = 0; consumibles por libra/metro/litro (tirro, tíner, wiper) = ±3 % o la que defina gerencia. Un único parámetro `TOLERANCIA_CONCILIACION` por categoría, en **un solo lugar** (`Config`; se elimina de `Forecast_Params`).
3. **Fila de resolución obligatoria:** `SKU`, `Diferencia unidades`, `Costo unitario real $`, `Valor diferencia $`, `Causa raíz` (Compra no digitada · Salida sin vale · Error de unidad · Error de conteo · Merma operativa · Extravío), `Responsable investigación`, `Evidencia`, `Estado resolución`.
4. **Ajuste sin doble descuento:** el stock real ya queda fijado por `CONTEO` (stock actual = conteo + movimientos posteriores). Por eso el ajuste generado al cerrar la conciliación es **solo contable**:
   - se registra con `afecta_stock = NO`, **o** se fecha en la fecha del conteo;
   - estado `PENDIENTE_APROBACION_GERENCIA` antes de contabilizar (Anexo A.4).
5. **Orden:** no se cierra una diferencia sin costo unitario > $0.00 (ver R-43.5).

### R-42 · Normalización del consumo por producción

- **Lista cerrada de operarios** en `Config`: unificar variantes ortográficas (Josue/Josué → `Josué`; Griselda/Griscelda/Gricelda → `Griselda`; Jorge Jimenez → `Jorge Jiménez`; Jaime/Jarme Carbantes → `Jaime Carbantes`) y resolver `Christian` vs `Cristian` y `Jovany`/`Jeovany`. **Migrar también los históricos**; si no, fallan las validaciones de listas.
- **Salidas validadas:** todo registro en `MOVIMIENTOSInsumosOperativo` e `InsumosInstaladores` exige `ref_tipo` (`PUERTA`, `PROYECTO`, `MANTENIMIENTO_TALLER`) y `ref_id` (`DEC-26-xxx`).
- **Eficiencia normalizada** (no se evalúa por consumo bruto):

```
Consumo real por puerta = Σ unidades netas entregadas(i,p) / puertas ejecutadas(p)
Δ% eficiencia = (Consumo real − BOM estándar) / BOM estándar
```

Requiere `BOM_Puertas` cargada y puertas ejecutadas suficientes (ver KPI 3).

### R-43 · Reglas fiscales (El Salvador) y capitalización

1. **El IVA lo define el tipo de DTE, no el proveedor.**
   - `CCF` (DTE-03): costo neto = base gravada; IVA 13 % = crédito fiscal.
   - `Factura consumidor final` (DTE-01) o `Sujeto excluido` (DTE-14): el IVA, si lo hay, forma parte del costo; crédito fiscal $0.00.
   - **Cambio v1.1:** cuando hay percepción o retención, **neto gravado, IVA, percepción y retención se capturan tal como vienen en el DTE**; `Total / 1.13` solo aplica al caso simple sin retención/percepción.
2. **Percepción vs retención de IVA 1 %** (cuentas distintas; confirmar con el contador la condición de contribuyente):
   - **Percepción** (la hace el proveedor y se suma al total): anticipo de IVA a favor, **no es costo**.
   - **Retención** (la hace la empresa): pasivo (IVA retenido por pagar), no es costo.
3. **Retención de renta 10 % (Sujeto excluido):** normalmente aplica a servicios. **Confirmar con el contador si aplica a compras de bienes** antes de habilitar el campo.
4. **Devolución a proveedor:** nuevo tipo `Devolución a Proveedor`, obligatoriamente ligado a **Nota de Crédito (DTE-05)** con referencia al DTE original; revierte unidades, costo y crédito fiscal (Anexo A.5).
5. **Costo > $0.00:** toda recepción o conteo valorizado exige costo unitario > $0.00; las 30 líneas con $0.00 se regularizan antes de cerrar diferencias.
6. **Capitalización de `EQU-*`:** `UMBRAL_CAPITALIZACION_EQUIPO = 150.00` USD, aplicado **por unidad** (no por compra) sobre costo neto, con vida útil > 1 año → Propiedad, Planta y Equipo; por debajo, gasto del mes (herramienta menor). Requiere hoja **`ActivosFijos`** (código, descripción, fecha, costo, vida útil, método y tasa de depreciación, responsable, estado). Validar las tasas de depreciación fiscales vigentes con el contador.
7. **Compras por clasificar (`GEN-*`):** se registran en cuenta transitoria hasta desglosarse contra el DTE físico (Anexo A.3).
8. **R-32 activa:** `ACTIVAR_BLOQUEO_R32 = TRUE` bloquea nuevas salidas/préstamos de `EQU-*` a quien tenga registros `PENDIENTE RETORNO` o `FALTA CANTIDAD` (hoy `PR-0001`, `PR-0002`, `PR-0004`).
9. **Stock negativo (R-38 / D-4):** decidir y activar `BLOQUEAR_NEGATIVO` (hoy `FALSE`; hay 1 SKU negativo).

### R-44 · Cotizaciones y negociación

- **Ahorros condicionados:** ningún descuento proyectado (p. ej. 5 %–8 % en Freund) reduce el presupuesto hasta tener cotización formal en `Precios_Proveedor`.
- **Costo total puesto en taller:**

```
Costo total orden = Σ( Qi · Pneto,i · (1 − di) ) + Flete + IVA no acreditable
```

- **Comparación normalizada:** `Precios Incluyen IVA` (por proveedor, hoy Lemus = SI) se usa **solo** para llevar cotizaciones a neto y compararlas. Nunca decide el tratamiento contable (lo define el DTE).
- Asignar proveedor preferido a los **82 SKUs "Por asignar"** antes de agrupar órdenes.

### R-45 · Capacidad productiva (`AgendaDePuertas`)

1. **Histórico entregado** (6): mide lead time real de fabricación y OTIF.
2. **Cartera activa** (6: 2 en proceso, 2 programadas, 1 por fabricar, 1 en confirmación): alimenta capacidad semanal. La reserva de materiales (`Dem. puertas pend.`) **excluye "En confirmación"**.

---

## 3. Cambios al libro (`DECORM_GROUP_v4.xlsx`)

| Hoja | Campo / parámetro | Tipo | Propósito |
|---|---|---|---|
| `Config` | `UMBRAL_CAPITALIZACION_EQUIPO = 150` | USD | Separa PP&E de gasto menor |
| `Config` | `ACTIVAR_BLOQUEO_R32 = TRUE` | Booleano | Bloqueo por equipos pendientes |
| `Config` | `TOPE_COMPRA_EMERGENCIA` | USD (a definir) | Excepción de R-39 |
| `Config` | `TOLERANCIA_CONCILIACION` por categoría | % o unidades | Se elimina de `Forecast_Params` |
| `Config` | `Operadores` depurada | Texto único | R-42 |
| `Forecast_Params` | `REVISION_DIAS = 6` | Entero | Coherente con modo OPERATIVO |
| `Catalogo` / `Precios_Proveedor` | `lote_minimo`, `multiplo_compra`, `lead_time` | Numérico | R-40 |
| `Compras` | `Base gravada $`, `IVA $` (capturados del DTE) | Numérico | R-43.1 |
| `Compras` | `Percepción IVA 1% $`, `Retención IVA 1% $` | Numérico | R-43.2 |
| `Compras` | `Retención Renta 10% $` (sujeto a confirmación) | Numérico | R-43.3 |
| `Compras` | `DTE Referencia NC (DTE-05)` | Texto | R-43.4 |
| `Compras` | `Estado clasificación` (`GEN` / `CLASIFICADA`) | Lista | R-43.7 |
| `MovimientosInsumosOperativo` | Tipo `Devolución a Proveedor`; columna `afecta_stock` (SI/NO); `hora` (opcional) | Lista / Booleano | R-41, R-43.4 |
| `Conciliacion` | `Valor Diferencia $ [Auto]`, `Causa Raíz`, `Responsable`, `Evidencia`, `Estado Resolución` | Fórmula / Listas | R-41 |
| `ActivosFijos` (nueva) | Costo, vida útil, depreciación, responsable | Varios | R-43.6 |
| `BOM_Puertas` | Carga inicial por modelo (`LYNUX`, `NYRIX`, `ANDRÓMEDA`, `LORVAK`) | Relacional | R-42 |

---

## 4. Indicadores gerenciales

| # | KPI | Fórmula | Meta | Condición de validez |
|---|---|---|---|---|
| 1 | Valor de diferencias de inventario | `Σ |Diferenciaᵢ × Costoᵢ|` | $0.00 tras el cierre; alerta si > 1.5 % del inventario | **No fiable mientras 111 de 130 SKUs tengan costo $0.00**. Los faltantes conocidos ya equivalen a 33.7 % del inventario valorado ($293.17 / $870.88) |
| 2 | Rotación e inmovilización | `Costo de salidas del mes / Inventario promedio valorizado`; $ de SKUs sin movimiento > 45 días | Definir con 2–3 meses de historial | Requiere ≥ 45 días de historial |
| 3 | Costo real por puerta ($/puerta y $/m²) | Salidas vinculadas a `SKU Puerta` por modelo vs margen cotizado | Dentro de BOM ±X % | Requiere `BOM_Puertas` y varias puertas por modelo |
| 4 | OTIF % | `Puertas entregadas en fecha prometida / puertas programadas del período` | A definir | Hoy solo 6 entregadas: muestra pequeña, usar como referencia |
| 5 | Compras urgentes / no planificadas % | `Monto compras por agotamiento o sin cotización / gasto total del mes` | < 10 % | Tras estabilizar ROP |

---

## 5. Hoja de ruta (30 días): orden corregido

| Hito | Días | Contenido |
|---|---|---|
| **1. Control de riesgo de caja** | 1–2 | Conteo de 107 SKUs a primera hora (regla de corte aplicada); confirmar 13 equivalencias `INS-0xx`; `ACTIVAR_BLOQUEO_R32 = TRUE`; cotización **solo** de emergencia (2 SKUs agotados/negativos + `COMPRAR` ligados a las 5 puertas que generan demanda), con autorización y tope |
| **2. Saneamiento** | 3–7 | **(a)** Desglosar los $4,235.30 de `GEN-*` contra DTEs físicos → **(b)** completar costos de los 111 SKUs en $0.00 y las 30 líneas de compra → **(c)** investigar los 15 faltantes con Causa Raíz → **(d)** recién entonces aprobar y contabilizar los ajustes |
| **3. Estandarización** | 8–15 | Validación obligatoria de `SKU Puerta` en salidas; proveedor preferido a los 82 SKUs; `BOM_Puertas` base; lista de operarios depurada con migración de históricos; hoja `ActivosFijos` |
| **4. Automatización** | 16–30 | ROP / S_obj con jerarquía de respaldo; `1.9x` solo para SKUs sin historial ni mínimo; primer cierre mensual con los KPIs aplicables |

---

## 6. Decisiones abiertas

| ID | Decisión | Responsable |
|---|---|---|
| D-1 | Nombre del proveedor (`Freund` / `Fredu`) y alta de `TODOKOLOR`, `Golem Abrasivos` | Gerencia |
| D-4 | Bloquear o advertir salida con stock negativo (`BLOQUEAR_NEGATIVO`) | Gerencia |
| D-5 | Regla de corte: `>=` con conteo a primera hora, o columna `hora` | Gerencia / Sistemas |
| D-7 | Valor de `TOPE_COMPRA_EMERGENCIA` | Gerencia |
| D-8 | Tolerancias de conciliación por categoría | Bodega / Contador |
| D-9 | Condición de contribuyente (percepción/retención de IVA) y aplicabilidad de retención de renta a bienes | Contador |
| D-10 | Tasas y método de depreciación fiscal para `ActivosFijos` | Contador |
| D-11 | Política de cuenta transitoria para `GEN-*` | Contador |

---

## Anexo A. Asientos contables sugeridos

> Códigos de cuenta por definir según el catálogo de la empresa. Importes de ejemplo.

**A.1 Compra con CCF** (total $113.00)

| Fecha / Código | Cuenta Contable | Debe ($) | Haber ($) |
| --- | --- | --- | --- |
| [Código] | Inventarios – Insumos / Materia prima (costo neto) | 100.00 | - |
| [Código] | IVA Crédito Fiscal | 13.00 | - |
| [Código] | Bancos / Cuentas por pagar – Proveedor | - | 113.00 |
| **CONCEPTO:** | *Compra con CCF (DTE-03); IVA como crédito fiscal; costeo PMP* | **Total 113.00** | **Total 113.00** |

**A.2 Compra con Factura consumidor final** (total $113.00)

| Fecha / Código | Cuenta Contable | Debe ($) | Haber ($) |
| --- | --- | --- | --- |
| [Código] | Inventarios – Insumos | 113.00 | - |
| [Código] | Bancos / Cuentas por pagar – Proveedor | - | 113.00 |
| **CONCEPTO:** | *Factura consumidor final (DTE-01); sin crédito fiscal; IVA capitalizado al costo* | **Total 113.00** | **Total 113.00** |

**A.3 Compra `GEN-*` sin desglose (CCF, neto $100.00) y su reclasificación**

*Registro inicial:*

| Fecha / Código | Cuenta Contable | Debe ($) | Haber ($) |
| --- | --- | --- | --- |
| [Código] | Compras por clasificar (cuenta transitoria) | 100.00 | - |
| [Código] | IVA Crédito Fiscal | 13.00 | - |
| [Código] | Bancos / Cuentas por pagar – Proveedor | - | 113.00 |
| **CONCEPTO:** | *Compra `GEN-*` con CCF; pendiente de desglose por SKU contra el DTE físico* | **Total 113.00** | **Total 113.00** |

*Al desglosar (ejemplo: $100.00 a Insumos):*

| Fecha / Código | Cuenta Contable | Debe ($) | Haber ($) |
| --- | --- | --- | --- |
| [Código] | Inventarios – Insumos | 100.00 | - |
| [Código] | Compras por clasificar (cuenta transitoria) | - | 100.00 |
| **CONCEPTO:** | *Reclasificación de `GEN-*` a SKUs reales; actualiza PMP y valoración* | **Total 100.00** | **Total 100.00** |

**A.4 Ajuste por conteo físico: faltante de 5 u a $1.00 (solo contable, `afecta_stock = NO`)**

| Fecha / Código | Cuenta Contable | Debe ($) | Haber ($) |
| --- | --- | --- | --- |
| [Código] | Pérdida por mermas / diferencias de inventario | 5.00 | - |
| [Código] | Inventarios – Insumos | - | 5.00 |
| **CONCEPTO:** | *Diferencia conteo vs teórico, aprobada por gerencia tras investigación (R-41); el stock físico ya se corrigió por el conteo* | **Total 5.00** | **Total 5.00** |

**A.5 Devolución a proveedor con Nota de Crédito (DTE-05) de una compra CCF de $113.00**

| Fecha / Código | Cuenta Contable | Debe ($) | Haber ($) |
| --- | --- | --- | --- |
| [Código] | Cuentas por pagar – Proveedor | 113.00 | - |
| [Código] | Inventarios – Insumos | - | 100.00 |
| [Código] | IVA Crédito Fiscal | - | 13.00 |
| **CONCEPTO:** | *NC DTE-05 referida al CCF original; si el costo del inventario difiere del PMP, la diferencia va a ajuste de costo* | **Total 113.00** | **Total 113.00** |

**A.6 Compra CCF con percepción de IVA 1 %** (neto $100.00, IVA $13.00, percepción $1.00)

| Fecha / Código | Cuenta Contable | Debe ($) | Haber ($) |
| --- | --- | --- | --- |
| [Código] | Inventarios – Insumos | 100.00 | - |
| [Código] | IVA Crédito Fiscal | 13.00 | - |
| [Código] | Anticipo IVA – Percepción | 1.00 | - |
| [Código] | Bancos / Cuentas por pagar – Proveedor | - | 114.00 |
| **CONCEPTO:** | *CCF (DTE-03) con percepción 1 % sobre base gravada; la percepción es anticipo de IVA, no costo* | **Total 114.00** | **Total 114.00** |

**A.7 Compra CCF con retención de IVA 1 %** (neto $100.00, IVA $13.00, retención $1.00)

| Fecha / Código | Cuenta Contable | Debe ($) | Haber ($) |
| --- | --- | --- | --- |
| [Código] | Inventarios – Insumos | 100.00 | - |
| [Código] | IVA Crédito Fiscal | 13.00 | - |
| [Código] | Cuentas por pagar – Proveedor | - | 112.00 |
| [Código] | IVA Retenido por pagar | - | 1.00 |
| **CONCEPTO:** | *CCF (DTE-03) con retención 1 % practicada por la empresa; se paga al Fisco en el período* | **Total 113.00** | **Total 113.00** |

**A.8 Compra de equipo capitalizable** (CCF, neto $150.00 por unidad, IVA $19.50)

| Fecha / Código | Cuenta Contable | Debe ($) | Haber ($) |
| --- | --- | --- | --- |
| [Código] | Propiedad, Planta y Equipo – Maquinaria y herramientas | 150.00 | - |
| [Código] | IVA Crédito Fiscal | 19.50 | - |
| [Código] | Bancos / Cuentas por pagar – Proveedor | - | 169.50 |
| **CONCEPTO:** | *Equipo con costo neto ≥ umbral de capitalización ($150) y vida útil > 1 año; se registra en `ActivosFijos` y se deprecia* | **Total 169.50** | **Total 169.50** |

**A.9 Salida de bodega a taller** (10 u × costo de valoración $1.00)

| Fecha / Código | Cuenta Contable | Debe ($) | Haber ($) |
| --- | --- | --- | --- |
| [Código] | Costo de producción / Gasto de taller – [Taller] | 10.00 | - |
| [Código] | Inventarios – Insumos | - | 10.00 |
| **CONCEPTO:** | *Salida a taller valorada al costo del catálogo (PMP provisional o precio de referencia)* | **Total 10.00** | **Total 10.00** |

> **Limitación declarada:** el PMP actual es histórico (Σ costo neto / Σ cantidad de compras con precio), no móvil. Es aceptable bajo NIIF para PYMES, pero valora las salidas con costo desfasado. Evaluar PMP móvil en una fase posterior.
