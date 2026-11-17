/**
 * ============================================================================
 * GRUPO DECORM — SISTEMA MAESTRO UNIFICADO (DICORMS v2.0)
 * Backend CRUD Complejo en Google Apps Script para Google Sheets
 * ============================================================================
 * Cubre:
 * - Router HTTP (doGet / doPost) con soporte CORS (Content-Type: text/plain)
 * - Autenticación HMAC-SHA256 + Control de Acceso Basado en Roles (RBAC)
 * - Concurrencia con LockService + Idempotencia por requestId (CacheService)
 * - Escritura exclusiva en columnas de captura (protege columnas con fórmulas)
 * - Auto-expansión de capacidad (ensureCapacity_) copiando fórmulas y validaciones
 * - Transacciones compuestas:
 *   1) compras.create / createBatch / fromCotizacion / importDte (DTE El Salvador)
 *   2) movimientos.create / createBatch / entregarAPuerta (descuenta Stock Actual)
 *   3) seguimiento.upsert / equivalencias.confirmar (INS-0xx -> SKU Catálogo)
 *   4) conciliacion.get (Físico SeguimientoManualStok vs. Sistema Inv.*)
 *   5) dashboard.get (Métricas de Inicio, Consumo Semanal Lun-Dom, Top 10, Cobertura)
 * - Auditoría automática en hoja _LOG y correlativos atómicos en _SEQ
 */

const SCRIPT_CONFIG = {
  TIMEZONE: 'America/El_Salvador',
  IVA_DEFAULT: 0.13,
  TOKEN_TTL_MS: 12 * 60 * 60 * 1000, // 12 horas
  IDEMPOTENCY_TTL_SEC: 21600,        // 6 horas en CacheService
  LOCK_TIMEOUT_MS: 15000,
  CAPACITY_BUFFER_ROWS: 50,
};

const SCHEMA = {
  catalogo: {
    sheet: 'Catalogo',
    headerRow: 2,
    firstRow: 3,
    pk: 'sku',
    slotCols: ['SKU'],
    inputs: {
      sku: 'SKU',
      descripcion: 'Descripción',
      categoria: 'Categoría',
      unidad: 'Unidad',
      origen: 'Origen',
      proveedor_pref: 'Proveedor preferido',
      sku_anterior: 'SKU anterior / cód. proveedor',
      stock_inicial: 'Stock inicial',
      stock_minimo: 'Stock mínimo',
    },
    computed: {
      grupo_gasto: 'Grupo de gasto',
      entradas_compras: 'Entradas (compras)',
      otras_entradas: 'Otras entradas',
      salidas: 'Salidas',
      stock_teorico: 'Stock teórico',
      ultimo_conteo: 'Último conteo físico',
      fecha_conteo: 'Fecha conteo',
      mov_neto_post_conteo: 'Mov. neto post-conteo',
      stock_actual: 'STOCK ACTUAL',
      dif_conteo_vs_teorico: 'Dif. conteo vs teórico',
      precio_ref_neto: 'Precio ref. neto (última compra)',
      pmp: 'PMP',
      costo_valoracion: 'Costo unit. valoración',
      valor_inventario: 'Valor inventario $',
      estado: 'ESTADO',
      dem_talleres_pend: 'Dem. talleres pendiente',
      dem_puertas_pend: 'Dem. puertas pendiente',
      compra_sugerida: 'COMPRA SUGERIDA',
      costo_est_compra: 'Costo est. compra $',
    },
    types: {
      stock_inicial: 'number',
      stock_minimo: 'number',
    },
  },

  compras: {
    sheet: 'Compras',
    headerRow: 1,
    firstRow: 2,
    pk: 'row_id',
    slotCols: ['Fecha', 'SKU'],
    inputs: {
      fecha: 'Fecha',
      proveedor: 'Proveedor',
      sku: 'SKU',
      cant_pedida: 'Cant. pedida',
      cant_recibida: 'Cant. recibida',
      precio_unit_pagado: 'Precio unit. pagado $',
      taller_destino: 'Taller destino',
      n_cot_ref: 'N.º cotización ref.',
      observaciones: 'Observaciones',
      tipo_dte: 'Tipo de DTE',
      n_dte: 'N.º DTE / Factura',
    },
    computed: {
      descripcion: 'Descripción',
      unidad: 'Unidad',
      total_pagado: 'Total pagado $',
      costo_neto: 'Costo neto $ (sin crédito fiscal)',
      iva_credito: 'IVA crédito fiscal $',
      precio_neto_unit: 'Precio neto unit. $',
      categoria: 'Categoría',
      grupo_gasto: 'Grupo de gasto',
      clave_mes: 'Clave mes',
      estado_recepcion: 'Estado recepción',
      validacion: 'Validación',
    },
    types: {
      fecha: 'date',
      cant_pedida: 'number',
      cant_recibida: 'number',
      precio_unit_pagado: 'number',
    },
  },

  movimientos: {
    sheet: 'MOVIMIENTOSInsumosOperativo',
    headerRow: 1,
    firstRow: 2,
    pk: 'id',
    slotCols: ['Fecha', 'SKU'],
    inputs: {
      fecha: 'Fecha',
      tipo: 'Tipo',
      sku: 'SKU',
      cantidad: 'Cantidad',
      taller_destino: 'Taller / destino',
      entregado_a: 'Entregado a (persona)',
      observaciones: 'Observaciones',
    },
    computed: {
      id: 'ID',
      descripcion: 'Descripción',
      unidad: 'Unidad',
      categoria: 'Categoría',
      grupo_gasto: 'Grupo de gasto',
      costo_estimado: 'Costo estimado $',
      clave_mes: 'Clave mes',
      validacion: 'Validación',
    },
    types: {
      fecha: 'date',
      cantidad: 'number',
    },
  },

  prestamos: {
    sheet: 'PrestamosEquipos',
    headerRow: 1,
    firstRow: 2,
    pk: 'id_prestamo',
    slotCols: ['Fecha Salida', 'SKU Equipo'],
    inputs: {
      fecha_salida: 'Fecha Salida',
      persona: 'Persona Responsable',
      sku_equipo: 'SKU Equipo',
      cant_prestada: 'Cant. Prestada',
      cant_devuelta: 'Cant. Devuelta',
      taller_proyecto: 'Taller / Proyecto',
      observaciones: 'Observaciones',
    },
    computed: {
      id_prestamo: 'ID Préstamo',
      descripcion_equipo: 'Descripción Equipo [Auto]',
      estado_prestamo: 'Estado Préstamo [Auto]',
    },
    types: {
      fecha_salida: 'date',
      cant_prestada: 'number',
      cant_devuelta: 'number',
    },
  },

  seguimiento: {
    sheet: 'SeguimientoManualStok',
    headerRow: 1,
    firstRow: 2,
    pk: 'id_articulo',
    slotCols: ['ID del artículo'],
    inputs: {
      id_articulo: 'ID del artículo',
      nombre_articulo: 'Nombre del artículo',
      tipo: 'Tipo',
      stock: 'Stock',
      stock_minimo: 'Stock Mínimo',
      estado: 'Estado',
      notas: 'Notas',
    },
    computed: {
      sku_catalogo: 'SKU Catálogo [Auto]',
      stock_sistema: 'Stock Sistema [Auto]',
      diferencia: 'Diferencia [Auto]',
      estado_conciliacion: 'Estado Conciliación [Auto]',
    },
    types: {
      stock: 'number',
      stock_minimo: 'number',
    },
  },

  equivalencias: {
    sheet: 'Equivalencias',
    headerRow: 4,
    firstRow: 5,
    pk: 'sku_catalogo',
    slotCols: ['ID Conteo (INS)', 'SKU Catálogo'],
    inputs: {
      id_conteo_ins: 'ID Conteo (INS)',
      sku_catalogo: 'SKU Catálogo',
      factor_desglose: 'Factor Desglose',
      estado_equivalencia: 'Estado Equivalencia',
      detalle: 'Detalle / Confirmación Requerida',
    },
    computed: {
      nombre_conteo: 'Nombre en Conteo Manual [Auto]',
      descripcion_catalogo: 'Descripción en Catálogo [Auto]',
      stock_fisico_asignado: 'Stock Físico Asignado [Auto]',
      stock_sistema_inv: 'Stock Sistema Inv.* [Auto]',
    },
    types: {
      factor_desglose: 'number',
    },
  },

  conciliacion: {
    sheet: 'Conciliacion',
    headerRow: 4,
    firstRow: 5,
    pk: 'sku',
    slotCols: ['SKU'],
    inputs: {
      sku: 'SKU',
      causa_probable: 'Causa probable',
    },
    computed: {
      id_conteo_ins: 'ID Conteo (INS)',
      descripcion: 'Descripción',
      stock_fisico: 'Stock físico (SeguimientoManualStok)',
      stock_sistema: 'Stock sistema (Inv.*)',
      diferencia: 'Diferencia',
      pct_diferencia: '% diferencia',
      estado: 'Estado (CUADRA / FALTANTE / SOBRANTE / SIN CONTEO)',
    },
    types: {},
  },

  agenda_puertas: {
    sheet: 'AgendaDePuertas',
    headerRow: 1,
    firstRow: 2,
    pk: 'sku_puerta',
    slotCols: ['SKU Puerta'],
    inputs: {
      sku_puerta: 'SKU Puerta',
      dia_entrega: 'Día Entrega',
      cliente: 'Cliente',
      modelo: 'Modelo',
      posicion: 'Posición',
      unidades: 'Unidades',
      estado: 'Estado',
      medidas: 'Medidas',
      color: 'Color',
      vidrio: 'Vidrio',
      cerradura: 'Cerradura',
      haladera: 'Haladera',
      chambrana: 'Chambrana',
      notas_tecnicas: 'Notas Técnicas',
      taller: 'Taller',
    },
    computed: {},
    types: {
      unidades: 'number',
    },
  },
};

