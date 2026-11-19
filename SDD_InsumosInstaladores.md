## Software Design Document (SDD) — Hoja `InsumosInstaladores` y Extensión del CRUD (`dicorms_appsscript_crud_2.js`)

### 1. Objetivo

Integrar la pestaña **`InsumosInstaladores`** al backend existente de **Grupo Decorm** (`dicorms_appsscript_crud_2.js`), permitiendo registrar y consultar lo que llevan y reingresan los instaladores sin depender de stocks iniciales o mínimos.

---

### 2. Estructura que Debe Llevar la Hoja `InsumosInstaladores`

La pestaña debe llamarse **`InsumosInstaladores`** con cabecera en la **Fila 1** y registros a partir de la **Fila 2**:

| Columna | Encabezado exacto (`Row 1`) | Tipo de dato | Uso operativo |
| --- | --- | --- | --- |
| **A** | `Codigo`

 | Texto (`string`) | Código o SKU del insumo (llave de fila / referencia).

 |
| **B** | `Insumo`

 | Texto (`string`) | Nombre del material (ej. `Lija p80`, `Thinner`, `Cerradura Cromada LL Dormitorio`).

 |
| **C** | `Check`

 | Booleano (`TRUE` / `FALSE`) | Marca de control / verificación de entrega o reingreso.

 |
| **D** | `Cantidad`

 | Numérico (`number`) | Unidades o porciones entregadas/devueltas.

 |
| **E** | `Encargado de Instlacion`

 | Texto (`string`) | Responsable de instalación (se respeta el nombre exacto de columna).

 |
| **F** | `Encargado de bodega`

 | Texto (`string`) | Responsable de bodega que despacha o recibe.

 |

---

### 3. Cambios Requeridos en el CRUD (`dicorms_appsscript_crud_2.js`)

El script base ya provee el router `doGet` / `doPost`, autenticación HMAC-SHA256 / RBAC, `LockService`, idempotencia por `requestId` (`CacheService`), `firstFreeRow_`, `writeInputs_`, `listEntity_`, `updateRowByIndex_`, `clearRowByIndex_` y auditoría en `_LOG`. Para habilitar `InsumosInstaladores`, se añaden únicamente estos elementos:

#### 3.1 Definición en `SCHEMA`



```javascript
  insumos_instaladores: {
    sheet: 'InsumosInstaladores',
    headerRow: 1,
    firstRow: 2,
    pk: 'codigo',
    slotCols: ['Codigo', 'Insumo'],
    inputs: {
      codigo: 'Codigo',
      insumo: 'Insumo',
      check: 'Check',
      cantidad: 'Cantidad',
      encargado_instalacion: 'Encargado de Instlacion',
      encargado_bodega: 'Encargado de bodega',
    },
    computed: {},
    types: {
      check: 'boolean',
      cantidad: 'number',
    },
  },

```

#### 3.2 Rutas en `getRoutes_()`



```javascript
    'instaladores.list': function(p) { return listEntity_('insumos_instaladores', p); },
    'instaladores.create': function(p, u, reqId) { return createRow_('insumos_instaladores', p, u, reqId); },
    'instaladores.createBatch': handleInstaladoresBatch_,
    'instaladores.update': function(p, u, reqId) { return updateRowByIndex_('insumos_instaladores', p.rowNumber, p.changes, u, reqId); },
    'instaladores.clear': function(p, u, reqId) { return clearRowByIndex_('insumos_instaladores', p.rowNumber, u, reqId); },

```

#### 3.3 Handler en lote y soporte booleano

* En `coerceValue_(val, type)`, incluir: `if (type === 'boolean') return Boolean(val);`.


* Agregar `handleInstaladoresBatch_(params, user, requestId)` para insertar múltiples filas de `InsumosInstaladores` usando `createRow_('insumos_instaladores', payload, user, subReqId)` bajo `LockService` y control de `requestId`:



```javascript
function handleInstaladoresBatch_(params, user, requestId) {
  const cabecera = params.cabecera || {};
  const lineas = params.lineas || [];
  if (!lineas.length) {
    throw appError_('VALIDATION', 'Debe enviar al menos una línea para InsumosInstaladores.');
  }

  const results = [];
  lineas.forEach(function(lin, idx) {
    const payload = {
      codigo: lin.codigo,
      insumo: lin.insumo,
      check: lin.check === true,
      cantidad: Number(lin.cantidad || 0),
      encargado_instalacion: lin.encargado_instalacion !== undefined
        ? lin.encargado_instalacion
        : (cabecera.encargado_instalacion || ''),
      encargado_bodega: lin.encargado_bodega !== undefined
        ? lin.encargado_bodega
        : (cabecera.encargado_bodega || ''),
    };
    const subReqId = requestId ? requestId + '_' + idx : null;
    results.push(createRow_('insumos_instaladores', payload, user, subReqId));
  });

  return { count: results.length, items: results };
}

```

---

### 4. Contrato de Operaciones (`POST` / `GET`)

* **Listar registros (`instaladores.list`):** acepta `q`, `filters`, `sort`, `page` y `pageSize`.


* **Crear un registro (`instaladores.create`):** envía `codigo`, `insumo`, `check`, `cantidad`, `encargado_instalacion` y `encargado_bodega` en `params`.


* **Crear tanda/lote (`instaladores.createBatch`):** envía `cabecera` (`encargado_instalacion`, `encargado_bodega`) y `lineas` (`[{ codigo, insumo, check, cantidad }]`) más `requestId` para idempotencia.


* **Actualizar / limpiar fila (`instaladores.update` / `instaladores.clear`):** opera por `rowNumber` (`>= 2`) y deja rastro en `_LOG`.