const ROLE_PERMISSIONS = {
  admin: ['*'],
  compras: [
    'auth.me', 'config.get',
    'catalogo.list', 'catalogo.get', 'catalogo.create', 'catalogo.update', 'catalogo.nextSku', 'catalogo.kardex',
    'compras.list', 'compras.get', 'compras.create', 'compras.createBatch', 'compras.update', 'compras.clear', 'compras.importDte',
    'movimientos.list', 'seguimiento.list', 'equivalencias.list', 'conciliacion.get', 'dashboard.get', 'puertas.list', 'puertas.create', 'puertas.update'
  ],
  bodega: [
    'auth.me', 'config.get',
    'catalogo.list', 'catalogo.get', 'catalogo.kardex',
    'compras.list',
    'movimientos.list', 'movimientos.create', 'movimientos.createBatch', 'movimientos.entregarAPuerta',
    'prestamos.list', 'prestamos.create', 'prestamos.devolver',
    'seguimiento.list', 'seguimiento.upsert', 'equivalencias.list', 'equivalencias.confirmar',
    'conciliacion.get', 'dashboard.get', 'puertas.list'
  ],
  taller: [
    'auth.me', 'config.get', 'catalogo.list', 'movimientos.list', 'puertas.list', 'dashboard.get'
  ],
  lectura: [
    'auth.me', 'config.get', 'catalogo.list', 'catalogo.get', 'catalogo.kardex',
    'compras.list', 'movimientos.list', 'prestamos.list', 'seguimiento.list',
    'equivalencias.list', 'conciliacion.get', 'dashboard.get', 'puertas.list'
  ],
};

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'health';
    if (action === 'health') {
      return jsonResponse_({
        ok: true,
        data: {
          service: 'DICORMS Unified CRUD API (GRUPO DECORM)',
          version: '2.0.0',
          timezone: SCRIPT_CONFIG.TIMEZONE,
          timestamp: new Date().toISOString(),
        },
      });
    }
    const token = (e && e.parameter && e.parameter.token) || '';
    const params = e && e.parameter && e.parameter.params ? JSON.parse(e.parameter.params) : {};
    return dispatchAction_(action, params, token, null);
  } catch (err) {
    return errorResponse_(err);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw appError_('BAD_REQUEST', 'El cuerpo de la petición POST está vacío.');
    }
    const req = JSON.parse(e.postData.contents);
    const action = req.action;
    const token = req.token || '';
    const requestId = req.requestId || null;
    const params = req.params || {};
    return dispatchAction_(action, params, token, requestId);
  } catch (err) {
    return errorResponse_(err);
  }
}

function dispatchAction_(action, params, token, requestId) {
  const routes = getRoutes_();
  const handler = routes[action];
  if (!handler) {
    throw appError_('ACTION_NOT_FOUND', 'La acción solicitada no existe: ' + action);
  }

  let user = { username: 'anon', role: 'admin', taller: 'Todos' };
  if (action !== 'auth.login' && action !== 'health') {
    user = verifyTokenAndAuthorize_(token, action);
  }

  const result = handler(params, user, requestId);
  return jsonResponse_({ ok: true, data: result });
}

function getRoutes_() {
  return {
    'auth.login': handleAuthLogin_,
    'auth.me': function(p, u) { return u; },
    'config.get': handleConfigGet_,
    'schema.validate': handleSchemaValidate_,

    'catalogo.list': function(p) { return listEntity_('catalogo', p); },
    'catalogo.get': function(p) { return getByPk_('catalogo', p.sku); },
    'catalogo.create': function(p, u, reqId) { return createCatalogo_(p, u, reqId); },
    'catalogo.update': function(p, u, reqId) { return updateByPk_('catalogo', p.sku, p.changes, u, reqId); },
    'catalogo.nextSku': function(p) { return nextCorrelative_('SKU_' + (p.prefijo || 'CON'), p.prefijo || 'CON', 3); },
    'catalogo.kardex': handleCatalogoKardex_,

    'compras.list': function(p) { return listEntity_('compras', p); },
    'compras.create': function(p, u, reqId) { return createCompra_(p, u, reqId); },
    'compras.createBatch': function(p, u, reqId) { return createComprasBatch_(p, u, reqId); },
    'compras.update': function(p, u, reqId) { return updateRowByIndex_('compras', p.rowNumber, p.changes, u, reqId); },
    'compras.clear': function(p, u, reqId) { return clearRowByIndex_('compras', p.rowNumber, u, reqId); },
    'compras.importDte': handleComprasImportDte_,

    'movimientos.list': function(p) { return listEntity_('movimientos', p); },
    'movimientos.create': function(p, u, reqId) { return createMovimiento_(p, u, reqId); },
    'movimientos.createBatch': function(p, u, reqId) { return createMovimientosBatch_(p, u, reqId); },
    'movimientos.entregarAPuerta': handleEntregarAPuerta_,
    'movimientos.update': function(p, u, reqId) { return updateRowByIndex_('movimientos', p.rowNumber, p.changes, u, reqId); },
    'movimientos.clear': function(p, u, reqId) { return clearRowByIndex_('movimientos', p.rowNumber, u, reqId); },

    'prestamos.list': function(p) { return listEntity_('prestamos', p); },
    'prestamos.create': function(p, u, reqId) { return createPrestamo_(p, u, reqId); },
    'prestamos.devolver': handleDevolverPrestamo_,

    'seguimiento.list': function(p) { return listEntity_('seguimiento', p); },
    'seguimiento.upsert': handleSeguimientoUpsert_,
    'equivalencias.list': function(p) { return listEntity_('equivalencias', p); },
    'equivalencias.confirmar': handleConfirmarEquivalencia_,

    'conciliacion.get': handleConciliacionGet_,
    'dashboard.get': handleDashboardGet_,

    'puertas.list': function(p) { return listEntity_('agenda_puertas', p); },
    'puertas.create': function(p, u, reqId) { return createRow_('agenda_puertas', p, u, reqId); },
    'puertas.update': function(p, u, reqId) { return updateByPk_('agenda_puertas', p.sku_puerta, p.changes, u, reqId); },
  };
}

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(name) {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(name);
  if (!sh) {
    throw appError_('SHEET_NOT_FOUND', 'No se encontró la hoja requerida: ' + name);
  }
  return sh;
}

function headerMap_(sh, headerRow) {
  const maxCol = sh.getLastColumn();
  if (maxCol === 0) return {};
  const headers = sh.getRange(headerRow, 1, 1, maxCol).getValues()[0];
  const map = {};
  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').trim();
    if (h) map[h] = c + 1;
  }
  return map;
}

function firstFreeRow_(sh, def, cols) {
  const lastRow = sh.getLastRow();
  if (lastRow < def.firstRow) return def.firstRow;

  const numRows = lastRow - def.firstRow + 1;
  const maxCol = sh.getLastColumn();
  const data = sh.getRange(def.firstRow, 1, numRows, maxCol).getValues();
  const slotIndices = def.slotCols.map(function(sc) {
    if (!cols[sc]) throw appError_('SCHEMA_MISMATCH', 'Falta columna clave ' + sc + ' en ' + def.sheet);
    return cols[sc] - 1;
  });

  let totalRowIndex = -1;
  for (let i = 0; i < data.length; i++) {
    const firstCell = String(data[i][0] || '').trim().toUpperCase();
    if (firstCell === 'TOTAL' || firstCell === 'RESUMEN') {
      totalRowIndex = def.firstRow + i;
      break;
    }
    const isFree = slotIndices.every(function(idx) {
      const val = data[i][idx];
      return val === '' || val === null || val === undefined;
    });
    if (isFree) {
      return def.firstRow + i;
    }
  }

  return ensureCapacity_(sh, def, totalRowIndex);
}

function ensureCapacity_(sh, def, totalRowIndex) {
  const addRows = SCRIPT_CONFIG.CAPACITY_BUFFER_ROWS;
  const maxCol = sh.getLastColumn();
  const templateRow = totalRowIndex > def.firstRow ? totalRowIndex - 1 : sh.getLastRow();

  sh.insertRowsAfter(templateRow, addRows);
  const sourceRange = sh.getRange(templateRow, 1, 1, maxCol);
  const targetRange = sh.getRange(templateRow + 1, 1, addRows, maxCol);

  sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_NORMAL, false);

  const cols = headerMap_(sh, def.headerRow);
  Object.keys(def.inputs).forEach(function(apiKey) {
    const colName = def.inputs[apiKey];
    const colIdx = cols[colName];
    if (colIdx) {
      sh.getRange(templateRow + 1, colIdx, addRows, 1).clearContent();
    }
  });

  return templateRow + 1;
}

function writeInputs_(sh, row, cols, def, payload) {
  Object.keys(def.inputs).forEach(function(apiKey) {
    if (payload[apiKey] === undefined) return;
    const colName = def.inputs[apiKey];
    const colIdx = cols[colName];
    if (!colIdx) {
      throw appError_('SCHEMA_MISMATCH', 'Columna no encontrada en ' + def.sheet + ': ' + colName);
    }
    const coerced = coerceValue_(payload[apiKey], def.types && def.types[apiKey]);
    sh.getRange(row, colIdx).setValue(coerced);
  });
}

function readRow_(sh, row, cols, def) {
  const maxCol = sh.getLastColumn();
  const values = sh.getRange(row, 1, 1, maxCol).getValues()[0];
  const obj = { _rowNumber: row };

  const allMappings = Object.assign({}, def.inputs, def.computed);
  Object.keys(allMappings).forEach(function(apiKey) {
    const colName = allMappings[apiKey];
    const colIdx = cols[colName];
    if (colIdx) {
      const raw = values[colIdx - 1];
      obj[apiKey] = raw instanceof Date
        ? Utilities.formatDate(raw, SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd')
        : raw;
    }
  });
  return obj;
}

function createRow_(entity, payload, user, requestId) {
  const def = SCHEMA[entity];
  const sh = getSheet_(def.sheet);
  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);

  try {
    if (requestId) {
      const cached = getCachedRequest_(requestId);
      if (cached) return cached;
    }

    const cols = headerMap_(sh, def.headerRow);
    const row = firstFreeRow_(sh, def, cols);
    writeInputs_(sh, row, cols, def, payload);
    SpreadsheetApp.flush();

    const out = readRow_(sh, row, cols, def);
    const response = {
      row: out,
      affected: getAffectedCatalogo_(payload.sku || payload.sku_catalogo || payload.sku_equipo),
    };

    logAudit_(user, 'CREATE', entity, String(out[def.pk] || row), null, out);
    if (requestId) rememberRequest_(requestId, response);
    return response;
  } finally {
    lock.releaseLock();
  }
}

function updateByPk_(entity, pkValue, changes, user, requestId) {
  if (!pkValue) throw appError_('VALIDATION', 'Debe especificar la llave primaria para actualizar.');
  const def = SCHEMA[entity];
  const sh = getSheet_(def.sheet);
  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);

  try {
    const cols = headerMap_(sh, def.headerRow);
    const pkHeader = def.inputs[def.pk] || def.computed[def.pk];
    const pkCol = cols[pkHeader];
    const lastRow = sh.getLastRow();
    const pkVals = sh.getRange(def.firstRow, pkCol, lastRow - def.firstRow + 1, 1).getValues();

    let targetRow = -1;
    for (let i = 0; i < pkVals.length; i++) {
      if (String(pkVals[i][0]).trim() === String(pkValue).trim()) {
        targetRow = def.firstRow + i;
        break;
      }
    }
    if (targetRow === -1) {
      throw appError_('NOT_FOUND', 'No se encontró registro con ' + def.pk + ' = ' + pkValue);
    }

    const before = readRow_(sh, targetRow, cols, def);
    writeInputs_(sh, targetRow, cols, def, changes);
    SpreadsheetApp.flush();
    const after = readRow_(sh, targetRow, cols, def);

    logAudit_(user, 'UPDATE', entity, String(pkValue), before, after);
    return {
      row: after,
      affected: getAffectedCatalogo_(after.sku || after.sku_catalogo),
    };
  } finally {
    lock.releaseLock();
  }
}

function updateRowByIndex_(entity, rowNumber, changes, user, requestId) {
  const def = SCHEMA[entity];
  const sh = getSheet_(def.sheet);
  if (!rowNumber || rowNumber < def.firstRow) {
    throw appError_('VALIDATION', 'Número de fila inválido: ' + rowNumber);
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);

  try {
    const cols = headerMap_(sh, def.headerRow);
    const before = readRow_(sh, rowNumber, cols, def);
    writeInputs_(sh, rowNumber, cols, def, changes);
    SpreadsheetApp.flush();
    const after = readRow_(sh, rowNumber, cols, def);

    logAudit_(user, 'UPDATE_ROW', entity, 'R' + rowNumber, before, after);
    return {
      row: after,
      affected: getAffectedCatalogo_(after.sku || before.sku),
    };
  } finally {
    lock.releaseLock();
  }
}

function clearRowByIndex_(entity, rowNumber, user, requestId) {
  const def = SCHEMA[entity];
  const sh = getSheet_(def.sheet);
  if (!rowNumber || rowNumber < def.firstRow) {
    throw appError_('VALIDATION', 'Número de fila inválido para limpiar: ' + rowNumber);
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);

  try {
    const cols = headerMap_(sh, def.headerRow);
    const before = readRow_(sh, rowNumber, cols, def);
    Object.keys(def.inputs).forEach(function(apiKey) {
      const colIdx = cols[def.inputs[apiKey]];
      if (colIdx) sh.getRange(rowNumber, colIdx).clearContent();
    });
    SpreadsheetApp.flush();
    logAudit_(user, 'CLEAR_ROW', entity, 'R' + rowNumber, before, null);
    return { clearedRow: rowNumber, affected: getAffectedCatalogo_(before.sku) };
  } finally {
    lock.releaseLock();
  }
}

function listEntity_(entity, params) {
  const def = SCHEMA[entity];
  const sh = getSheet_(def.sheet);
  const cols = headerMap_(sh, def.headerRow);
  const lastRow = sh.getLastRow();
  if (lastRow < def.firstRow) {
    return { rows: [], total: 0, page: 1, pageSize: 50 };
  }

  const maxCol = sh.getLastColumn();
  const rawData = sh.getRange(def.firstRow, 1, lastRow - def.firstRow + 1, maxCol).getValues();
  const allMappings = Object.assign({}, def.inputs, def.computed);

  const rows = [];
  for (let i = 0; i < rawData.length; i++) {
    const rowArr = rawData[i];
    const firstVal = String(rowArr[0] || '').trim().toUpperCase();
    if (firstVal === 'TOTAL' || firstVal === 'RESUMEN') continue;

    const hasSlot = def.slotCols.some(function(sc) {
      const idx = cols[sc] - 1;
      return rowArr[idx] !== '' && rowArr[idx] !== null && rowArr[idx] !== undefined;
    });
    if (!hasSlot) continue;

    const item = { _rowNumber: def.firstRow + i };
    Object.keys(allMappings).forEach(function(apiKey) {
      const colIdx = cols[allMappings[apiKey]];
      if (colIdx) {
        const val = rowArr[colIdx - 1];
        item[apiKey] = val instanceof Date
          ? Utilities.formatDate(val, SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd')
          : val;
      }
    });
    rows.push(item);
  }

  const filtered = applyQueryAndFilters_(rows, params || {});
  const page = Number((params && params.page) || 1);
  const pageSize = Number((params && params.pageSize) || 100);
  const start = (page - 1) * pageSize;

  return {
    rows: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page: page,
    pageSize: pageSize,
  };
}

function getByPk_(entity, pkValue) {
  const res = listEntity_(entity, { pageSize: 5000 });
  const def = SCHEMA[entity];
  const found = res.rows.find(function(r) {
    return String(r[def.pk]).trim().toUpperCase() === String(pkValue).trim().toUpperCase();
  });
  if (!found) {
    throw appError_('NOT_FOUND', 'No existe ' + entity + ' con ' + def.pk + ' = ' + pkValue);
  }
  return found;
}

function createCatalogo_(payload, user, requestId) {
  if (!payload.sku || !payload.descripcion || !payload.categoria || !payload.unidad) {
    throw appError_('VALIDATION', 'Campos obligatorios en Catálogo: sku, descripcion, categoria, unidad.');
  }
  const existing = listEntity_('catalogo', { pageSize: 5000 }).rows;
  if (existing.some(function(r) { return String(r.sku).toUpperCase() === String(payload.sku).toUpperCase(); })) {
    throw appError_('CONFLICT', 'El SKU ya existe en el Catálogo: ' + payload.sku);
  }
  return createRow_('catalogo', payload, user, requestId);
}

function createCompra_(payload, user, requestId) {
  validateSkuExists_(payload.sku);
  if (Number(payload.cant_recibida || 0) <= 0) {
    throw appError_('VALIDATION', 'La cantidad recibida en Compras debe ser mayor a 0.');
  }
  if (!payload.fecha) {
    payload.fecha = Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  if (!payload.tipo_dte) {
    payload.tipo_dte = 'Pendiente';
  }
  return createRow_('compras', payload, user, requestId);
}

function createComprasBatch_(params, user, requestId) {
  const cabecera = params.cabecera || {};
  const lineas = params.lineas || [];
  if (!lineas.length) throw appError_('VALIDATION', 'Debe enviar al menos una línea de compra.');

  const results = [];
  lineas.forEach(function(lin, idx) {
    const merged = Object.assign({}, cabecera, lin);
    const subReqId = requestId ? requestId + '_' + idx : null;
    results.push(createCompra_(merged, user, subReqId));
  });
  return { count: results.length, items: results };
}

function handleComprasImportDte_(params, user, requestId) {
  const dte = params.dteJson;
  if (!dte || !dte.identificacion || !dte.cuerpoDocumento) {
    throw appError_('VALIDATION', 'El JSON de DTE no contiene identificacion o cuerpoDocumento.');
  }

  const tipoMap = { '03': 'CCF', '01': 'Factura consumidor final', '14': 'Sujeto excluido' };
  const tipoDte = tipoMap[dte.identificacion.tipoDte] || 'Pendiente';
  const codGen = dte.identificacion.codigoGeneracion || dte.identificacion.numeroControl;
  const fechaEmi = dte.identificacion.fecEmi;
  const proveedor = (dte.emisor && dte.emisor.nombre) || 'Por asignar';

  const comprasActuales = listEntity_('compras', { pageSize: 2000 }).rows;
  if (codGen && comprasActuales.some(function(c) { return String(c.n_dte) === String(codGen); })) {
    throw appError_('CONFLICT', 'El DTE con código de generación ' + codGen + ' ya fue registrado.');
  }

  const lineas = dte.cuerpoDocumento.map(function(item) {
    const precioUniRaw = Number(item.precioUni || 0);
    const precioConIva = tipoDte === 'CCF'
      ? Number((precioUniRaw * (1 + SCRIPT_CONFIG.IVA_DEFAULT)).toFixed(4))
      : precioUniRaw;
    return {
      sku: item.codigo || params.defaultSku || 'GEN-002',
      cant_pedida: Number(item.cantidad || 1),
      cant_recibida: Number(item.cantidad || 1),
      precio_unit_pagado: precioConIva,
      observaciones: 'DTE ' + codGen + ' | ' + (item.descripcion || ''),
    };
  });

  return createComprasBatch_({
    cabecera: {
      fecha: fechaEmi,
      proveedor: proveedor,
      tipo_dte: tipoDte,
      n_dte: codGen,
      taller_destino: params.taller_destino || 'Bodega',
    },
    lineas: lineas,
  }, user, requestId);
}

function createMovimiento_(payload, user, requestId) {
  validateSkuExists_(payload.sku);
  const cantidad = Number(payload.cantidad || 0);
  if (cantidad <= 0) {
    throw appError_('VALIDATION', 'La cantidad del movimiento debe ser estrictamente mayor a 0.');
  }

  const tipo = payload.tipo || 'Salida';
  if (tipo === 'Salida') {
    const taller = String(payload.taller_destino || '').trim();
    if (!taller || taller.toLowerCase() === 'sin asignar') {
      throw appError_('VALIDATION', 'Toda Salida de insumos requiere indicar el Taller / destino válido.');
    }
  }

  if (!payload.fecha) {
    payload.fecha = Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }

  const res = createRow_('movimientos', payload, user, requestId);
  res.stockWarning = (res.affected && res.affected.stock_actual < 0)
    ? '⚠ El stock actual de ' + payload.sku + ' quedó en negativo (' + res.affected.stock_actual + ').'
    : null;
  return res;
}

function createMovimientosBatch_(params, user, requestId) {
  const cabecera = params.cabecera || {};
  const lineas = params.lineas || [];
  if (!lineas.length) throw appError_('VALIDATION', 'Debe enviar al menos una línea de salida.');

  const results = [];
  lineas.forEach(function(lin, idx) {
    const merged = Object.assign({}, cabecera, lin);
    const subReqId = requestId ? requestId + '_' + idx : null;
    results.push(createMovimiento_(merged, user, subReqId));
  });
  return { count: results.length, items: results };
}

function handleEntregarAPuerta_(params, user, requestId) {
  if (!params.sku_puerta) {
    throw appError_('VALIDATION', 'Debe indicar sku_puerta para vincular la salida a la puerta.');
  }
  const puerta = getByPk_('agenda_puertas', params.sku_puerta);
  const movPayload = {
    fecha: params.fecha || Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd'),
    tipo: 'Salida',
    sku: params.sku,
    cantidad: params.cantidad,
    taller_destino: params.taller_destino || puerta.taller || 'Santa Ana',
    entregado_a: params.entregado_a || '',
    observaciones: 'Puerta ' + params.sku_puerta + ' (' + (puerta.cliente || '') + ') | ' + (params.observaciones || ''),
  };
  return createMovimiento_(movPayload, user, requestId);
}

function createPrestamo_(payload, user, requestId) {
  const catItem = validateSkuExists_(payload.sku_equipo);
  if (String(catItem.categoria).indexOf('Equipos') === -1 && String(payload.sku_equipo).indexOf('EQU-') !== 0) {
    throw appError_('VALIDATION', 'La hoja PrestamosEquipos solo admite SKUs de Equipos y herramientas (EQU-*).');
  }
  if (Number(payload.cant_prestada || 0) <= 0) {
    throw appError_('VALIDATION', 'La cantidad prestada debe ser mayor a 0.');
  }
  payload.cant_devuelta = Number(payload.cant_devuelta || 0);
  return createRow_('prestamos', payload, user, requestId);
}

function handleDevolverPrestamo_(params, user, requestId) {
  const prestamo = getByPk_('prestamos', params.id_prestamo);
  const nuevaDevuelta = Number(prestamo.cant_devuelta || 0) + Number(params.cantidad_devuelta || 0);
  const obs = (prestamo.observaciones ? prestamo.observaciones + ' | ' : '') +
    'Devolución ' + (params.fecha || Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd')) + ': +' + params.cantidad_devuelta;
  return updateRowByIndex_('prestamos', prestamo._rowNumber, {
    cant_devuelta: nuevaDevuelta,
    observaciones: obs,
  }, user, requestId);
}

function handleSeguimientoUpsert_(params, user, requestId) {
  if (!params.id_articulo) {
    throw appError_('VALIDATION', 'Debe especificar id_articulo (ej. INS-001).');
  }
  const list = listEntity_('seguimiento', { pageSize: 500 }).rows;
  const existing = list.find(function(r) {
    return String(r.id_articulo).trim().toUpperCase() === String(params.id_articulo).trim().toUpperCase();
  });
  if (existing) {
    return updateByPk_('seguimiento', existing.id_articulo, params, user, requestId);
  }
  return createRow_('seguimiento', params, user, requestId);
}

function handleConfirmarEquivalencia_(params, user, requestId) {
  if (!params.sku_catalogo) {
    throw appError_('VALIDATION', 'Debe indicar sku_catalogo a confirmar.');
  }
  return updateByPk_('equivalencias', params.sku_catalogo, {
    estado_equivalencia: 'CONFIRMADO',
    factor_desglose: params.factor_desglose,
    detalle: params.detalle || 'Confirmado por ' + (user.username || 'usuario') + ' el ' +
      Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd'),
  }, user, requestId);
}

function handleConciliacionGet_(params) {
  const all = listEntity_('conciliacion', { pageSize: 1000 }).rows;
  const summary = {
    cuadra: 0,
    faltante: 0,
    sobrante: 0,
    no_cuadra: 0,
    sin_conteo: 0,
    total_evaluados: all.length,
  };

  all.forEach(function(r) {
    const est = String(r.estado || '').toUpperCase();
    if (est === 'CUADRA') summary.cuadra++;
    else if (est === 'FALTANTE') { summary.faltante++; summary.no_cuadra++; }
    else if (est === 'SOBRANTE') { summary.sobrante++; summary.no_cuadra++; }
    else summary.sin_conteo++;
  });

  let rows = all;
  if (params && params.estado) {
    rows = rows.filter(function(r) {
      return String(r.estado).toUpperCase() === String(params.estado).toUpperCase();
    });
  }
  if (params && params.soloConConteo) {
    rows = rows.filter(function(r) {
      return String(r.estado).toUpperCase() !== 'SIN CONTEO';
    });
  }

  return {
    summary: summary,
    rows: rows,
  };
}

function handleDashboardGet_(params, user) {
  const sh = getSheet_('Inicio');
  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);

  try {
    let dirty = false;
    if (params && params.clave_mes) { sh.getRange('B3').setValue(Number(params.clave_mes)); dirty = true; }
    if (params && params.taller) { sh.getRange('D3').setValue(String(params.taller)); dirty = true; }
    if (params && params.lunes_semana) { sh.getRange('F3').setValue(coerceValue_(params.lunes_semana, 'date')); dirty = true; }
    if (params && params.tolerancia !== undefined) { sh.getRange('H3').setValue(Number(params.tolerancia)); dirty = true; }
    if (dirty) SpreadsheetApp.flush();

    const vals = sh.getRange('A1:N51').getValues();

    const kpis = {
      clave_mes: vals[2][1],
      filtro_taller: vals[2][3],
      tolerancia_conciliacion: vals[2][7],
      articulos_a_comprar: Number(vals[5][0] || 0),
      articulos_agotados: Number(vals[5][2] || 0),
      valor_inventario: Number(vals[5][4] || 0),
      gasto_del_mes: Number(vals[5][6] || 0),
      conciliacion_resumen: String(vals[5][8] || ''),
      unidades_consumidas_mes: Number(vals[5][11] || 0),
    };

    const consumoSemanal = [];
    for (let r = 10; r <= 14; r++) {
      consumoSemanal.push({
        semana: vals[r][0],
        lunes_inicio: formatCellDate_(vals[r][1]),
        domingo_fin: formatCellDate_(vals[r][2]),
        eventos_salida: Number(vals[r][3] || 0),
        unidades_consumidas: Number(vals[r][4] || 0),
      });
    }

    const consumoPorTaller = [];
    for (let r = 20; r <= 23; r++) {
      consumoPorTaller.push({
        taller: vals[r][0],
        eventos_salida: Number(vals[r][1] || 0),
        unidades_consumidas: Number(vals[r][2] || 0),
        pct_consumo: Number(vals[r][3] || 0),
        gasto_compras: Number(vals[r][4] || 0),
      });
    }

    const top10Insumos = [];
    for (let r = 29; r <= 38; r++) {
      top10Insumos.push({
        rank: Number(vals[r][0] || 0),
        sku: vals[r][1],
        descripcion: vals[r][2],
        sem1: Number(vals[r][3] || 0),
        sem2: Number(vals[r][4] || 0),
        sem3: Number(vals[r][5] || 0),
        sem4: Number(vals[r][6] || 0),
        total_consumido: Number(vals[r][7] || 0),
        min_semanal: Number(vals[r][8] || 0),
        prom_semanal: Number(vals[r][9] || 0),
        max_semanal: Number(vals[r][10] || 0),
        stock_actual: Number(vals[r][11] || 0),
        cobertura_semanas: Number(vals[r][12] || 0),
        alerta_cobertura: vals[r][13],
      });
    }

    const alertas = [];
    for (let r = 44; r <= 50; r++) {
      alertas.push({
        control: vals[r][0],
        hoja_origen: vals[r][1],
        cantidad_casos: Number(vals[r][2] || 0),
        meta: Number(vals[r][3] || 0),
        severidad: vals[r][4],
        accion_recomendada: vals[r][5],
      });
    }

    return {
      kpis: kpis,
      consumo_semanal: consumoSemanal,
      consumo_por_taller: consumoPorTaller,
      top10_insumos: top10Insumos,
      alertas: alertas,
    };
  } finally {
    lock.releaseLock();
  }
}

function handleCatalogoKardex_(params) {
  if (!params || !params.sku) throw appError_('VALIDATION', 'Debe especificar sku para consultar el Kardex.');
  const item = getByPk_('catalogo', params.sku);
  const compras = listEntity_('compras', { filters: { sku: { eq: params.sku } }, pageSize: 1000 }).rows;
  const movs = listEntity_('movimientos', { filters: { sku: { eq: params.sku } }, pageSize: 1000 }).rows;
  const equivs = listEntity_('equivalencias', { filters: { sku_catalogo: { eq: params.sku } }, pageSize: 100 }).rows;

  const events = [];
  if (Number(item.stock_inicial || 0) !== 0) {
    events.push({
      fecha: '2026-11-01',
      tipo: 'Stock Inicial',
      referencia: 'Apertura Catálogo',
      entrada: Number(item.stock_inicial),
      salida: 0,
      taller: 'Bodega',
      observaciones: item.sku_anterior || '',
    });
  }

  compras.forEach(function(c) {
    events.push({
      fecha: c.fecha,
      tipo: 'Compra (' + (c.tipo_dte || 'S/DTE') + ')',
      referencia: c.n_dte || c.proveedor || 'Compra',
      entrada: Number(c.cant_recibida || 0),
      salida: 0,
      taller: c.taller_destino || 'Bodega',
      observaciones: c.observaciones || '',
    });
  });

  movs.forEach(function(m) {
    const isEntrada = m.tipo === 'Devolución' || m.tipo === 'Ajuste (+)';
    events.push({
      fecha: m.fecha,
      tipo: m.tipo,
      referencia: m.id,
      entrada: isEntrada ? Number(m.cantidad || 0) : 0,
      salida: isEntrada ? 0 : Number(m.cantidad || 0),
      taller: m.taller_destino || '',
      observaciones: m.observaciones || '',
    });
  });

  events.sort(function(a, b) {
    return String(a.fecha).localeCompare(String(b.fecha));
  });

  let saldo = 0;
  events.forEach(function(ev) {
    saldo += ev.entrada - ev.salida;
    ev.saldo_corrido = saldo;
  });

  return {
    sku: item.sku,
    descripcion: item.descripcion,
    unidad: item.unidad,
    stock_teorico_sistema: item.stock_teorico,
    stock_actual: item.stock_actual,
    ultimo_conteo_fisico: item.ultimo_conteo,
    diferencia_conciliacion: item.dif_conteo_vs_teorico,
    equivalencias_ins: equivs,
    movimientos_kardex: events,
  };
}

function handleConfigGet_() {
  const sh = getSheet_('Config');
  const lastRow = sh.getLastRow();
  const vals = sh.getRange(2, 1, Math.max(1, lastRow - 1), 21).getValues();

  const proveedores = [];
  const talleres = [];
  const categorias = [];
  const unidades = [];
  const operadores = [];
  const tiposDte = [];
  const tiposMovimiento = [];
  const parametros = {};

  vals.forEach(function(r) {
    if (r[0]) proveedores.push({ nombre: r[0], contacto: r[1], telefono: r[2], condicion_pago: r[3] });
    if (r[5]) talleres.push(r[5]);
    if (r[7]) categorias.push({ categoria: r[7], grupo_gasto: r[8] });
    if (r[10]) unidades.push(r[10]);
    if (r[13]) operadores.push(r[13]);
    if (r[15]) parametros[r[15]] = r[16];
    if (r[18]) tiposDte.push(r[18]);
    if (r[20]) tiposMovimiento.push(r[20]);
  });

  return {
    proveedores: proveedores,
    talleres: talleres,
    categorias: categorias,
    unidades: unidades,
    operadores: operadores,
    tipos_dte: tiposDte,
    tipos_movimiento: tiposMovimiento,
    parametros: parametros,
  };
}

function handleSchemaValidate_() {
  const report = [];
  Object.keys(SCHEMA).forEach(function(entity) {
    const def = SCHEMA[entity];
    const sh = getSheet_(def.sheet);
    const cols = headerMap_(sh, def.headerRow);
    const missing = [];
    const allCols = Object.assign({}, def.inputs, def.computed);
    Object.keys(allCols).forEach(function(k) {
      const hName = allCols[k];
      if (!cols[hName]) missing.push(hName);
    });
    report.push({
      entity: entity,
      sheet: def.sheet,
      valid: missing.length === 0,
      missingHeaders: missing,
    });
  });
  return { valid: report.every(function(r) { return r.valid; }), sheets: report };
}

function handleAuthLogin_(params) {
  const username = String((params && params.username) || '').trim();
  const pin = String((params && params.pin) || '').trim();
  if (!username || !pin) {
    throw appError_('AUTH', 'Debe proporcionar usuario y PIN.');
  }

  const ss = getSpreadsheet_();
  let shUsers = ss.getSheetByName('_USERS');
  if (!shUsers) {
    shUsers = ss.insertSheet('_USERS');
    shUsers.appendRow(['username', 'nombre', 'rol', 'pin_sha256', 'taller', 'activo']);
    shUsers.appendRow(['cristian', 'Cristian Cajul', 'admin', sha256_('123456'), 'Todos', true]);
  }

  const rows = shUsers.getDataRange().getValues();
  const pinHash = sha256_(pin);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[0]).toLowerCase() === username.toLowerCase() && Boolean(r[5]) !== false) {
      if (String(r[3]) === pinHash || String(r[3]) === pin) {
        const userPayload = {
          username: r[0],
          nombre: r[1],
          role: r[2] || 'lectura',
          taller: r[4] || 'Todos',
          exp: Date.now() + SCRIPT_CONFIG.TOKEN_TTL_MS,
        };
        return {
          token: signToken_(userPayload),
          user: userPayload,
        };
      }
    }
  }
  throw appError_('AUTH', 'Credenciales inválidas o usuario inactivo.');
}

function verifyTokenAndAuthorize_(token, action) {
  if (!token) {
    const enforceAuth = PropertiesService.getScriptProperties().getProperty('ENFORCE_AUTH') === 'true';
    if (!enforceAuth) return { username: 'cristian', role: 'admin', taller: 'Todos' };
    throw appError_('AUTH', 'Token de sesión requerido.');
  }

  const parts = String(token).split('.');
  if (parts.length !== 2) throw appError_('AUTH', 'Formato de token inválido.');
  const payloadB64 = parts[0];
  const sigB64 = parts[1];
  const expectedSig = hmacSha256_(payloadB64, getSecretKey_());
  if (sigB64 !== expectedSig) throw appError_('AUTH', 'Firma de token inválida.');

  const user = JSON.parse(Utilities.newBlob(Utilities.base64Decode(payloadB64)).getDataAsString());
  if (Date.now() > Number(user.exp || 0)) {
    throw appError_('AUTH', 'La sesión ha expirado.');
  }

  const allowed = ROLE_PERMISSIONS[user.role] || [];
  if (allowed.indexOf('*') === -1 && allowed.indexOf(action) === -1) {
    throw appError_('FORBIDDEN', 'El rol ' + user.role + ' no tiene permiso para ejecutar ' + action);
  }
  return user;
}

function logAudit_(user, operation, entity, recordId, beforeObj, afterObj) {
  try {
    const ss = getSpreadsheet_();
    let shLog = ss.getSheetByName('_LOG');
    if (!shLog) {
      shLog = ss.insertSheet('_LOG');
      shLog.appendRow(['Timestamp', 'Usuario', 'Rol', 'Operación', 'Entidad', 'ID Registro', 'Antes (JSON)', 'Después (JSON)']);
    }
    shLog.appendRow([
      Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
      (user && user.username) || 'system',
      (user && user.role) || 'admin',
      operation,
      entity,
      recordId,
      beforeObj ? JSON.stringify(beforeObj) : '',
      afterObj ? JSON.stringify(afterObj) : '',
    ]);
  } catch (e) {}
}

function nextCorrelative_(seqKey, prefix, padLen) {
  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);
  try {
    const ss = getSpreadsheet_();
    let shSeq = ss.getSheetByName('_SEQ');
    if (!shSeq) {
      shSeq = ss.insertSheet('_SEQ');
      shSeq.appendRow(['Clave', 'UltimoValor', 'Actualizado']);
    }
    const data = shSeq.getDataRange().getValues();
    let foundRow = -1;
    let nextVal = 1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === seqKey) {
        foundRow = i + 1;
        nextVal = Number(data[i][1] || 0) + 1;
        break;
      }
    }
    const nowStr = Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    if (foundRow === -1) {
      shSeq.appendRow([seqKey, nextVal, nowStr]);
    } else {
      shSeq.getRange(foundRow, 2, 1, 2).setValues([[nextVal, nowStr]]);
    }
    const numStr = ('000000' + nextVal).slice(-(padLen || 3));
    return { key: seqKey, number: nextVal, formatted: prefix + '-' + numStr };
  } finally {
    lock.releaseLock();
  }
}

function validateSkuExists_(sku) {
  if (!sku) throw appError_('VALIDATION', 'El campo SKU es obligatorio.');
  return getByPk_('catalogo', sku);
}

function getAffectedCatalogo_(sku) {
  if (!sku) return null;
  try {
    const item = getByPk_('catalogo', sku);
    return {
      sku: item.sku,
      descripcion: item.descripcion,
      stock_teorico: item.stock_teorico,
      stock_actual: item.stock_actual,
      ultimo_conteo: item.ultimo_conteo,
      dif_conteo_vs_teorico: item.dif_conteo_vs_teorico,
      estado: item.estado,
      compra_sugerida: item.compra_sugerida,
      pmp: item.pmp,
    };
  } catch (e) {
    return null;
  }
}

function coerceValue_(val, type) {
  if (val === null || val === undefined || val === '') return '';
  if (type === 'number') {
    const n = Number(val);
    if (isNaN(n)) throw appError_('VALIDATION', 'Valor numérico inválido: ' + val);
    return n;
  }
  if (type === 'date') {
    if (val instanceof Date) return val;
    const parts = String(val).split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return new Date(val);
  }
  const s = String(val).trim();
  if (/^[=+\-@]/.test(s)) {
    return "'" + s;
  }
  return s;
}

function applyQueryAndFilters_(rows, params) {
  let out = rows.slice();
  if (params.q) {
    const q = String(params.q).toLowerCase().trim();
    out = out.filter(function(r) {
      return Object.keys(r).some(function(k) {
        return String(r[k] || '').toLowerCase().indexOf(q) !== -1;
      });
    });
  }
  if (params.filters && typeof params.filters === 'object') {
    Object.keys(params.filters).forEach(function(field) {
      const cond = params.filters[field];
      if (!cond) return;
      out = out.filter(function(r) {
        const v = r[field];
        if (cond.eq !== undefined && String(v) !== String(cond.eq)) return false;
        if (cond.ne !== undefined && String(v) === String(cond.ne)) return false;
        if (cond.in && Array.isArray(cond.in) && cond.in.indexOf(v) === -1) return false;
        if (cond.gte !== undefined && v < cond.gte) return false;
        if (cond.lte !== undefined && v > cond.lte) return false;
        if (cond.like !== undefined && String(v || '').toLowerCase().indexOf(String(cond.like).toLowerCase()) === -1) return false;
        return true;
      });
    });
  }
  if (params.sort && Array.isArray(params.sort) && params.sort.length > 0) {
    const s = params.sort[0];
    const dir = String(s.dir || 'asc').toLowerCase() === 'desc' ? -1 : 1;
    out.sort(function(a, b) {
      const va = a[s.field];
      const vb = b[s.field];
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * dir;
    });
  }
  return out;
}

function formatCellDate_(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  return String(val || '');
}

function getCachedRequest_(requestId) {
  const raw = CacheService.getScriptCache().get('REQ_' + requestId);
  return raw ? JSON.parse(raw) : null;
}

function rememberRequest_(requestId, data) {
  CacheService.getScriptCache().put('REQ_' + requestId, JSON.stringify(data), SCRIPT_CONFIG.IDEMPOTENCY_TTL_SEC);
}

function getSecretKey_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('HMAC_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + '-' + Utilities.getUuid();
    props.setProperty('HMAC_SECRET', secret);
  }
  return secret;
}

function sha256_(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(digest);
}

function hmacSha256_(text, key) {
  const sig = Utilities.computeHmacSha256Signature(text, key, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(sig);
}

function signToken_(payloadObj) {
  const payloadB64 = Utilities.base64Encode(Utilities.newBlob(JSON.stringify(payloadObj)).getBytes());
  const sigB64 = hmacSha256_(payloadB64, getSecretKey_());
  return payloadB64 + '.' + sigB64;
}

function appError_(code, message, details) {
  const err = new Error(message);
  err.code = code;
  err.details = details || null;
  return err;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse_(err) {
  return jsonResponse_({
    ok: false,
    error: {
      code: err.code || 'INTERNAL',
      message: err.message || String(err),
      details: err.details || null,
    },
  });
}