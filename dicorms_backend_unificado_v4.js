/**
 * ============================================================================
 * GRUPO DECORM — SISTEMA MAESTRO UNIFICADO (DICORMS v4.1.0.0 Clean Code)
 * Backend Unificado en Google Apps Script (CRUD + Cotizaciones + Forecast)
 * Persistencia: DECORM_GROUP_v4.xlsx (18 hojas limpias, 0 #REF!/#N/A)
 * ============================================================================
 *
 * NOVEDADES v4.1.0.0:
 *  1. MÓDULO MAESTRO DE COTIZACIONES (R-43, R-44):
 *       - cotizaciones.list / cotizaciones.get / cotizaciones.fromAlerts
 *       - cotizaciones.create / cotizaciones.update / cotizaciones.setEstado
 *       - cotizaciones.createSheet: Duplica 'Plantilla_Cotizacion' creando una
 *         hoja dedicada 'COT-AA-NNN' con fórmulas automáticas e ítems marcados.
 *  2. CATÁLOGO DE PRECIOS POR PROVEEDOR (R-48):
 *       - precios.list / precios.upsert sobre la hoja 'Precios_Proveedor'
 *       - Guarda códigos de proveedor de Freund, Didelco y Lemus.
 *  3. INTEGRIDAD TRANSACCIONAL ATÓMICA PARA INSTALADORES (R-32):
 *       - instaladores.createBatch descuenta inventario atómicamente en
 *         'MOVIMIENTOSInsumosOperativo' con ref_tipo='INSTALADOR', ref_id=lote_id
 *         y taller='Instaladores', registrando mov_uid de trazabilidad.
 *  4. AUDITORÍA DE CALIDAD E HIGIENE DE DATOS (R-46):
 *       - calidad.get ejecuta en tiempo real los 8 controles obligatorios.
 *  5. TALLERES CANÓNICOS Y ANTI-DUPLICADO (R-35, R-41, R-42):
 *       - Catálogo cerrado de talleres (Santa Ana, Sonsonate, Taller Central,
 *         Instaladores, Bodega). Normalización automática de 'Taller 1'.
 *       - Anti-duplicado en compras sugeridas para SKUs en cotizaciones abiertas.
 *  6. CONCURRENCIA OPTIMISTA (R-39):
 *       - Control por 'uid' y 'updated_at' en todas las tablas transaccionales.
 *
 * PUESTA EN MARCHA EN GOOGLE APPS SCRIPT:
 *  1. Pegar este archivo en Code.gs de tu proyecto Apps Script (vinculado a DECORM_GROUP_v4.xlsx).
 *  2. Ejecutar 'setupV4()' para inicializar parámetros y validar rangos.
 *  3. Ejecutar 'installDailyTrigger()' para programar la corrida silenciosa 5:30 a.m.
 *  4. Desplegar como Aplicación Web (Acceso: 'Cualquier usuario').
 * ============================================================================
 */
/* ========================================================================== *
 * SECCIÓN 1: CONFIGURACIÓN GLOBAL Y ESQUEMA DEL LIBRO (CRUD MAESTRO)
 * ========================================================================== */

const SCRIPT_CONFIG = {
  TIMEZONE: 'America/El_Salvador',
  IVA_DEFAULT: 0.13,
  TOKEN_TTL_MS: 12 * 60 * 60 * 1000, // 12 horas
  IDEMPOTENCY_TTL_SEC: 21600,        // 6 horas en CacheService
  LOCK_TIMEOUT_MS: 30000,
  FACTOR_PEDIDO: 1.9,
  VERSION: '4.1.0.0',
  CAPACITY_BUFFER_ROWS: 50,
};

/**
 * Mapeo declarativo de entidades a hojas de cálculo.
 * `inputs`: columnas editables por la API.
 * `computed`: columnas con fórmulas (protegidas contra sobrescritura).
 */
const SCHEMA = {
  precios_proveedor: {
    sheet: 'Precios_Proveedor',
    headerRow: 3,
    firstRow: 4,
    pk: 'uid',
    slotCols: ['SKU Interno', 'Proveedor'],
    inputs: {
      sku: 'SKU Interno',
      proveedor: 'Proveedor',
      codigo_proveedor: 'Cód. Proveedor',
      descripcion: 'Descripción en Proveedor',
      ultimo_precio: 'Último Precio Cotizado $',
      incluye_iva: 'Incluye IVA',
      fecha: 'Fecha Cotización',
      ref: 'Fuente / Ref.',
      uid: 'uid',
    },
    computed: {
      precio_neto: 'Precio Neto Sin IVA $ [Auto]',
    },
    types: {
      ultimo_precio: 'number',
    },
  },

  cotizaciones_cabecera: {
    sheet: 'Cotizaciones_Cabecera',
    headerRow: 1,
    firstRow: 2,
    pk: 'cotizacion_id',
    slotCols: ['Cotización ID', 'Proveedor'],
    inputs: {
      cotizacion_id: 'Cotización ID',
      fecha: 'Fecha',
      proveedor: 'Proveedor',
      taller_destino: 'Taller Destino',
      estado: 'Estado',
      notas: 'Notas',
      uid: 'uid',
      updated_at: 'updated_at',
    },
    computed: {
      precios_incluyen_iva: 'Precios Incluyen IVA [Auto]',
      items_marcados: 'Ítems Marcados [Auto]',
      subtotal_neto: 'Subtotal Neto $ [Auto]',
      iva_13: 'IVA 13% $ [Auto]',
      total: 'Total Cotización $ [Auto]',
    },
    types: {
      fecha: 'date',
    },
  },

  cotizaciones_detalle: {
    sheet: 'Cotizaciones_Detalle',
    headerRow: 1,
    firstRow: 2,
    pk: 'row_id',
    slotCols: ['Cotización ID', 'SKU'],
    inputs: {
      cotizacion_id: 'Cotización ID',
      incluir: 'Incluir',
      tipo_item: 'Tipo Ítem',
      sku: 'SKU',
      codigo_proveedor: 'Cód. Proveedor [Auto]',
      descripcion: 'Descripción [Auto]',
      unidad: 'Unidad [Auto]',
      cantidad: 'Cantidad',
      precio_unitario: 'Precio Unit. $',
      taller_linea: 'Taller Línea',
    },
    computed: {
      incluye_iva: 'Incluye IVA [Auto]',
      subtotal_neto: 'Subtotal Neto $ [Auto]',
      iva_13: 'IVA 13% $ [Auto]',
      total_linea: 'Total Línea $ [Auto]',
      estado_cot: 'Estado Cot. [Auto]',
    },
    types: {
      cantidad: 'number',
      precio_unitario: 'number',
    },
  },

  catalogo: {
    sheet: 'Catalogo',
    headerRow: 3,
    firstRow: 4,
    pk: 'sku',
    slotCols: ['SKU'],
    inputs: {
      sku: 'SKU',
      descripcion: 'Descripción',
      categoria: 'Categoría',
      unidad: 'Unidad',
      origen: 'Origen',
      proveedor_pref: 'Proveedor preferido',
      sku_anterior: 'SKU anterior / cód. prov.',
      stock_inicial: 'Stock inicial',
      stock_minimo: 'Stock mínimo',
      ultimo_conteo: 'Último conteo físico',
      fecha_conteo: 'Fecha conteo',
    },
    computed: {
      grupo_gasto: 'Grupo de gasto',
      entradas_compras: 'Entradas compras',
      otras_entradas: 'Otras entradas',
      salidas: 'Salidas',
      stock_teorico: 'Stock teórico',
      mov_neto_post_conteo: 'Mov. post-conteo',
      stock_actual: 'STOCK ACTUAL',
      dif_conteo_vs_teorico: 'Dif. conteo vs teórico',
      precio_ref_neto: 'Precio ref. neto $',
      pmp: 'PMP $',
      costo_valoracion: 'Costo unit. valoración $',
      valor_inventario: 'Valor inventario $',
      estado: 'ESTADO',
      dem_talleres_pend: 'Dem. talleres pend.',
      dem_puertas_pend: 'Dem. puertas pend.',
      compra_sugerida: 'COMPRA SUGERIDA',
      costo_est_compra: 'Costo est. compra $',
    },
    types: {
      stock_inicial: 'number',
      stock_minimo: 'number',
      ultimo_conteo: 'number',
      fecha_conteo: 'date',
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
    sheet: 'Catalogo',
    headerRow: 3,
    firstRow: 4,
    pk: 'sku',
    slotCols: ['SKU'],
    inputs: {
      id_articulo: 'SKU',
      sku: 'SKU',
      nombre_articulo: 'Descripción',
      descripcion: 'Descripción',
      stock: 'Último conteo físico',
      ultimo_conteo: 'Último conteo físico',
      stock_minimo: 'Stock mínimo',
      fecha_conteo: 'Fecha conteo',
    },
    computed: {
      stock_sistema: 'STOCK ACTUAL',
      stock_actual: 'STOCK ACTUAL',
      diferencia: 'Dif. conteo vs teórico',
      estado: 'ESTADO',
    },
    types: {
      stock: 'number',
      stock_minimo: 'number',
      ultimo_conteo: 'number',
    },
  },

  equivalencias: {
    sheet: 'Equivalencias',
    headerRow: 3,
    firstRow: 4,
    pk: 'sku_catalogo',
    slotCols: ['ID Conteo (INS)', 'SKU Catálogo'],
    inputs: {
      id_conteo_ins: 'ID Conteo (INS)',
      nombre_conteo: 'Nombre en Conteo Manual',
      sku_catalogo: 'SKU Catálogo',
      factor_desglose: 'Factor Desglose',
      estado_equivalencia: 'Estado Equivalencia',
      detalle: 'Detalle / Confirmación Requerida',
    },
    computed: {
      descripcion_catalogo: 'Descripción Catálogo',
      stock_fisico_asignado: 'Stock Físico Asignado',
      stock_sistema: 'Stock Sistema',
    },
    types: {
      factor_desglose: 'number',
    },
  },

  conciliacion: {
    sheet: 'Conciliacion',
    headerRow: 3,
    firstRow: 4,
    pk: 'sku',
    slotCols: ['SKU'],
    inputs: {
      sku: 'SKU',
      causa_probable: 'Causa Probable',
    },
    computed: {
      descripcion: 'Descripción',
      stock_fisico: 'Stock Físico',
      stock_sistema: 'Stock Sistema',
      diferencia: 'Diferencia',
      pct_diferencia: '% Diferencia',
      estado: 'Estado',
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

  insumos_instaladores: {
    sheet: 'InsumosInstaladores',
    headerRow: 1,
    firstRow: 2,
    pk: 'uid',
    slotCols: ['Lote ID', 'Código SKU'],
    inputs: {
      fecha: 'Fecha',
      lote_id: 'Lote ID',
      sku: 'Código SKU',
      codigo: 'Código SKU',
      insumo: 'Insumo [Auto]',
      check: 'Check',
      cantidad: 'Cantidad',
      taller: 'Taller',
      encargado_instalacion: 'Encargado Instalación',
      encargado_bodega: 'Encargado Bodega',
      mov_uid: 'mov_uid',
      uid: 'uid',
      updated_at: 'updated_at',
    },
    computed: {},
    types: {
      check: 'boolean',
      cantidad: 'number',
    },
  },
};

/* ========================================================================== *
 * SECCIÓN 2: CONTROL DE ACCESO BASADO EN ROLES (RBAC)
 * ========================================================================== */

const ROLE_PERMISSIONS = {
  admin: ['*'],
  compras: [
    'auth.me', 'config.get',
    'catalogo.list', 'catalogo.get', 'catalogo.create', 'catalogo.update', 'catalogo.nextSku', 'catalogo.kardex',
    'compras.list', 'compras.get', 'compras.create', 'compras.createBatch', 'compras.update', 'compras.clear', 'compras.importDte',
    'movimientos.list', 'seguimiento.list', 'equivalencias.list', 'conciliacion.get', 'dashboard.get', 'puertas.list', 'puertas.create', 'puertas.update',
    'instaladores.list', 'instaladores.create', 'instaladores.createBatch', 'instaladores.update', 'instaladores.clear',
  ],
  bodega: [
    'auth.me', 'config.get',
    'catalogo.list', 'catalogo.get', 'catalogo.kardex',
    'compras.list',
    'movimientos.list', 'movimientos.create', 'movimientos.createBatch', 'movimientos.entregarAPuerta',
    'prestamos.list', 'prestamos.create', 'prestamos.devolver',
    'seguimiento.list', 'seguimiento.upsert', 'equivalencias.list', 'equivalencias.confirmar',
    'conciliacion.get', 'dashboard.get', 'puertas.list',
    'instaladores.list', 'instaladores.create', 'instaladores.createBatch', 'instaladores.update', 'instaladores.clear',
  ],
  taller: [
    'auth.me', 'config.get', 'catalogo.list', 'movimientos.list', 'puertas.list', 'dashboard.get',
    'instaladores.list', 'instaladores.create', 'instaladores.createBatch',
  ],
  lectura: [
    'auth.me', 'config.get', 'catalogo.list', 'catalogo.get', 'catalogo.kardex',
    'compras.list', 'movimientos.list', 'prestamos.list', 'seguimiento.list',
    'equivalencias.list', 'conciliacion.get', 'dashboard.get', 'puertas.list',
    'instaladores.list',
  ],
};

const FORECAST_ROLE_PERMISSIONS = {
  compras: [
    'forecast.get', 'forecast.projection', 'forecast.alerts', 'forecast.plan',
    'forecast.observation.create', 'forecast.observation.approve',
    'forecast.learning.history', 'forecast.feedback.list', 'forecast.feedback.create',
    'forecast.history.list', 'forecast.params.get', 'forecast.config.list', 'forecast.config.update',
    'forecast.bom.list', 'forecast.bom.upsert', 'forecast.bom.delete', 'forecast.run',
  ],
  bodega: [
    'forecast.get', 'forecast.projection', 'forecast.alerts',
    'forecast.observation.create', 'forecast.params.get', 'forecast.config.list',
  ],
  lectura: [
    'forecast.get', 'forecast.projection', 'forecast.alerts', 'forecast.plan',
    'forecast.learning.history', 'forecast.feedback.list', 'forecast.history.list',
    'forecast.params.get', 'forecast.config.list', 'forecast.bom.list',
  ],
  taller: [],
};

/* ========================================================================== *
 * SECCIÓN 3: ROUTER HTTP (doGet / doPost) Y DESPACHO DE ACCIONES
 * ========================================================================== */

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'health';
    if (action === 'health') {
      return jsonResponse_({
        ok: true,
        data: {
          service: 'DICORMS Unified API (CRUD + ForecastService)',
          version: '3.0.0',
          forecast_model: FC.VERSION,
          timezone: SCRIPT_CONFIG.TIMEZONE,
          enforce_auth: PropertiesService.getScriptProperties().getProperty('ENFORCE_AUTH') === 'true',
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
  const routes = Object.assign(getRoutes_(), getForecastRoutes_());
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


/* ========================================================================== *
 * SECCIÓN 1.1: VALIDADORES Y REGLAS DE NEGOCIO v4 (R-31 A R-48)
 * ========================================================================== */

const TALLERES_VALIDOS = ['Santa Ana', 'Sonsonate', 'Taller Central', 'Instaladores', 'Bodega'];

function normalizarTaller_(taller) {
  if (!taller) return 'Santa Ana';
  const t = String(taller).trim();
  if (t === 'Taller 1' || t.toLowerCase() === 'taller 1') return 'Taller Central';
  if (t === 'Instalador' || t.toLowerCase() === 'instalador') return 'Instaladores';
  if (t === 'Bodega Central') return 'Bodega';
  return t;
}

function validarTallerCanonico_(taller) {
  const t = normalizarTaller_(taller);
  if (TALLERES_VALIDOS.indexOf(t) === -1 && t !== 'Sin asignar' && t !== 'Consolidado Multi-Taller') {
    throw appError_('VALIDATION', 'Taller inválido: "' + taller + '". Solo se permiten: ' + TALLERES_VALIDOS.join(', '));
  }
  return t;
}

function getRoutes_() {
  return {
    // --- NUEVAS RUTAS v4.1: COTIZACIONES, PRECIOS PROVEEDOR Y CALIDAD ---
    'cotizaciones.list': handleCotizacionesList_,
    'cotizaciones.get': handleCotizacionesGet_,
    'cotizaciones.fromAlerts': handleCotizacionesFromAlerts_,
    'cotizaciones.create': handleCotizacionesCreate_,
    'cotizaciones.update': handleCotizacionesUpdate_,
    'cotizaciones.setEstado': handleCotizacionesSetEstado_,
    'cotizaciones.createSheet': handleCotizacionesCreateSheet_,
    'precios.list': handlePreciosList_,
    'precios.upsert': handlePreciosUpsert_,
    'calidad.get': handleCalidadGet_,

    'auth.login': handleAuthLogin_,
    'auth.me': function(p, u) { return u; },
    'auth.updatePassword': handleAuthUpdatePassword_,
    'auth.cambiarPin': handleAuthUpdatePassword_,
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

    'instaladores.list': function(p) { return listEntity_('insumos_instaladores', p); },
    'instaladores.create': function(p, u, reqId) { return createRow_('insumos_instaladores', p, u, reqId); },
    'instaladores.createBatch': handleInstaladoresBatch_,
    'instaladores.update': function(p, u, reqId) { return updateRowByIndex_('insumos_instaladores', p.rowNumber, p.changes, u, reqId); },
    'instaladores.clear': function(p, u, reqId) { return clearRowByIndex_('insumos_instaladores', p.rowNumber, u, reqId); },
  };
}

/* ========================================================================== *
 * SECCIÓN 4: CAPA DE ACCESO A GOOGLE SHEETS Y OPERACIONES CRUD GENÉRICAS
 * ========================================================================== */

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
    const raw = String(headers[c] || '').trim();
    if (!raw) continue;
    map[raw] = c + 1;
    const lower = raw.toLowerCase();
    map[lower] = c + 1;
    const clean = lower.replace(/\s*\[.*?\]/g, '').trim();
    if (clean) map[clean] = c + 1;
  }
  return map;
}

function getColIdx_(cols, name) {
  if (!cols || !name) return undefined;
  if (cols[name] !== undefined) return cols[name];
  const lower = String(name).toLowerCase();
  if (cols[lower] !== undefined) return cols[lower];
  const clean = lower.replace(/\s*\[.*?\]/g, '').trim();
  if (cols[clean] !== undefined) return cols[clean];
  return undefined;
}

function firstFreeRow_(sh, def, cols) {
  const lastRow = sh.getLastRow();
  if (lastRow < def.firstRow) return def.firstRow;

  const numRows = lastRow - def.firstRow + 1;
  const maxCol = sh.getLastColumn();
  const data = sh.getRange(def.firstRow, 1, numRows, maxCol).getValues();
  const slotIndices = def.slotCols.map(function(sc) {
    const cIdx = getColIdx_(cols, sc);
    if (!cIdx) throw appError_('SCHEMA_MISMATCH', 'Falta columna clave ' + sc + ' en ' + def.sheet);
    return cIdx - 1;
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
    const colIdx = getColIdx_(cols, colName);
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
    const colIdx = getColIdx_(cols, colName);
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
    const colIdx = getColIdx_(cols, colName);
    if (colIdx) {
      const raw = values[colIdx - 1];
      if (raw instanceof Date) {
        obj[apiKey] = Utilities.formatDate(raw, SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd');
      } else if (def.types && def.types[apiKey] === 'boolean') {
        obj[apiKey] = Boolean(raw === true || String(raw).toLowerCase() === 'true');
      } else {
        obj[apiKey] = raw;
      }
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
      const cIdx = getColIdx_(cols, sc);
      if (!cIdx) return false;
      const idx = cIdx - 1;
      return rowArr[idx] !== '' && rowArr[idx] !== null && rowArr[idx] !== undefined;
    });
    if (!hasSlot) continue;

    const item = { _rowNumber: def.firstRow + i };
    Object.keys(allMappings).forEach(function(apiKey) {
      const colIdx = getColIdx_(cols, allMappings[apiKey]);
      if (colIdx) {
        const val = rowArr[colIdx - 1];
        if (val instanceof Date) {
          item[apiKey] = Utilities.formatDate(val, SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd');
        } else if (def.types && def.types[apiKey] === 'boolean') {
          item[apiKey] = Boolean(val === true || String(val).toLowerCase() === 'true');
        } else {
          item[apiKey] = val;
        }
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

/* ========================================================================== *
 * SECCIÓN 5: TRANSACCIONES DE NEGOCIO (CATÁLOGO, COMPRAS, KARDEX, DTE, ETC.)
 * ========================================================================== */

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

function handleInstaladoresBatch_(params, user, requestId) {
  const cabecera = params.cabecera || {};
  const lineas = params.lineas || [];
  if (!lineas.length) {
    throw appError_('VALIDATION', 'Debe enviar al menos una línea para InsumosInstaladores.');
  }

  // R-32: Rechazar si incluye equipos EQU-* (deben ir a Préstamos)
  lineas.forEach(function(lin) {
    const itemSku = lin.sku || lin.codigo;
    if (itemSku && itemSku.indexOf('EQU-') === 0) {
      throw appError_('VALIDATION', 'Los equipos y herramientas (EQU-*) deben registrarse en Préstamos, no en Insumos.');
    }
  });

  const loteId = 'LOT-' + Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyMMdd-HHmm') + '-' + Math.floor(Math.random() * 900 + 100);
  const fechaHoy = Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const tallerDestino = 'Instaladores';
  const instaladorNombre = cabecera.encargado_instalacion || cabecera.instalador || 'Instaladores';
  const bodegaNombre = cabecera.encargado_bodega || (user ? user.username : 'Bodega Central');

  const results = [];
  lineas.forEach(function(lin, idx) {
    const cant = Math.abs(Number(lin.cantidad || 0));
    const subReqId = requestId ? requestId + '_' + idx : null;
    const itemSku = lin.sku || lin.codigo || '';

    // 1. Descuento atómico en MOVIMIENTOSInsumosOperativo (R-32)
    let movUid = 'MOV-' + Utilities.getUuid().substring(0, 8);
    if (cant > 0 && itemSku && itemSku !== 'S/SKU') {
      const movPayload = {
        fecha: fechaHoy,
        tipo: 'Salida',
        sku: itemSku,
        cantidad: -cant,
        taller_destino: tallerDestino,
        entregado_a: instaladorNombre,
        observaciones: 'Despacho instalador lote ' + loteId + (lin.insumo ? ' | ' + lin.insumo : ''),
        ref_tipo: 'INSTALADOR',
        ref_id: loteId,
        lote_id: loteId,
        uid: movUid,
        updated_at: Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
      };
      createRow_('movimientos', movPayload, user, subReqId ? subReqId + '_mov' : null);
    }

    // 2. Registro persistente en InsumosInstaladores
    const payload = {
      fecha: fechaHoy,
      lote_id: loteId,
      sku: itemSku,
      codigo: itemSku,
      insumo: lin.insumo || lin.descripcion || itemSku,
      check: lin.check === true || lin.check === 'SI' || lin.check === 'true' ? 'SI' : 'NO',
      cantidad: cant,
      taller: tallerDestino,
      encargado_instalacion: instaladorNombre,
      encargado_bodega: bodegaNombre,
      mov_uid: movUid,
      uid: 'INS-' + Utilities.getUuid().substring(0, 8),
      updated_at: Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
    };
    results.push(createRow_('insumos_instaladores', payload, user, subReqId));
  });

  return { count: results.length, lote_id: loteId, items: results };
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

  // R-32 & R-43 (SDD-009): Bloqueo estricto de nuevos préstamos a quienes tienen herramientas vencidas
  const persona = String(payload.persona || '').trim().toLowerCase();
  if (persona) {
    const todosPrestamos = listEntity_('prestamos', { pageSize: 500 }).rows;
    const tieneVencidos = todosPrestamos.some(function(p) {
      const pPersona = String(p.persona || '').trim().toLowerCase();
      const cantPend = (Number(p.cant_prestada) || 0) - (Number(p.cant_devuelta) || 0);
      const estado = String(p.estado || '').toUpperCase();
      return pPersona === persona && cantPend > 0 && (estado === 'VENCIDO' || estado === 'MORA' || estado.indexOf('VENCID') !== -1);
    });

    if (tieneVencidos && !payload.autorizacion_gerencia) {
      throw appError_('FORBIDDEN', 'R-32: ' + payload.persona + ' tiene herramientas con plazo vencido pendientes de devolución (PR-*). Nuevos préstamos bloqueados hasta finiquitar saldo o autorización expresa de Gerencia.');
    }
  }

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
  if (!params.id_articulo && !params.sku) {
    throw appError_('VALIDATION', 'Debe especificar SKU o id_articulo.');
  }
  const identifier = String(params.sku || params.id_articulo).trim();
  
  // Buscar si coincide directamente con SKU en Catalogo
  let catItem = null;
  try { catItem = getByPk_('catalogo', identifier); } catch (e) {}

  if (!catItem) {
    // Buscar si es un ID de conteo manual (INS-xxx) en Equivalencias
    const equivs = listEntity_('equivalencias', { pageSize: 500 }).rows;
    const eqMatch = equivs.find(function(eq) {
      return String(eq.id_conteo_ins || '').trim().toUpperCase() === identifier.toUpperCase();
    });
    if (eqMatch && eqMatch.sku_catalogo) {
      try { catItem = getByPk_('catalogo', eqMatch.sku_catalogo); } catch (e) {}
    }
  }

  const stockVal = Number(params.stock !== undefined ? params.stock : params.ultimo_conteo);
  const fechaVal = params.fecha_conteo || params.fecha || Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd');

  if (catItem) {
    return updateByPk_('catalogo', catItem.sku, {
      ultimo_conteo: stockVal,
      fecha_conteo: fechaVal,
    }, user, requestId);
  }

  throw appError_('NOT_FOUND', 'No se encontró artículo o equivalencia para: ' + identifier);
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
    total: all.length,
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
  if (params && params.estado && String(params.estado).toUpperCase() !== 'TODOS') {
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
    resumen: summary,
    rows: rows,
    items: rows,
  };
}

function handleDashboardGet_(params, user) {
  const sh = getSheet_('Inicio');
  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);

  try {
    let dirty = false;
    if (params && params.clave_mes) {
      let cm = params.clave_mes;
      if (typeof cm === 'string' && cm.includes('-')) {
        cm = Number(cm.replace(/-/g, ''));
      } else {
        cm = Number(cm) || cm;
      }
      sh.getRange('B3').setValue(cm);
      dirty = true;
    }
    if (params && params.taller) { sh.getRange('D3').setValue(String(params.taller)); dirty = true; }
    if (params && params.lunes_semana) { sh.getRange('F3').setValue(coerceValue_(params.lunes_semana, 'date')); dirty = true; }
    if (params && params.tolerancia !== undefined) { sh.getRange('H3').setValue(Number(params.tolerancia)); dirty = true; }
    if (dirty) SpreadsheetApp.flush();

    const vals = sh.getRange('A1:N51').getValues();

    // Fila 7 en Excel (vals[6] en 0-indexed JS) contiene los VALORES numéricos reales de los KPIs
    const kpis = {
      clave_mes: vals[2][1],
      filtro_taller: vals[2][3],
      tolerancia_conciliacion: vals[2][7],
      articulos_a_comprar: Number(vals[6][0] || 0),
      articulos_agotados: Number(vals[6][2] || 0),
      valor_inventario: Number(vals[6][4] || 0),
      gasto_del_mes: Number(vals[6][6] || 0),
      conciliacion_resumen: String(vals[5][8] || ''),
      unidades_consumidas_mes: Number(vals[6][8] || 0),
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
    for (let r = 19; r <= 23; r++) {
      if (!vals[r][0] || String(vals[r][0]).indexOf('TOTAL') !== -1) continue;
      consumoPorTaller.push({
        taller: vals[r][0],
        eventos_salida: Number(vals[r][1] || 0),
        unidades_consumidas: Number(vals[r][2] || 0),
        pct_consumo: Number(vals[r][3] || 0),
        gasto_compras: Number(vals[r][4] || 0),
      });
    }

    // Top 10 Insumos calculado dinámicamente de movimientos del mes (elimina bug de nombres de hojas como SKUs)
    const allMovs = listEntity_('movimientos', { pageSize: 5000 }).rows;
    const allCat = listEntity_('catalogo', { pageSize: 500 }).rows;
    const catBySku = {};
    allCat.forEach(function(c) { if (c.sku) catBySku[c.sku] = c; });

    const skuSalidas = {};
    const targetClaveMes = params && params.clave_mes ? Number(String(params.clave_mes).replace(/-/g, '')) : null;
    allMovs.forEach(function(m) {
      if (String(m.tipo || '').toLowerCase().indexOf('salida') === -1) return;
      if (targetClaveMes && m.clave_mes && Number(m.clave_mes) !== targetClaveMes) return;
      const s = String(m.sku || '').trim();
      if (!s) return;
      skuSalidas[s] = (skuSalidas[s] || 0) + Math.abs(Number(m.cantidad || 0));
    });

    const sortedSkus = Object.keys(skuSalidas).sort(function(a, b) {
      return skuSalidas[b] - skuSalidas[a];
    }).slice(0, 10);

    const top10Insumos = sortedSkus.map(function(sku, idx) {
      const cat = catBySku[sku] || {};
      const totalCons = skuSalidas[sku] || 0;
      const promSem = Number((totalCons / 4).toFixed(1));
      const stockAct = Number(cat.stock_actual ?? 0);
      const cobSem = promSem > 0 ? Number((stockAct / promSem).toFixed(1)) : (stockAct > 0 ? 99 : 0);
      let alertaCob = 'NORMAL';
      if (stockAct <= 0) alertaCob = 'AGOTADO';
      else if (cobSem < 2) alertaCob = 'CRITICO';

      return {
        rank: idx + 1,
        sku: sku,
        descripcion: cat.descripcion || 'Insumo Operativo',
        total_consumido: totalCons,
        prom_semanal: promSem,
        stock_actual: stockAct,
        cobertura_semanas: cobSem,
        alerta_cobertura: alertaCob,
      };
    });

    // Filas 29 a 36 en Excel (vals[28] a vals[35] en JS) contienen las 8 alertas de calidad del sistema
    const alertas = [];
    for (let r = 28; r <= 35; r++) {
      if (vals[r][0]) {
        alertas.push({
          control: vals[r][0],
          hoja_origen: vals[r][1],
          cantidad_casos: Number(vals[r][2] || 0),
          meta: Number(vals[r][3] || 0),
          severidad: vals[r][4],
          accion_recomendada: vals[r][5],
        });
      }
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


/* ========================================================================== *
 * SECCIÓN 5.1: MÓDULO DE COTIZACIONES, PRECIOS PROVEEDOR Y CALIDAD (v4.1.0.0)
 * ========================================================================== */

function handleCotizacionesList_(params) {
  const cabeceras = listEntity_('cotizaciones_cabecera', { pageSize: 500 }).rows;
  const detalles = listEntity_('cotizaciones_detalle', { pageSize: 2000 }).rows;

  let filtered = cabeceras;
  if (params.estado && params.estado !== 'TODOS') {
    filtered = filtered.filter(function(c) { return c.estado === params.estado; });
  }
  if (params.proveedor && params.proveedor !== 'TODOS') {
    filtered = filtered.filter(function(c) {
      return String(c.proveedor || '').toLowerCase().indexOf(String(params.proveedor).toLowerCase()) !== -1;
    });
  }

  // Enlazar líneas a cada cabecera
  const result = filtered.map(function(cab) {
    let cleanCotId = String(cab.cotizacion_id || '').trim();
    if (cleanCotId === '[object Object]' || !cleanCotId) {
      cleanCotId = String(cab.uid || ('COT-26-' + ('000' + cab._rowNumber).slice(-3)));
    }

    const incIvaCab = cab.precios_incluyen_iva === true || String(cab.precios_incluyen_iva).toUpperCase() === 'SI';

    const lines = detalles.filter(function(d) {
      const dCotId = String(d.cotizacion_id || '').trim();
      return dCotId === cleanCotId || dCotId === String(cab.cotizacion_id || '').trim();
    }).map(function(d) {
      const isInc = d.incluir === true || String(d.incluir).toUpperCase() === 'SI' || String(d.incluir).toUpperCase() === 'TRUE';
      const cant = Number(d.cantidad || 0);
      const pu = Number(d.precio_unitario || 0);
      let subNet = Number(d.subtotal_neto || 0);
      let iva = Number(d.iva_13 || 0);
      let tot = Number(d.total_linea || 0);

      // Si las fórmulas de Google Sheets estaban vacías o 0, calcular dinámicamente
      if (cant > 0 && pu > 0 && tot === 0) {
        if (incIvaCab) {
          tot = Number((cant * pu).toFixed(2));
          subNet = Number((tot / 1.13).toFixed(2));
          iva = Number((tot - subNet).toFixed(2));
        } else {
          subNet = Number((cant * pu).toFixed(2));
          iva = Number((subNet * 0.13).toFixed(2));
          tot = Number((subNet + iva).toFixed(2));
        }
      }

      return {
        incluir: isInc,
        tipo_item: d.tipo_item || 'INSUMO',
        sku: d.sku,
        codigo_proveedor: d.codigo_proveedor || '',
        descripcion: d.descripcion || '',
        unidad: d.unidad || 'unidad',
        cantidad: cant,
        precio_unitario: pu,
        incluye_iva: d.incluye_iva === true || String(d.incluye_iva).toUpperCase() === 'SI' || incIvaCab,
        subtotal_neto: subNet,
        iva_13: iva,
        total_linea: tot,
        taller_linea: d.taller_linea || cab.taller_destino,
      };
    });

    let calcItemsMarcados = 0;
    let calcSubtotalNeto = 0;
    let calcIva = 0;
    let calcTotal = 0;

    lines.forEach(function(l) {
      if (l.incluir) {
        calcItemsMarcados += 1;
        calcSubtotalNeto += (l.subtotal_neto || 0);
        calcIva += (l.iva_13 || 0);
        calcTotal += (l.total_linea || 0);
      }
    });

    const finalItemsMarcados = lines.length > 0 ? calcItemsMarcados : Number(cab.items_marcados || 0);
    const finalSubtotal = lines.length > 0 ? Number(calcSubtotalNeto.toFixed(2)) : Number(cab.subtotal_neto || 0);
    const finalIva = lines.length > 0 ? Number(calcIva.toFixed(2)) : Number(cab.iva_13 || 0);
    const finalTotal = lines.length > 0 ? Number(calcTotal.toFixed(2)) : Number(cab.total || 0);

    return Object.assign({}, cab, {
      cotizacion_id: cleanCotId,
      precios_incluyen_iva: incIvaCab,
      items_marcados: finalItemsMarcados,
      subtotal_neto: finalSubtotal,
      iva_13: finalIva,
      total: finalTotal,
      lineas: lines,
    });
  });

  return { rows: result, total: result.length };
}

function handleCotizacionesGet_(params) {
  if (!params.cot_id) throw appError_('VALIDATION', 'Debe indicar cot_id');
  const res = handleCotizacionesList_({ pageSize: 500 });
  const found = res.rows.find(function(c) { return c.cotizacion_id === params.cot_id; });
  if (!found) throw appError_('NOT_FOUND', 'Cotización no encontrada: ' + params.cot_id);
  return found;
}

function handleCotizacionesFromAlerts_(params) {
  const alertsRes = getStockoutAlerts_({ niveles: ['ROJO', 'NARANJA'], incluirGris: false });
  const criticos = alertsRes.alertas || [];
  const precios = listEntity_('precios_proveedor', { pageSize: 500 }).rows;

  const proveedorPref = params.proveedor || 'Freund';
  const lineas = criticos.map(function(c) {
    const matchPrecio = precios.find(function(p) {
      return p.sku === c.sku && p.proveedor === proveedorPref;
    }) || precios.find(function(p) { return p.sku === c.sku; });

    let tipo = 'INSUMO';
    if (c.sku.indexOf('MET') === 0 || c.sku.indexOf('VID') === 0 || c.sku.indexOf('LIV') === 0) {
      tipo = 'MATERIAL';
    } else if (c.sku.indexOf('EQU') === 0) {
      tipo = 'EQUIPO';
    }

    const factor = SCRIPT_CONFIG.FACTOR_PEDIDO || 1.9;
    const sugerido = Math.max(1, Math.ceil((Number(c.stock_minimo) || 5) * factor - (Number(c.stock_actual) || 0)));

    return {
      incluir: true,
      tipo_item: tipo,
      sku: c.sku,
      codigo_proveedor: matchPrecio ? matchPrecio.codigo_proveedor : '',
      descripcion: c.descripcion || '',
      unidad: c.unidad || 'unidad',
      cantidad: sugerido,
      precio_unitario: matchPrecio ? Number(matchPrecio.ultimo_precio || 0) : Number(c.pmp || 0),
      incluye_iva: matchPrecio ? (matchPrecio.incluye_iva === 'SI' || matchPrecio.incluye_iva === true) : false,
      taller_linea: 'Sonsonate',
    };
  });

  return {
    proveedor: proveedorPref,
    lineas: lineas,
    total_items: lineas.length,
  };
}

function handleCotizacionesCreate_(params, user, requestId) {
  const cabecera = params.cabecera || {};
  const lineas = params.lineas || [];

  if (!cabecera.proveedor) throw appError_('VALIDATION', 'Proveedor es requerido.');
  cabecera.taller_destino = validarTallerCanonico_(cabecera.taller_destino || 'Santa Ana');

  const yearSuffix = Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yy');
  const nextNum = nextCorrelative_('COT_' + yearSuffix, 'COT-' + yearSuffix, 3);
  const cot_id = (typeof nextNum === 'object' && nextNum.formatted) ? nextNum.formatted : String(nextNum);

  // Insertar cabecera
  const cabPayload = {
    cotizacion_id: cot_id,
    fecha: cabecera.fecha || Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd'),
    proveedor: cabecera.proveedor,
    taller_destino: cabecera.taller_destino,
    estado: cabecera.estado || 'BORRADOR',
    notas: cabecera.notas || '',
    uid: 'COT-' + Utilities.getUuid().substring(0, 8),
    updated_at: Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
  };
  createRow_('cotizaciones_cabecera', cabPayload, user, requestId);

  // Insertar líneas con batch
  lineas.forEach(function(lin, idx) {
    const detPayload = {
      cotizacion_id: cot_id,
      incluir: lin.incluir ? 'SI' : 'NO',
      tipo_item: lin.tipo_item || 'INSUMO',
      sku: lin.sku,
      codigo_proveedor: lin.codigo_proveedor || '',
      descripcion: lin.descripcion || '',
      unidad: lin.unidad || 'unidad',
      cantidad: Number(lin.cantidad || 0),
      precio_unitario: Number(lin.precio_unitario || 0),
      taller_linea: lin.taller_linea || cabecera.taller_destino,
    };
    createRow_('cotizaciones_detalle', detPayload, user, requestId ? requestId + '_' + idx : null);

    // Actualizar historial de precios si se especificó precio
    if (lin.incluir && Number(lin.precio_unitario || 0) > 0) {
      handlePreciosUpsert_({
        sku: lin.sku,
        proveedor: cabecera.proveedor,
        codigo_proveedor: lin.codigo_proveedor || '',
        descripcion: lin.descripcion || '',
        ultimo_precio: Number(lin.precio_unitario || 0),
        incluye_iva: cabecera.precios_incluyen_iva ? 'SI' : 'NO',
        ref: cot_id,
      }, user);
    }
  });

  return { ok: true, cotizacion_id: cot_id, lineas_creadas: lineas.length };
}

function handleCotizacionesUpdate_(params, user, requestId) {
  if (!params.cot_id) throw appError_('VALIDATION', 'Debe indicar cot_id a actualizar.');
  const cot_id = String(params.cot_id).trim();
  const changes = params.changes || {};

  const cabeceras = listEntity_('cotizaciones_cabecera', { pageSize: 500 }).rows;
  const cab = cabeceras.find(function(c) { return String(c.cotizacion_id).trim() === cot_id; });
  if (!cab) throw appError_('NOT_FOUND', 'Cotización no encontrada: ' + cot_id);

  if (changes.taller_destino) changes.taller_destino = validarTallerCanonico_(changes.taller_destino);
  changes.updated_at = Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

  // Si vienen líneas en changes, sincronizarlas en Cotizaciones_Detalle
  if (Array.isArray(changes.lineas)) {
    const lineas = changes.lineas;
    const defDet = SCHEMA.cotizaciones_detalle;
    const shDet = getSheet_(defDet.sheet);
    const lastRow = shDet.getLastRow();

    if (lastRow >= defDet.firstRow) {
      const colsDet = headerMap_(shDet, defDet.headerRow);
      const colCotIdIdx = getColIdx_(colsDet, 'Cotización ID');
      const cotValues = shDet.getRange(defDet.firstRow, colCotIdIdx, lastRow - defDet.firstRow + 1, 1).getValues();

      // Borrar filas existentes de esta cotización de abajo hacia arriba para mantener índices
      for (let r = cotValues.length - 1; r >= 0; r--) {
        const val = String(cotValues[r][0] || '').trim();
        if (val === cot_id) {
          shDet.deleteRow(defDet.firstRow + r);
        }
      }
      SpreadsheetApp.flush();
    }

    // Insertar las nuevas líneas
    const proveedorActual = changes.proveedor || cab.proveedor;
    const tallerActual = changes.taller_destino || cab.taller_destino;
    const incIvaActual = changes.precios_incluyen_iva !== undefined ? Boolean(changes.precios_incluyen_iva) : Boolean(cab.precios_incluyen_iva);

    lineas.forEach(function(lin, idx) {
      const detPayload = {
        cotizacion_id: cot_id,
        incluir: lin.incluir ? 'SI' : 'NO',
        tipo_item: lin.tipo_item || 'INSUMO',
        sku: lin.sku,
        codigo_proveedor: lin.codigo_proveedor || '',
        descripcion: lin.descripcion || '',
        unidad: lin.unidad || 'unidad',
        cantidad: Number(lin.cantidad || 0),
        precio_unitario: Number(lin.precio_unitario || 0),
        taller_linea: lin.taller_linea || tallerActual,
      };
      createRow_('cotizaciones_detalle', detPayload, user, requestId ? requestId + '_u' + idx : null);

      if (lin.incluir && Number(lin.precio_unitario || 0) > 0) {
        handlePreciosUpsert_({
          sku: lin.sku,
          proveedor: proveedorActual,
          codigo_proveedor: lin.codigo_proveedor || '',
          descripcion: lin.descripcion || '',
          ultimo_precio: Number(lin.precio_unitario || 0),
          incluye_iva: incIvaActual ? 'SI' : 'NO',
          ref: cot_id,
        }, user);
      }
    });

    delete changes.lineas;
  }

  updateRowByIndex_('cotizaciones_cabecera', cab._rowNumber, changes, user, requestId);
  SpreadsheetApp.flush();
  return { ok: true, cotizacion_id: cot_id };
}

function handleCotizacionesSetEstado_(params, user, requestId) {
  if (!params.cot_id || !params.estado) throw appError_('VALIDATION', 'Debe indicar cot_id y estado.');
  return handleCotizacionesUpdate_({ cot_id: params.cot_id, changes: { estado: params.estado } }, user, requestId);
}

function handleCotizacionesCreateSheet_(params) {
  const cot = handleCotizacionesGet_(params);
  const ss = getSpreadsheet_();
  const plantilla = ss.getSheetByName('Plantilla_Cotizacion');
  if (!plantilla) throw appError_('SHEET_NOT_FOUND', 'No se encontró la hoja Plantilla_Cotizacion');

  const sheetName = cot.cotizacion_id;
  let targetSh = ss.getSheetByName(sheetName);
  if (targetSh) {
    return { ok: true, message: 'La hoja ' + sheetName + ' ya existe en el libro.', sheetName: sheetName };
  }

  targetSh = plantilla.copyTo(ss).setName(sheetName);
  targetSh.showSheet();

  // Rellenar cabecera en Plantilla
  targetSh.getRange('C4').setValue(cot.cotizacion_id);
  targetSh.getRange('H4').setValue(cot.fecha);
  targetSh.getRange('C5').setValue(cot.proveedor);
  targetSh.getRange('H5').setValue(cot.precios_incluyen_iva ? 'SI' : 'NO');
  targetSh.getRange('C6').setValue(cot.taller_destino);

  // Escribir solo líneas marcadas en la tabla (A9 hacia abajo)
  const marcadas = (cot.lineas || []).filter(function(l) { return l.incluir; });
  if (marcadas.length > 0) {
    const dataMatrix = marcadas.map(function(l) {
      return [
        'SI',
        l.tipo_item || 'INSUMO',
        l.sku,
        l.codigo_proveedor || '',
        l.descripcion,
        l.unidad,
        Number(l.cantidad || 0),
        Number(l.precio_unitario || 0),
        Number(l.cantidad || 0) * Number(l.precio_unitario || 0),
      ];
    });
    targetSh.getRange(9, 1, dataMatrix.length, 9).setValues(dataMatrix);
  }

  return { ok: true, message: 'Hoja ' + sheetName + ' creada exitosamente desde plantilla.', sheetName: sheetName };
}

function handlePreciosList_(params) {
  let list = listEntity_('precios_proveedor', { pageSize: 500 }).rows;
  if (params.sku) {
    list = list.filter(function(p) { return String(p.sku || '').toUpperCase() === String(params.sku).toUpperCase(); });
  }
  if (params.proveedor) {
    list = list.filter(function(p) {
      return String(p.proveedor || '').toLowerCase().indexOf(String(params.proveedor).toLowerCase()) !== -1;
    });
  }
  return { rows: list, total: list.length };
}

function handlePreciosUpsert_(payload, user) {
  if (!payload.sku || !payload.proveedor) {
    throw appError_('VALIDATION', 'Debe indicar sku y proveedor para precios.');
  }
  const all = listEntity_('precios_proveedor', { pageSize: 500 }).rows;
  const match = all.find(function(p) {
    return String(p.sku).toUpperCase() === String(payload.sku).toUpperCase() &&
           String(p.proveedor).toLowerCase() === String(payload.proveedor).toLowerCase();
  });

  const entry = {
    sku: payload.sku,
    proveedor: payload.proveedor,
    codigo_proveedor: payload.codigo_proveedor || '',
    descripcion: payload.descripcion || '',
    ultimo_precio: Number(payload.ultimo_precio || 0),
    incluye_iva: payload.incluye_iva === true || payload.incluye_iva === 'SI' ? 'SI' : 'NO',
    fecha: payload.fecha || Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd'),
    ref: payload.ref || 'Cotización',
  };

  if (match) {
    return updateRowByIndex_('precios_proveedor', match._rowNumber, entry, user);
  }
  entry.uid = 'PRP-' + Utilities.getUuid().substring(0, 8);
  return createRow_('precios_proveedor', entry, user);
}

function handleCalidadGet_() {
  const cat = listEntity_('catalogo', { pageSize: 500 }).rows;
  const com = listEntity_('compras', { pageSize: 500 }).rows;
  const mov = listEntity_('movimientos', { pageSize: 500 }).rows;
  const pta = listEntity_('agenda_puertas', { pageSize: 500 }).rows;

  const c1 = com.filter(function(c) { return !c.proveedor || c.proveedor === 'Por asignar' || c.proveedor === 'Pendiente'; });
  const c2 = com.filter(function(c) { return !c.precio_unit_pagado || Number(c.precio_unit_pagado) <= 0; });
  const c3 = com.filter(function(c) { return String(c.tipo_dte || '').toLowerCase().indexOf('pendiente') !== -1; });
  const c4 = cat.filter(function(k) { return k.stock_minimo === undefined || k.stock_minimo === '' || Number(k.stock_minimo) <= 0; });
  const c5 = cat.filter(function(k) { return !k.proveedor_pref || k.proveedor_pref === 'Por asignar'; });
  const c6 = cat.filter(function(k) { return Number(k.stock_actual || 0) < 0; });
  const c7 = mov.filter(function(m) { return !m.taller_destino || m.taller_destino === 'Sin asignar' || m.taller_destino === 'Taller 1'; });
  const c8 = pta.filter(function(p) { return !p.taller || p.taller === 'Sin asignar'; });

  const totalErrores = c1.length + c2.length + c3.length + c4.length + c5.length + c6.length + c7.length + c8.length;
  const score = Math.max(0, 100 - totalErrores * 2);

  return {
    score_salud: score,
    total_errores: totalErrores,
    controles: [
      { id: 'c1', titulo: '1. Compras sin Proveedor', count: c1.length, severidad: 'ALTA', items: c1.slice(0, 5) },
      { id: 'c2', titulo: '2. Compras sin Precio Unitario Pagado (>0)', count: c2.length, severidad: 'ALTA', items: c2.slice(0, 5) },
      { id: 'c3', titulo: '3. Compras con DTE Pendiente', count: c3.length, severidad: 'MEDIA', items: c3.slice(0, 5) },
      { id: 'c4', titulo: '4. SKUs sin Stock Mínimo Definido', count: c4.length, severidad: 'MEDIA', items: c4.slice(0, 5) },
      { id: 'c5', titulo: '5. SKUs sin Proveedor Preferido', count: c5.length, severidad: 'BAJA', items: c5.slice(0, 5) },
      { id: 'c6', titulo: '6. SKUs con Stock Negativo (<0)', count: c6.length, severidad: 'CRITICA', items: c6.slice(0, 5) },
      { id: 'c7', titulo: '7. Movimientos sin Taller Canónico', count: c7.length, severidad: 'MEDIA', items: c7.slice(0, 5) },
      { id: 'c8', titulo: '8. Puertas sin Taller Asignado', count: c8.length, severidad: 'MEDIA', items: c8.slice(0, 5) },
    ]
  };
}

function setupV4() {
  const ss = getSpreadsheet_();
  // Validar hojas v4
  const expectedSheets = [
    'Inicio', 'Resumen', 'Catalogo', 'Precios_Proveedor', 'Cotizaciones_Cabecera',
    'Cotizaciones_Detalle', 'Plantilla_Cotizacion', 'Compras', 'MOVIMIENTOSInsumosOperativo',
    'InsumosInstaladores', 'AgendaDePuertas', 'BOM_Puertas', 'PrestamosEquipos',
    'Conciliacion', 'Equivalencias', 'GASTO_MES', 'Config'
  ];
  const missing = [];
  expectedSheets.forEach(function(shName) {
    if (!ss.getSheetByName(shName)) missing.push(shName);
  });
  if (missing.length > 0) {
    Logger.log('AVISO: Faltan hojas en el libro: ' + missing.join(', '));
  } else {
    Logger.log('¡Todas las 17 hojas maestras de DECORM_GROUP_v4 existen!');
  }
  fcSetup_();
  return { ok: true, version: '4.1.0.0', missing_sheets: missing };
}


/* ========================================================================== *
 * SECCIÓN 6: SEGURIDAD, AUDITORÍA, CORRELATIVOS Y UTILIDADES DEL CRUD
 * ========================================================================== */

/**
 * Ejecutar una vez desde el editor de Apps Script para exigir token en producción.
 */
function activarAutenticacionEstricta() {
  PropertiesService.getScriptProperties().setProperty('ENFORCE_AUTH', 'true');
  return 'ENFORCE_AUTH establecido en true. Todas las rutas (excepto auth.login y health) requieren token.';
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
    shUsers.appendRow(['username', 'nombre', 'rol', 'salt', 'pin_sha256', 'taller', 'activo', 'intentos_fallidos', 'bloqueado_hasta']);
    shUsers.appendRow(['cristian', 'Cristian Cajul', 'admin', 'salt_cris_v4', sha256_('123456'), 'Todos', true, 0, '']);
    shUsers.appendRow(['emma', 'Enmanuel Sanches', 'admin', 'salt_emma_v4', sha256_('123456'), 'Todos', true, 0, '']);
  }

  const rows = shUsers.getDataRange().getValues();
  if (rows.length < 2) {
    throw appError_('AUTH', 'No hay registros en la tabla de usuarios (_USERS).');
  }

  // Detección dinámica y robusta de encabezados
  const headers = rows[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  const colUser = headers.indexOf('username') !== -1 ? headers.indexOf('username') : 0;
  const colNombre = headers.indexOf('nombre') !== -1 ? headers.indexOf('nombre') : 1;
  const colRol = headers.indexOf('rol') !== -1 ? headers.indexOf('rol') : 2;
  const colSalt = headers.indexOf('salt');
  const colPin = headers.indexOf('pin_sha256') !== -1 ? headers.indexOf('pin_sha256') : (colSalt !== -1 ? 4 : 3);
  const colTaller = headers.indexOf('taller') !== -1 ? headers.indexOf('taller') : (colSalt !== -1 ? 5 : 4);
  const colActivo = headers.indexOf('activo') !== -1 ? headers.indexOf('activo') : (colSalt !== -1 ? 6 : 5);
  const colIntentos = headers.indexOf('intentos_fallidos');
  const colBloqueado = headers.indexOf('bloqueado_hasta');

  const now = Date.now();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const uName = String(r[colUser] || '').trim().toLowerCase();
    if (uName === username.toLowerCase()) {
      // 1. Verificación de usuario activo
      const isActivo = colActivo !== -1 
        ? (r[colActivo] === true || String(r[colActivo]).toUpperCase() === 'TRUE' || r[colActivo] === 1) 
        : true;
      if (!isActivo) {
        throw appError_('AUTH', 'Usuario inactivo. Contacte al administrador Cristian Cajul.');
      }

      // 2. Verificación de bloqueo temporal (R-47: 5 intentos fallidos -> bloqueo 15 min)
      if (colBloqueado !== -1 && r[colBloqueado]) {
        const blkDate = new Date(r[colBloqueado]).getTime();
        if (!isNaN(blkDate) && blkDate > now) {
          const mins = Math.ceil((blkDate - now) / 60000);
          throw appError_('AUTH', 'Cuenta bloqueada temporalmente por intentos fallidos. Intente de nuevo en ' + mins + ' min.');
        }
      }

      // 3. Verificación de PIN / Contraseña (Soporta sha256 Base64, sha256 Hex, salt+pin, pin+salt o texto plano)
      const storedHash = String(r[colPin] || '').trim();
      const userSalt = colSalt !== -1 ? String(r[colSalt] || '').trim() : '';

      const hashPlainB64 = sha256_(pin);
      const hashSaltPrefB64 = userSalt ? sha256_(userSalt + pin) : '';
      const hashSaltSuffB64 = userSalt ? sha256_(pin + userSalt) : '';

      // Cálculo de Hex SHA-256 para máxima compatibilidad
      const digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pin, Utilities.Charset.UTF_8);
      let hashPlainHex = '';
      for (let b = 0; b < digestBytes.length; b++) {
        const byteVal = (digestBytes[b] < 0) ? digestBytes[b] + 256 : digestBytes[b];
        const hexByte = byteVal.toString(16);
        hashPlainHex += (hexByte.length === 1 ? '0' : '') + hexByte;
      }

      const match = (storedHash === hashPlainB64) ||
                    (storedHash.toLowerCase() === hashPlainHex.toLowerCase()) ||
                    (userSalt && storedHash === hashSaltPrefB64) ||
                    (userSalt && storedHash === hashSaltSuffB64) ||
                    (storedHash === pin);

      if (match) {
        // Reset de intentos fallidos
        if (colIntentos !== -1 && (Number(r[colIntentos]) > 0 || r[colBloqueado])) {
          try {
            shUsers.getRange(i + 1, colIntentos + 1).setValue(0);
            if (colBloqueado !== -1) shUsers.getRange(i + 1, colBloqueado + 1).setValue('');
          } catch(e) {}
        }

        const userPayload = {
          username: r[colUser],
          nombre: r[colNombre] || r[colUser],
          role: r[colRol] || 'lectura',
          taller: (colTaller !== -1 ? r[colTaller] : 'Todos') || 'Todos',
          exp: now + SCRIPT_CONFIG.TOKEN_TTL_MS,
        };

        logAudit_(userPayload, 'LOGIN_SUCCESS', '_USERS', r[colUser], null, { at: new Date() });

        return {
          token: signToken_(userPayload),
          user: userPayload,
        };
      } else {
        // Incremento de intentos fallidos
        if (colIntentos !== -1) {
          const fallidos = (Number(r[colIntentos]) || 0) + 1;
          try {
            shUsers.getRange(i + 1, colIntentos + 1).setValue(fallidos);
            if (fallidos >= 5 && colBloqueado !== -1) {
              const lockUntil = new Date(now + 15 * 60 * 1000);
              shUsers.getRange(i + 1, colBloqueado + 1).setValue(lockUntil);
              throw appError_('AUTH', 'Ha superado el límite de 5 intentos. Su cuenta ha sido bloqueada por 15 minutos.');
            }
          } catch(e) {
            if (e.message && e.message.indexOf('Ha superado') !== -1) throw e;
          }
        }
        throw appError_('AUTH', 'PIN de acceso incorrecto para ' + username + '.');
      }
    }
  }
  throw appError_('AUTH', 'Usuario "' + username + '" no existe en el sistema.');
}

/**
 * R-47: Actualización de Contraseñas / PINs
 * RESTRICCIÓN DE SEGURIDAD ESTRICTA:
 * ÚNICAMENTE Cristian Cajul tiene autorización para actualizar o restablecer contraseñas en el sistema.
 */
function handleAuthUpdatePassword_(params, user) {
  const reqUser = String((user && user.username) || '').toLowerCase();
  const reqRole = String((user && user.role) || '').toLowerCase();
  const esCristian = reqUser === 'cristian' || reqUser === 'cristian cajul' || (reqRole === 'admin' && reqUser.indexOf('cris') !== -1);

  if (!esCristian) {
    throw appError_('FORBIDDEN', 'Operación denegada: ÚNICAMENTE Cristian Cajul tiene permisos para modificar o resetear contraseñas en DICORMS.');
  }

  const targetUser = String((params && params.target_username) || (params && params.username) || '').trim();
  const newPin = String((params && params.new_pin) || (params && params.pin) || '').trim();

  if (!targetUser) throw appError_('VALIDATION', 'Debe especificar el usuario a actualizar.');
  if (!newPin || newPin.length < 4) throw appError_('VALIDATION', 'El nuevo PIN debe contener al menos 4 caracteres.');

  const ss = getSpreadsheet_();
  const shUsers = ss.getSheetByName('_USERS');
  if (!shUsers) throw appError_('NOT_FOUND', 'No se encontró la hoja _USERS.');

  const rows = shUsers.getDataRange().getValues();
  const headers = rows[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  const colUser = headers.indexOf('username') !== -1 ? headers.indexOf('username') : 0;
  const colSalt = headers.indexOf('salt');
  const colPin = headers.indexOf('pin_sha256') !== -1 ? headers.indexOf('pin_sha256') : (colSalt !== -1 ? 4 : 3);
  const colIntentos = headers.indexOf('intentos_fallidos');
  const colBloqueado = headers.indexOf('bloqueado_hasta');

  let foundRow = -1;
  let userSalt = '';
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][colUser] || '').trim().toLowerCase() === targetUser.toLowerCase()) {
      foundRow = i + 1;
      if (colSalt !== -1) userSalt = String(rows[i][colSalt] || '').trim();
      break;
    }
  }

  if (foundRow === -1) {
    throw appError_('NOT_FOUND', 'El usuario "' + targetUser + '" no existe en _USERS.');
  }

  // Generamos el nuevo hash SHA-256 Base64
  const newHash = sha256_(newPin);
  shUsers.getRange(foundRow, colPin + 1).setValue(newHash);

  // Reiniciar intentos fallidos y desbloquear
  if (colIntentos !== -1) shUsers.getRange(foundRow, colIntentos + 1).setValue(0);
  if (colBloqueado !== -1) shUsers.getRange(foundRow, colBloqueado + 1).setValue('');

  logAudit_(user, 'UPDATE_PASSWORD', '_USERS', targetUser, null, {
    modificado_por: user.username,
    nuevo_hash_sha256: newHash,
    fecha: new Date(),
  });

  return {
    ok: true,
    message: 'Contraseña/PIN de ' + targetUser + ' actualizado exitosamente.',
    target_username: targetUser,
    nuevo_pin_sha256: newHash
  };
}

/**
 * Función utilitaria para ejecutar desde el Editor de Apps Script directamente:
 * Cristian puede abrir Apps Script, seleccionar esta función y cambiar cualquier PIN.
 */
function cambiarPinUsuario(targetUsername, nuevoPin) {
  return handleAuthUpdatePassword_(
    { target_username: targetUsername || 'cristian', new_pin: nuevoPin || '123456' },
    { username: 'cristian', role: 'admin' }
  );
}

function verifyTokenAndAuthorize_(token, action) {
  // Rutas públicas de infraestructura y login inicial
  const publicActions = ['health', 'config.get', 'auth.login'];
  if (publicActions.indexOf(action) !== -1) {
    return { username: 'anonimo', role: 'lectura', taller: 'Todos' };
  }

  if (!token) {
    // SEGURIDAD CRÍTICA (R-47): NUNCA otorgar rol admin automáticamente sin token de sesión.
    // Solo permitir lectura básica a usuarios no autenticados; toda mutación o reporte requiere PIN.
    const enforceAuth = PropertiesService.getScriptProperties().getProperty('ENFORCE_AUTH') === 'true';
    if (!enforceAuth) {
      const isReadOnly = action.indexOf('.list') !== -1 || action.indexOf('.get') !== -1 || action === 'catalogo.kardex';
      if (isReadOnly) {
        return { username: 'invitado', role: 'lectura', taller: 'Todos' };
      }
    }
    throw appError_('AUTH', 'Acceso denegado: Se requiere autenticación con usuario y PIN válidos (auto-admin deshabilitado por seguridad).');
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

  const allowed = (ROLE_PERMISSIONS[user.role] || []).concat(FORECAST_ROLE_PERMISSIONS[user.role] || []);
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
  if (val === null || val === undefined || val === '') {
    return type === 'boolean' ? false : '';
  }
  if (type === 'boolean') {
    return Boolean(val === true || String(val).toLowerCase() === 'true' || val === 1 || val === '1');
  }
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

/* ========================================================================== *
 * SECCIÓN 7: FORECAST SERVICE v3.0 (ABASTECIMIENTO INTELIGENTE Y APRENDIZAJE)
 * ========================================================================== */

const FC = { VERSION: 'EMA-1.1', MAX_WINDOWS_PER_SKU: 60 };
let FC_SEQ_COUNTER_ = 0; // Evita colisiones de IDs en ejecuciones rápidas

// Parámetros globales (editables en la hoja Forecast_Params o desde React)
const FC_DEFAULT_PARAMS = [
  ['DIAS_MODO', 'OPERATIVO', 'OPERATIVO = lunes a sábado (sin domingos) | CALENDARIO = 7 días'],
  ['REVISION_DIAS', 6, 'Cobertura operativa semanal (6 días lun-sáb según SDD-009 R-40)'],
  ['SEGURIDAD_DIAS', 2, 'Protección adicional en días (SDD-001)'],
  ['LEAD_TIME_DEFAULT', 2, 'Días de entrega del proveedor si el SKU no tiene lead_time propio'],
  ['FACTOR_APRENDIZAJE', 0.2, 'Peso de la tasa observada en el EMA (SDD-004). Tasa nueva = ant×(1-f) + obs×f'],
  ['VENTANA_APRENDIZAJE_DIAS', 3, 'Días operativos por ventana de observación automática desde el Kardex'],
  ['VENTANA_RECIENTE_DIAS', 14, 'Ventana para la tasa reciente (defensa mientras la confianza sea BAJA)'],
  ['ANOMALIA_FACTOR', 2.5, 'Observación > factor × tasa anterior => ANOMALÍA (SDD-006)'],
  ['CONF_MEDIA_OBS', 5, 'Observaciones verificadas para confianza MEDIA'],
  ['CONF_MEDIA_DIAS', 14, 'Días de historial para confianza MEDIA'],
  ['CONF_ALTA_OBS', 10, 'Observaciones verificadas para confianza ALTA'],
  ['CONF_ALTA_DIAS', 28, 'Días de historial para confianza ALTA'],
  ['ATRIBUCION_MIN', 0.8, 'Proporción mínima de consumo atribuido a puertas para sumar proyecto + general (SDD-008)'],
  ['USAR_MINIMO_CATALOGO', 'SI', 'SI = el Stock mínimo del Catálogo actúa como piso del stock de seguridad'],
  ['Z_SERVICIO', 1.65, 'Factor de servicio (≈95%) para el stock de seguridad por variabilidad'],
  ['TOLERANCIA_CONCILIACION', 0, 'Diferencia máxima conteo vs sistema para considerar conciliado'],
  ['HORIZONTE_SIM_MIN', 30, 'Días mínimos de simulación de inventario'],
  ['DIA_FEEDBACK', 1, 'Día de semana del cierre semanal de precisión (0=dom, 1=lun)'],
  ['ALERTAS_EMAIL', '', 'Correo(s) separados por coma para el resumen diario de riesgos (vacío = no envía)'],
  ['ESCALAR_POR_PERSONAL', 'NO', 'SI = escala la tasa según variación de PERSONAL_<GRUPO> respecto a PERSONAL_BASE_<GRUPO>'],
  ['PERSONAL_ENMASILLADO', 10, 'Plantilla actual: enmasilladores'],
  ['PERSONAL_BASE_ENMASILLADO', 10, 'Plantilla base histórica: enmasilladores'],
  ['PERSONAL_SOLDADURA', 2, 'Plantilla actual: soldadores'],
  ['PERSONAL_BASE_SOLDADURA', 2, 'Plantilla base histórica: soldadores'],
  ['PERSONAL_INSTALACION', 2, 'Plantilla actual: instaladores'],
  ['PERSONAL_BASE_INSTALACION', 2, 'Plantilla base histórica: instaladores'],
  ['PERSONAL_AYUDANTE', 2, 'Plantilla actual: ayudantes'],
  ['PERSONAL_BASE_AYUDANTE', 2, 'Plantilla base histórica: ayudantes'],
];

const FC_TABLES = {
  params: { name: 'Forecast_Params', headers: ['clave', 'valor', 'nota'] },
  config: {
    name: 'Forecast_Config',
    headers: [
      'sku', 'unidad', 'modo_prediccion', 'dias_seguridad', 'dias_revision', 'factor_aprendizaje',
      'lead_time', 'empaque', 'minimo_compra', 'maximo_entrega', 'grupo_usuario', 'modo_consumo', 'notas',
    ],
  },
  obs: {
    name: 'Consumption_Observations',
    headers: [
      'id', 'sku', 'fecha_inicial', 'fecha_final', 'cantidad', 'dias_observados', 'ubicacion', 'proyecto',
      'fuente', 'tipo', 'validacion', 'observaciones', 'tasa_observada', 'incorporada',
    ],
  },
  learning: {
    name: 'Consumption_Learning',
    headers: [
      'sku', 'tasa_inicial', 'tasa_aprendida', 'factor_aprendizaje', 'observaciones_validas', 'confianza',
      'fecha_actualizacion', 'version', 'desviacion_abs', 'ultima_fecha_procesada', 'origen_tasa',
    ],
  },
  learnHist: {
    name: 'Learning_History',
    headers: ['id', 'sku', 'tasa_anterior', 'tasa_nueva', 'observaciones_incorporadas', 'fecha_actualizacion', 'motivo', 'version'],
  },
  history: {
    name: 'Forecast_History',
    headers: [
      'run_id', 'fecha', 'sku', 'tasa_diaria', 'demanda_7d', 'demanda_estimada', 'stock_proyectado',
      'fecha_agotamiento', 'compra_sugerida', 'confianza', 'alerta', 'version',
    ],
  },
  feedback: {
    name: 'Forecast_Feedback',
    headers: [
      'id_pronostico', 'run_id', 'sku', 'consumo_previsto', 'consumo_real', 'error_abs', 'error_pct',
      'observaciones', 'fecha_conciliacion',
    ],
  },
  bom: { name: 'BOM_Puertas', headers: ['modelo', 'sku', 'cantidad_por_puerta', 'notas'] },
};

// Semillas provisionales de calibración inicial (confirmar equivalencias en producción)
const FC_SEEDS = [
  { sku: 'SEL-002', alias: 'Masilla', tipo: 'CONSUMO', cantidad: 5, dias: 5 },
  { sku: 'ABR-001', alias: 'Disco Velcro 80', tipo: 'CONSUMO', cantidad: 300, dias: 6 },
  { sku: 'ABR-005', alias: 'Lija 320 (disco grano 320)', tipo: 'FALTANTE', cantidad: 10 },
  { sku: 'ABR-004', alias: 'Lija 1000', tipo: 'VIGILANCIA', nota: 'Agotamiento frecuente, sin cantidades' },
];

function getForecastRoutes_() {
  return {
    'forecast.setup': function(p, u) { return fcSetup_(u); },
    'forecast.get': function(p) { return getMaterialForecast_(p); },
    'forecast.projection': function(p) { return calculateProjectedStock_(p); },
    'forecast.alerts': function(p) { return getStockoutAlerts_(p); },
    'forecast.plan': function(p) { return getWeeklyPurchasePlan_(p); },
    'forecast.observation.create': function(p, u) { return registerConsumptionObservation_(p, u); },
    'forecast.observation.approve': function(p, u) { return resolveObservation_(p, u); },
    'forecast.learning.run': function(p, u) { return updateConsumptionLearning_(u); },
    'forecast.learning.history': function(p) { return getLearningHistory_(p); },
    'forecast.feedback.create': function(p, u) { return registerForecastFeedback_(p, u); },
    'forecast.feedback.list': function(p) { return getForecastFeedback_(p); },
    'forecast.run': function(p, u) { return runDailyForecast(); },
    // Nuevas rutas v3.0 para administración completa desde React
    'forecast.history.list': function(p) { return getForecastHistory_(p); },
    'forecast.params.get': function() { return getForecastParamsApi_(); },
    'forecast.params.update': function(p, u) { return updateForecastParamsApi_(p, u); },
    'forecast.config.list': function(p) { return getForecastConfigApi_(p); },
    'forecast.config.update': function(p, u) { return updateForecastConfigApi_(p, u); },
    'forecast.bom.list': function(p) { return getForecastBomApi_(p); },
    'forecast.bom.upsert': function(p, u) { return upsertForecastBomApi_(p, u); },
    'forecast.bom.delete': function(p, u) { return deleteForecastBomApi_(p, u); },
  };
}

// ---- Utilitarios de fechas UTC y lectura de tablas Forecast_* ----------------

function fcParseDay_(s) {
  const p = String(s).slice(0, 10).split('-');
  return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
}
function fcDayStr_(d) { return d.toISOString().slice(0, 10); }
function fcAddDays_(s, n) { const d = fcParseDay_(s); d.setUTCDate(d.getUTCDate() + n); return fcDayStr_(d); }
function fcIsOp_(s, mode) { return mode === 'CALENDARIO' ? true : fcParseDay_(s).getUTCDay() !== 0; }
function fcNextOp_(s, mode) { let d = fcAddDays_(s, 1); while (!fcIsOp_(d, mode)) d = fcAddDays_(d, 1); return d; }
function fcAddOpDays_(s, n, mode) { let d = s; for (let i = 0; i < n; i++) d = fcNextOp_(d, mode); return d; }
function fcOpDays_(a, b, mode) {
  let n = 0; let d = a; let guard = 0;
  while (d <= b && guard++ < 4000) { if (fcIsOp_(d, mode)) n++; d = fcAddDays_(d, 1); }
  return n;
}
function fcToday_() { return Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd'); }
function fcRound_(x, d) { const m = Math.pow(10, d === undefined ? 2 : d); return Math.round((Number(x) + 1e-12) * m) / m; }
function fcDayOfWeek_(s) { return fcParseDay_(s).getUTCDay(); }

function fcTable_(key, create) {
  const def = FC_TABLES[key];
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    if (!create) return null;
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
    try {
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, def.headers.length).setFontWeight('bold');
      def.headers.forEach(function(h, i) {
        if (/^fecha|^ultima_fecha/.test(h)) {
          sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1000), 1).setNumberFormat('@');
        }
      });
    } catch (e) {}
  }
  return { sh: sh, headers: def.headers, def: def };
}

function fcCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : v;
}

function fcRead_(key) {
  const t = fcTable_(key, false);
  if (!t) return { sh: null, headers: FC_TABLES[key].headers, rows: [] };
  const last = t.sh.getLastRow();
  const rows = [];
  if (last >= 2) {
    const vals = t.sh.getRange(2, 1, last - 1, t.headers.length).getValues();
    vals.forEach(function(r, i) {
      if (r.every(function(c) { return c === '' || c === null; })) return;
      const o = { _row: i + 2 };
      t.headers.forEach(function(h, j) { o[h] = fcCell_(r[j]); });
      rows.push(o);
    });
  }
  return { sh: t.sh, headers: t.headers, rows: rows };
}

function fcSafe_(v) {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v === undefined || v === null ? '' : v;
}

function fcWriteTable_(key, rows) {
  const t = fcTable_(key, true);
  const prev = t.sh.getLastRow();
  if (prev >= 2) t.sh.getRange(2, 1, prev - 1, t.headers.length).clearContent();
  if (!rows.length) return;
  const vals = rows.map(function(o) { return t.headers.map(function(h) { return fcSafe_(o[h]); }); });
  t.sh.getRange(2, 1, vals.length, t.headers.length).setValues(vals);
}

function fcAppend_(key, objs) {
  if (!objs.length) return;
  const t = fcTable_(key, true);
  const vals = objs.map(function(o) { return t.headers.map(function(h) { return fcSafe_(o[h]); }); });
  t.sh.getRange(t.sh.getLastRow() + 1, 1, vals.length, t.headers.length).setValues(vals);
}

function fcParams_() {
  const P = {};
  FC_DEFAULT_PARAMS.forEach(function(d) { P[d[0]] = d[1]; });
  fcRead_('params').rows.forEach(function(r) {
    if (!r.clave || r.valor === '') return;
    const n = Number(r.valor);
    P[r.clave] = (r.valor !== '' && !isNaN(n) && r.clave !== 'ALERTAS_EMAIL' && r.clave !== 'DIAS_MODO' && r.clave !== 'ESCALAR_POR_PERSONAL' && r.clave !== 'USAR_MINIMO_CATALOGO')
      ? n
      : String(r.valor);
  });
  return P;
}

// ---- Núcleo Matemático Puro (Stock Verificado, EMA, Anomalías, Simulación) ---

function fcValidMovs_(rows) {
  const seen = {}; const out = [];
  rows.forEach(function(r) {
    const sku = String(r.sku || '').trim();
    const q = Number(r.cantidad);
    const f = String(r.fecha || '').slice(0, 10);
    if (!sku || !(q > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return;
    const v = String(r.validacion || 'OK').toUpperCase();
    if (v.indexOf('OK') !== 0) return;
    const id = r.id ? String(r.id) : '';
    if (id) { if (seen[id]) return; seen[id] = 1; }
    out.push({ id: id, fecha: f, tipo: String(r.tipo || ''), sku: sku, cantidad: q, obs: String(r.observaciones || '') });
  });
  return out;
}

function fcNet_(movs, ini, fin) {
  let net = 0;
  (movs || []).forEach(function(m) {
    if (m.fecha < ini || m.fecha > fin) return;
    if (m.tipo === 'Salida') net += m.cantidad;
    else if (m.tipo === 'Devolución') net -= m.cantidad;
  });
  return net;
}

function fcRecentRate_(movs, hoy, dataStart, P) {
  if (!dataStart) return null;
  const mode = P.DIAS_MODO;
  const ayer = fcAddDays_(hoy, -1);
  const end = ayer >= dataStart ? ayer : hoy;
  let ini = fcAddDays_(end, -(Number(P.VENTANA_RECIENTE_DIAS) * 2));
  if (ini < dataStart) ini = dataStart;
  let cnt = 0; let d = end; let start = end;
  while (d >= ini) { if (fcIsOp_(d, mode)) { cnt++; start = d; if (cnt >= Number(P.VENTANA_RECIENTE_DIAS)) break; } d = fcAddDays_(d, -1); }
  if (cnt <= 0) return null;
  const net = fcNet_(movs, start, end);
  return { rate: Math.max(0, net) / cnt, days: cnt, net: net, desde: start, hasta: end };
}

/**
 * Calcula stock físico real: último conteo físico + movimientos posteriores + compras posteriores.
 * Mitiga fórmulas congeladas o rangos truncados en la hoja Catalogo.
 */
function fcVerifiedStock_(cat, movs, compras) {
  const sys = Number(cat.stock_actual || 0);
  const conteo = cat.ultimo_conteo;
  const fc = String(cat.fecha_conteo || '').slice(0, 10);
  if (conteo === '' || conteo === null || conteo === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(fc)) {
    return { stock: sys, base: 'SISTEMA', sistema: sys, conteo: null, fecha_conteo: null };
  }
  let s = Number(conteo) || 0;
  (movs || []).forEach(function(m) {
    if (m.fecha <= fc) return;
    if (m.tipo === 'Salida' || m.tipo === 'Ajuste (-)') s -= m.cantidad;
    else if (m.tipo === 'Devolución' || m.tipo === 'Ajuste (+)') s += m.cantidad;
  });
  (compras || []).forEach(function(c) {
    const f = String(c.fecha || '').slice(0, 10);
    if (f && f > fc) s += Number(c.cant_recibida || 0);
  });
  return { stock: s, base: 'CONTEO+MOVIMIENTOS', sistema: sys, conteo: Number(conteo), fecha_conteo: fc };
}

function fcPendingReceipts_(compras, lead, mode) {
  const out = [];
  (compras || []).forEach(function(c) {
    const ped = Number(c.cant_pedida || 0); const rec = Number(c.cant_recibida || 0);
    const est = String(c.estado_recepcion || '').toUpperCase();
    if (!(ped > rec) || est === 'COMPLETO' || est === 'ANULADO' || est === 'CANCELADO' || est === 'BORRADOR') return;
    const f = String(c.fecha || '').slice(0, 10);
    if (!f) return;
    out.push({ fecha: fcAddOpDays_(f, lead, mode), cantidad: ped - rec });
  });
  return out.sort(function(a, b) { return a.fecha < b.fecha ? -1 : 1; });
}

function fcConfidence_(n, spanDays, conciliacionOk, P) {
  if (n >= P.CONF_ALTA_OBS && spanDays >= P.CONF_ALTA_DIAS && conciliacionOk) return 'ALTA';
  if (n >= P.CONF_MEDIA_OBS && spanDays >= P.CONF_MEDIA_DIAS) return 'MEDIA';
  return 'BAJA';
}

function fcLearnWindow_(prev, obsRate, alpha, P, forzar) {
  if (!prev || prev.tasa === null || prev.tasa === undefined || prev.tasa === '') {
    return { anomalia: false, tasa: obsRate, desv: 0, alpha: 1 };
  }
  const t = Number(prev.tasa);
  if (!forzar && t > 0 && obsRate > Number(P.ANOMALIA_FACTOR) * t) {
    return { anomalia: true, tasa: t, desv: Number(prev.desv || 0), alpha: 0 };
  }
  const a = Math.max(Number(alpha), 1 / (Number(prev.nEfectivo || 0) + 1));
  return {
    anomalia: false,
    tasa: t * (1 - a) + obsRate * a,
    desv: Number(prev.desv || 0) * (1 - a) + Math.abs(obsRate - t) * a,
    alpha: a,
  };
}

function fcBuildWindows_(desde, hoy, W, mode) {
  const out = [];
  let d = desde;
  while (!fcIsOp_(d, mode)) d = fcAddDays_(d, 1);
  let guard = 0;
  while (guard++ < FC.MAX_WINDOWS_PER_SKU) {
    const ini = d;
    const fin = fcAddOpDays_(ini, W - 1, mode);
    if (fin >= hoy) break;
    out.push({ ini: ini, fin: fin });
    d = fcNextOp_(fin, mode);
  }
  return out;
}

function fcGroupFor_(desc, cat, cfgGroup) {
  if (cfgGroup) return cfgGroup;
  const t = (String(desc || '') + ' ' + String(cat || '')).toLowerCase();
  if (/masilla|lija|disco|velcro|polifan|pliego|aplicador|pintur|sellador|thinner|laca|abrasiv/.test(t)) return 'ENMASILLADO';
  if (/electrodo|soldad|alambre|careta|corte metal/.test(t)) return 'SOLDADURA';
  if (/silicon|anclaje|instal|taco|espuma/.test(t)) return 'INSTALACION';
  return 'GENERAL';
}

function fcRoundQty_(qty, cfg) {
  if (!(qty > 0)) return 0;
  let q = Math.max(qty, Number(cfg.minimo_compra || 0));
  const e = Number(cfg.empaque) > 0 ? Number(cfg.empaque) : 1;
  q = Math.ceil(q / e - 1e-9) * e;
  return fcRound_(q, 2);
}

function fcSplitDeliveries_(qty, cfg, hoy, lead, revision, mode) {
  if (!(qty > 0)) return [];
  const e = Number(cfg.empaque) > 0 ? Number(cfg.empaque) : 1;
  let max = Number(cfg.maximo_entrega || 0);
  const out = [];
  if (!(max > 0) || qty <= max) {
    out.push({ n: 1, cantidad: qty, fecha_pedido: hoy, fecha_entrega: fcAddOpDays_(hoy, lead, mode) });
    return out;
  }
  max = Math.max(e, Math.floor(max / e) * e);
  let rest = qty; let n = 0; let pedido = hoy;
  while (rest > 0 && n < 20) {
    const q = Math.min(rest, max);
    out.push({ n: ++n, cantidad: fcRound_(q, 2), fecha_pedido: pedido, fecha_entrega: fcAddOpDays_(pedido, lead, mode) });
    rest -= q;
    pedido = fcAddOpDays_(pedido, Number(revision), mode);
  }
  return out;
}

function fcComputeSku_(x) {
  const P = x.P; const mode = P.DIAS_MODO; const hoy = x.hoy; const cfg = x.cfg || {};
  const lead = Number(cfg.lead_time) > 0 ? Number(cfg.lead_time) : Number(P.LEAD_TIME_DEFAULT);
  const seg = cfg.dias_seguridad !== '' && cfg.dias_seguridad !== undefined && cfg.dias_seguridad !== null ? Number(cfg.dias_seguridad) : Number(P.SEGURIDAD_DIAS);
  const rev = Number(cfg.dias_revision) > 0 ? Number(cfg.dias_revision) : Number(P.REVISION_DIAS);
  const stock = Number(x.stock || 0);
  const L = x.learning || null;
  const conf = L && L.confianza ? L.confianza : 'BAJA';
  const vigilancia = String(cfg.modo_prediccion || '').toUpperCase() === 'VIGILANCIA';

  let tasa = null; let fuente = 'SIN_DATOS';
  if (L && L.tasa_aprendida !== '' && L.tasa_aprendida !== null && L.tasa_aprendida !== undefined) {
    tasa = Number(L.tasa_aprendida);
    fuente = (L.origen_tasa === 'SEED' && Number(L.observaciones_validas || 0) === 0) ? 'PROVISIONAL' : 'APRENDIDA';
  }
  if (x.recent && x.recent.rate > 0 && (tasa === null || (conf === 'BAJA' && x.recent.rate > tasa))) {
    tasa = x.recent.rate;
    fuente = fuente === 'SIN_DATOS' ? 'KARDEX_RECIENTE' : fuente + '+RECIENTE';
  }

  // Escalado opcional por plantilla operativa (si ESCALAR_POR_PERSONAL === 'SI')
  if (tasa > 0 && String(P.ESCALAR_POR_PERSONAL).toUpperCase() === 'SI' && x.personal > 0 && x.personalBase > 0 && x.personal !== x.personalBase) {
    tasa = tasa * (x.personal / x.personalBase);
    fuente += '+PLANTILLA';
  }

  let modelo = 'HISTORICO';
  if (x.proyecto && x.proyecto.perDay > 0) {
    const hist = tasa || 0;
    if (Number(x.proyecto.atribucion || 0) >= Number(P.ATRIBUCION_MIN)) {
      tasa = x.proyecto.perDay + hist * (1 - Number(x.proyecto.atribucion));
      modelo = 'PROYECTO+GENERAL';
    } else {
      tasa = Math.max(hist, x.proyecto.perDay);
      modelo = 'CONSERVADOR(max historico, proyecto)';
    }
  }

  const protH = rev + lead + seg;
  const base = {
    sku: x.sku, descripcion: x.descripcion, unidad: x.unidad, categoria: x.categoria,
    stock_fisico: fcRound_(stock, 2), stock_sistema: fcRound_(Number(x.stockSistema || 0), 2),
    base_stock: x.baseStock || 'SISTEMA', fecha_conteo: x.fechaConteo || null,
    conciliacion: { alerta: false, diferencia: 0 },
    lead_time_dias: lead, dias_revision: rev, dias_seguridad: seg, horizonte_proteccion_dias: protH,
    confianza: conf, vigilancia: vigilancia, modelo: modelo, grupo_usuario: x.grupo || 'GENERAL',
    faltantes_pendientes: x.faltantes || 0,
    stock_minimo_catalogo: Number(x.stockMin || 0),
  };
  const dif = Number(x.stockSistema || 0) - stock;
  if (x.baseStock === 'CONTEO+MOVIMIENTOS' && Math.abs(dif) > Number(P.TOLERANCIA_CONCILIACION)) {
    base.conciliacion = {
      alerta: true,
      diferencia: fcRound_(dif, 2),
      detalle: 'El sistema dice ' + fcRound_(x.stockSistema, 2) + ' pero conteo + movimientos posteriores da ' + fcRound_(stock, 2),
    };
  }

  if (!(tasa > 0)) {
    const piso = String(P.USAR_MINIMO_CATALOGO) === 'SI' ? Number(x.stockMin || 0) : 0;
    let nivel = 'GRIS'; let causa = 'Datos insuficientes: no hay consumo registrado para predecir.';
    let accion = 'Registrar observaciones de consumo (cantidad y días) o esperar movimientos en el Kardex.';
    if (stock <= 0 && piso <= 0 && !vigilancia) {
      causa = 'Sin stock y sin datos de consumo ni stock mínimo definido: no se puede predecir.';
      accion = 'Definir stock mínimo en el Catálogo y registrar consumo; si se usa, comprar.';
    } else if (stock <= 0) {
      nivel = 'ROJO'; causa = 'AGOTADO: stock 0 y sin tasa de consumo confiable.';
      accion = 'Comprar ahora' + (piso > 0 ? ' al menos ' + piso + ' ' + (x.unidad || '') : '') + ' y registrar consumo para activar el pronóstico.';
    } else if (piso > 0 && stock < piso) {
      nivel = 'NARANJA'; causa = 'Stock ' + fcRound_(stock, 2) + ' por debajo del mínimo del Catálogo (' + piso + ') y sin tasa de consumo.';
      accion = 'Reponer hasta el mínimo del Catálogo.';
    }
    const sug = piso > 0 ? fcRoundQty_(piso - stock, cfg) : 0;
    if (base.faltantes_pendientes > 0) causa += ' Faltante reportado de ' + base.faltantes_pendientes + ' ' + (x.unidad || '') + ' pendiente de confirmar con conteo físico (no se interpreta como consumo diario).';
    if (base.conciliacion.alerta) causa += ' ⚠ Conciliar: ' + base.conciliacion.detalle + '.';
    return Object.assign(base, {
      tasa_diaria: null, fuente_tasa: fuente, tasa_por_persona: null,
      demanda_7d: null, proteccion_2d: null, demanda_cobertura_9d: null,
      stock_seguridad: piso, punto_reorden: null, posicion_inventario: fcRound_(stock, 2),
      recepciones_pendientes: 0,
      fecha_agotamiento: stock <= 0 ? hoy : null, dias_cobertura: null,
      recepcion_antes_agotamiento: null, cantidad_sugerida: sug, base_sugerencia: sug > 0 ? 'MINIMO_CATALOGO' : null,
      entregas: fcSplitDeliveries_(sug, cfg, hoy, lead, rev, mode), urgente: stock <= 0, debajo_punto_reorden: false,
      alerta: { nivel: nivel, causa: causa, accion: accion },
      proyeccion: [],
    });
  }

  const desvAbs = L && L.desviacion_abs !== '' ? Number(L.desviacion_abs || 0) : 0;
  let seguridad = tasa * seg;
  seguridad = Math.max(seguridad, Number(P.Z_SERVICIO) * 1.25 * desvAbs * Math.sqrt(Math.max(lead, 1)));
  if (String(P.USAR_MINIMO_CATALOGO) === 'SI') seguridad = Math.max(seguridad, Number(x.stockMin || 0));
  const rop = tasa * lead + seguridad;
  const pend = (x.pend || []).map(function(p) { return { fecha: p.fecha, cantidad: Number(p.cantidad), used: false }; });
  const pendTotal = pend.reduce(function(a, p) { return a + p.cantidad; }, 0);
  const position = stock + pendTotal;

  const N = Math.max(Number(P.HORIZONTE_SIM_MIN), protH + 7);
  let s = stock; let d = hoy; let dep = -1; let below = -1;
  const proj = [];
  for (let i = 1; i <= N; i++) {
    d = fcNextOp_(d, mode);
    let rec = 0;
    pend.forEach(function(p) { if (!p.used && p.fecha <= d) { rec += p.cantidad; p.used = true; } });
    s = s + rec - tasa;
    proj.push({ dia: i, fecha: d, recepcion: fcRound_(rec, 2), demanda: fcRound_(tasa, 2), stock: fcRound_(s, 2) });
    if (dep < 0 && s <= 0) dep = i;
    if (below < 0 && s < seguridad) below = i;
  }
  const fechaAgot = dep > 0 ? proj[dep - 1].fecha : null;
  const llegadaNueva = fcAddOpDays_(hoy, lead, mode);
  const diasCob = fcRound_(stock / tasa, 1);
  const primeraRec = pend.length ? pend[0].fecha : null;
  const recAntes = fechaAgot ? (primeraRec ? primeraRec <= fechaAgot : false) : null;

  const requerido = tasa * protH + Math.max(0, seguridad - tasa * seg);
  const sugBruta = Math.max(0, requerido - position);
  const sug = fcRoundQty_(sugBruta, cfg);
  const entregas = fcSplitDeliveries_(sug, cfg, hoy, lead, rev, mode);
  const urgente = !!(sug > 0 && fechaAgot && entregas.length && entregas[0].fecha_entrega > fechaAgot);

  let nivel = 'VERDE'; let causa = 'Disponibilidad cubre la demanda proyectada y la protección.'; let accion = 'Sin acción. Seguir monitoreando.';
  const u = x.unidad || '';
  if (stock <= 0) {
    nivel = 'ROJO'; causa = 'Sin existencias. Consumo estimado ' + fcRound_(tasa, 2) + ' ' + u + '/día.';
    accion = 'Comprar YA ' + sug + ' ' + u + ' con entrega urgente o reasignar desde otro taller.';
  } else if (dep > 0 && dep <= lead && !(recAntes === true)) {
    nivel = 'ROJO'; causa = 'Se agota el ' + fechaAgot + ' (≈' + diasCob + ' días de stock) y una compra hoy llega el ' + llegadaNueva + ' (lead time ' + lead + ' d).';
    accion = 'Pedir hoy ' + sug + ' ' + u + ' con entrega urgente; mientras tanto racionar/reasignar.';
  } else if (dep > 0 && primeraRec && !recAntes) {
    nivel = 'ROJO'; causa = 'La recepción confirmada del ' + primeraRec + ' llega después del agotamiento proyectado (' + fechaAgot + ').';
    accion = 'Adelantar la entrega o comprar ' + sug + ' ' + u + ' adicionales a otro proveedor.';
  } else if (below > 0 && below <= protH) {
    nivel = 'NARANJA';
    causa = 'El stock proyectado cae por debajo del stock de seguridad (' + fcRound_(seguridad, 1) + ') el ' + proj[below - 1].fecha + '.';
    accion = 'Emitir orden de compra esta semana por ' + sug + ' ' + u + '.';
  } else if (sug > 0 || (dep > 0 && dep <= protH)) {
    nivel = 'AMARILLO';
    causa = 'Cobertura (' + diasCob + ' días) inferior al horizonte objetivo de ' + protH + ' días.';
    accion = 'Incluir en el plan semanal de compras: ' + sug + ' ' + u + '.';
  }
  if (base.faltantes_pendientes > 0) causa += ' Faltante reportado de ' + base.faltantes_pendientes + ' pendiente de conteo físico.';
  if (base.conciliacion.alerta) causa += ' ⚠ Conciliar: ' + base.conciliacion.detalle + '.';

  return Object.assign(base, {
    tasa_diaria: fcRound_(tasa, 2), fuente_tasa: fuente,
    tasa_por_persona: x.personal > 0 ? fcRound_(tasa / x.personal, 2) : null,
    demanda_7d: fcRound_(tasa * rev, 2), proteccion_2d: fcRound_(tasa * seg, 2),
    demanda_cobertura_9d: fcRound_(tasa * (rev + seg), 2),
    stock_seguridad: fcRound_(seguridad, 2), punto_reorden: fcRound_(rop, 2), posicion_inventario: fcRound_(position, 2),
    recepciones_pendientes: fcRound_(pendTotal, 2),
    fecha_agotamiento: fechaAgot, dias_cobertura: diasCob, recepcion_antes_agotamiento: recAntes,
    cantidad_sugerida: sug, base_sugerencia: sug > 0 ? 'DEMANDA_HORIZONTE' : null,
    entregas: entregas, urgente: urgente, debajo_punto_reorden: position <= rop,
    alerta: { nivel: nivel, causa: causa, accion: accion },
    proyeccion: x.incluirProyeccion ? proj : [],
  });
}

// ---- Contexto y Evaluación Batch -------------------------------------------

function fcBuildContext_() {
  const P = fcParams_();
  const hoy = fcToday_();
  const catalog = listEntity_('catalogo', { pageSize: 5000 }).rows.filter(function(r) { return r.sku; });
  const movs = fcValidMovs_(listEntity_('movimientos', { pageSize: 50000 }).rows);
  const compras = listEntity_('compras', { pageSize: 50000 }).rows;
  const cfgMap = {}; fcRead_('config').rows.forEach(function(r) { cfgMap[r.sku] = r; });
  const learnMap = {}; fcRead_('learning').rows.forEach(function(r) { learnMap[r.sku] = r; });
  const obs = fcRead_('obs').rows;

  const movsBySku = {}; movs.forEach(function(m) { (movsBySku[m.sku] = movsBySku[m.sku] || []).push(m); });
  const comprasBySku = {}; compras.forEach(function(c) { if (c.sku) (comprasBySku[c.sku] = comprasBySku[c.sku] || []).push(c); });
  let dataStart = null;
  movs.forEach(function(m) { if (m.tipo === 'Salida' && (!dataStart || m.fecha < dataStart)) dataStart = m.fecha; });

  const proyecto = {};
  const bom = fcRead_('bom').rows;
  if (bom.length) {
    const agenda = listEntity_('agenda_puertas', { pageSize: 5000 }).rows;
    const unidadesPorModelo = {};
    agenda.forEach(function(a) {
      const est = String(a.estado || '').toLowerCase();
      // R-16 & R-39 (SDD-009): Puertas "En confirmación" NO generan demanda de materiales
      if (/entregad|cancel|instalad|terminad|confirmaci[oó]n/.test(est)) return;
      const m = String(a.modelo || '').trim().toUpperCase();
      if (m) unidadesPorModelo[m] = (unidadesPorModelo[m] || 0) + Number(a.unidades || 0);
    });
    bom.forEach(function(b) {
      const u = unidadesPorModelo[String(b.modelo || '').trim().toUpperCase()] || 0;
      if (!u || !b.sku) return;
      proyecto[b.sku] = (proyecto[b.sku] || 0) + (u * Number(b.cantidad_por_puerta || 0)) / Number(P.REVISION_DIAS);
    });
  }

  const desde28 = fcAddDays_(hoy, -28);
  const atrib = {};
  Object.keys(movsBySku).forEach(function(sku) {
    let tot = 0; let ligado = 0;
    movsBySku[sku].forEach(function(m) {
      if (m.tipo !== 'Salida' || m.fecha < desde28) return;
      tot += m.cantidad;
      if (/puerta|dec-\d/i.test(m.obs)) ligado += m.cantidad;
    });
    atrib[sku] = tot > 0 ? ligado / tot : 0;
  });

  return {
    P: P, hoy: hoy, catalog: catalog, movs: movs, movsBySku: movsBySku,
    compras: compras, comprasBySku: comprasBySku, cfgMap: cfgMap, learnMap: learnMap,
    obs: obs, dataStart: dataStart, proyecto: proyecto, atrib: atrib,
  };
}

function fcSkuInput_(ctx, cat, incluirProyeccion) {
  const P = ctx.P; const sku = cat.sku;
  const cfg = ctx.cfgMap[sku] || {};
  const lead = Number(cfg.lead_time) > 0 ? Number(cfg.lead_time) : Number(P.LEAD_TIME_DEFAULT);
  const movs = ctx.movsBySku[sku] || [];
  const ver = fcVerifiedStock_(cat, movs, ctx.comprasBySku[sku]);
  const grupo = fcGroupFor_(cat.descripcion, cat.categoria, cfg.grupo_usuario);
  const faltantes = ctx.obs.filter(function(o) { return o.sku === sku && o.tipo === 'FALTANTE' && o.validacion === 'PENDIENTE_CONTEO'; })
    .reduce(function(a, o) { return a + Number(o.cantidad || 0); }, 0);
  return {
    sku: sku, descripcion: cat.descripcion, unidad: cat.unidad, categoria: cat.categoria,
    stock: ver.stock, stockSistema: ver.sistema, baseStock: ver.base, fechaConteo: ver.fecha_conteo,
    stockMin: Number(cat.stock_minimo || 0), cfg: cfg, learning: ctx.learnMap[sku] || null,
    recent: fcRecentRate_(movs, ctx.hoy, ctx.dataStart, P),
    pend: fcPendingReceipts_(ctx.comprasBySku[sku], lead, P.DIAS_MODO),
    proyecto: ctx.proyecto[sku] ? { perDay: ctx.proyecto[sku], atribucion: ctx.atrib[sku] || 0 } : null,
    faltantes: faltantes, grupo: grupo,
    personal: Number(P['PERSONAL_' + grupo] || 0),
    personalBase: Number(P['PERSONAL_BASE_' + grupo] || 0),
    hoy: ctx.hoy, P: P, incluirProyeccion: !!incluirProyeccion,
  };
}

function fcIsForecastable_(cat, cfg) {
  if (/^GEN-/i.test(String(cat.sku))) return false;
  const modo = String((cfg && cfg.modo_consumo) || '').toUpperCase();
  if (modo === 'NINGUNO') return false;
  if (modo === 'SALIDA') return true;
  return String(cat.grupo_gasto || '').toLowerCase() === 'insumos' && !/equipo/i.test(String(cat.categoria || ''));
}

const FC_SEV = { ROJO: 0, NARANJA: 1, AMARILLO: 2, GRIS: 3, VERDE: 4 };

function fcComputeAll_(ctx, incluirProyeccion) {
  const out = [];
  ctx.catalog.forEach(function(cat) {
    if (!fcIsForecastable_(cat, ctx.cfgMap[cat.sku])) return;
    out.push(fcComputeSku_(fcSkuInput_(ctx, cat, incluirProyeccion)));
  });
  out.sort(function(a, b) {
    const d = FC_SEV[a.alerta.nivel] - FC_SEV[b.alerta.nivel];
    if (d !== 0) return d;
    return (a.dias_cobertura === null ? 1e9 : a.dias_cobertura) - (b.dias_cobertura === null ? 1e9 : b.dias_cobertura);
  });
  return out;
}

function fcSummary_(rows) {
  const r = {
    ROJO: 0, NARANJA: 0, AMARILLO: 0, VERDE: 0, GRIS: 0,
    rojo: 0, naranja: 0, amarillo: 0, verde: 0, gris: 0,
    total_alertas: (rows || []).length,
  };
  (rows || []).forEach(function(x) {
    const niv = String(x.alerta && x.alerta.nivel || 'GRIS').toUpperCase();
    if (r[niv] !== undefined) r[niv]++;
    const low = niv.toLowerCase();
    if (r[low] !== undefined) r[low]++;
  });
  return r;
}

// ---- Endpoints Principales del Motor Forecast ------------------------------

function getMaterialForecast_(p) {
  p = p || {};
  const ctx = fcBuildContext_();
  let rows = fcComputeAll_(ctx, !!p.incluirProyeccion);
  if (p.sku) rows = rows.filter(function(r) { return String(r.sku).toUpperCase() === String(p.sku).toUpperCase(); });
  if (p.alerta) rows = rows.filter(function(r) { return r.alerta.nivel === String(p.alerta).toUpperCase(); });
  if (p.grupo_usuario) rows = rows.filter(function(r) { return String(r.grupo_usuario).toUpperCase() === String(p.grupo_usuario).toUpperCase(); });
  if (p.confianza) rows = rows.filter(function(r) { return String(r.confianza).toUpperCase() === String(p.confianza).toUpperCase(); });
  if (p.categoria) rows = rows.filter(function(r) { return String(r.categoria || '').toLowerCase() === String(p.categoria).toLowerCase(); });
  if (p.q) {
    const q = String(p.q).toLowerCase();
    rows = rows.filter(function(r) { return (r.sku + ' ' + r.descripcion).toLowerCase().indexOf(q) !== -1; });
  }

  const resumen = fcSummary_(rows);
  const total = rows.length;
  if (p.page || p.pageSize) {
    const page = Math.max(1, Number(p.page || 1));
    const pageSize = Math.max(1, Number(p.pageSize || 50));
    rows = rows.slice((page - 1) * pageSize, page * pageSize);
    return {
      generado: new Date().toISOString(), hoy: ctx.hoy, version_modelo: FC.VERSION,
      modo_dias: ctx.P.DIAS_MODO, resumen: resumen, total: total, page: page, pageSize: pageSize, rows: rows,
    };
  }

  return {
    generado: new Date().toISOString(), hoy: ctx.hoy, version_modelo: FC.VERSION,
    modo_dias: ctx.P.DIAS_MODO, resumen: resumen, total: total, rows: rows,
  };
}

function calculateProjectedStock_(p) {
  if (!p || !p.sku) throw appError_('VALIDATION', 'Debe indicar sku.');
  const r = getMaterialForecast_({ sku: p.sku, incluirProyeccion: true });
  if (!r.rows.length) throw appError_('NOT_FOUND', 'SKU sin pronóstico (no es consumible o no existe): ' + p.sku);
  return r.rows[0];
}

function getStockoutAlerts_(p) {
  p = p || {};
  const niveles = (p.niveles && p.niveles.length) ? p.niveles : ['ROJO', 'NARANJA', 'AMARILLO'];
  const ctx = fcBuildContext_();
  const rows = fcComputeAll_(ctx, false).filter(function(r) {
    return niveles.indexOf(r.alerta.nivel) !== -1 || (p.incluirGris && r.alerta.nivel === 'GRIS');
  });
  return {
    hoy: ctx.hoy,
    resumen: fcSummary_(rows),
    alertas: rows.map(function(r) {
      return {
        sku: r.sku, descripcion: r.descripcion, unidad: r.unidad, nivel: r.alerta.nivel,
        alerta: r.alerta.nivel,
        causa: r.alerta.causa, accion: r.alerta.accion, stock_fisico: r.stock_fisico,
        tasa_diaria: r.tasa_diaria, fecha_agotamiento: r.fecha_agotamiento,
        dias_cobertura: r.dias_cobertura, cantidad_sugerida: r.cantidad_sugerida,
        urgente: r.urgente, confianza: r.confianza, conciliacion: r.conciliacion,
      };
    }),
  };
}

function getWeeklyPurchasePlan_(p) {
  const ctx = fcBuildContext_();
  const catBy = {}; ctx.catalog.forEach(function(c) { catBy[c.sku] = c; });
  const items = fcComputeAll_(ctx, false).filter(function(r) { return r.cantidad_sugerida > 0; }).map(function(r) {
    const c = catBy[r.sku] || {};
    const precio = Number(c.precio_ref_neto || 0);
    return {
      sku: r.sku, descripcion: r.descripcion, unidad: r.unidad,
      proveedor: c.proveedor_pref || 'Por asignar',
      nivel: r.alerta.nivel, urgente: r.urgente, cantidad_sugerida: r.cantidad_sugerida,
      base_sugerencia: r.base_sugerencia, entregas: r.entregas,
      stock_fisico: r.stock_fisico, tasa_diaria: r.tasa_diaria, fecha_agotamiento: r.fecha_agotamiento,
      confianza: r.confianza,
      precio_ref_neto: precio > 0 ? precio : null,
      costo_estimado: precio > 0 ? fcRound_(precio * r.cantidad_sugerida, 2) : null,
      requiere_autorizacion: true,
    };
  });
  const porProveedor = {};
  items.forEach(function(i) { (porProveedor[i.proveedor] = porProveedor[i.proveedor] || []).push(i); });
  return {
    hoy: ctx.hoy,
    semana_desde: ctx.hoy,
    nota: 'Sugerencias; la emisión de compras requiere autorización humana.',
    total_items: items.length,
    urgentes: items.filter(function(i) { return i.urgente || i.nivel === 'ROJO'; }).length,
    costo_estimado_total: fcRound_(items.reduce(function(a, i) { return a + (i.costo_estimado || 0); }, 0), 2),
    por_proveedor: porProveedor,
    items: items,
  };
}

// ---- Observaciones, Anomalías y Aprendizaje EMA ----------------------------

function fcNewId_(prefix) {
  FC_SEQ_COUNTER_ = (FC_SEQ_COUNTER_ + 1) % 10000;
  const seq = ('0000' + FC_SEQ_COUNTER_).slice(-4);
  return prefix + '-' + Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyyMMddHHmmss') + '-' + seq;
}

function fcOverlap_(obs, sku, ini, fin) {
  return obs.some(function(o) {
    return o.sku === sku && o.tipo === 'CONSUMO' && o.fecha_inicial && o.fecha_final && o.validacion !== 'RECHAZADA' &&
      !(o.fecha_final < ini || o.fecha_inicial > fin);
  });
}

function registerConsumptionObservation_(p, user) {
  p = p || {};
  const cat = validateSkuExists_(p.sku);
  const tipo = String(p.tipo || 'CONSUMO').toUpperCase();
  const cantidad = Number(p.cantidad);
  if (!(cantidad > 0)) throw appError_('VALIDATION', 'La cantidad debe ser mayor a 0.');
  const lock = LockService.getScriptLock(); lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);
  try {
    const t = fcRead_('obs'); const P = fcParams_();
    const o = {
      id: fcNewId_('OBS'), sku: cat.sku, cantidad: cantidad, ubicacion: p.ubicacion || 'Todos', proyecto: p.proyecto || '',
      fuente: p.fuente || 'MANUAL', tipo: tipo,
      observaciones: (p.observaciones || '') + (user && user.username ? ' [' + user.username + ']' : ''),
      incorporada: 'NO',
    };
    if (tipo === 'FALTANTE') {
      o.fecha_inicial = p.fecha || fcToday_(); o.fecha_final = o.fecha_inicial;
      o.dias_observados = ''; o.tasa_observada = '';
      o.validacion = 'PENDIENTE_CONTEO'; o.incorporada = 'N/A';
    } else if (tipo === 'CONSUMO') {
      if (!p.fecha_inicial || !p.fecha_final || p.fecha_final < p.fecha_inicial) throw appError_('VALIDATION', 'Fechas inicial/final inválidas.');
      if (fcOverlap_(t.rows, cat.sku, p.fecha_inicial, p.fecha_final)) {
        throw appError_('CONFLICT', 'Ya existe una observación de consumo de ' + cat.sku + ' que se traslapa con esas fechas.');
      }
      const dias = fcOpDays_(p.fecha_inicial, p.fecha_final, P.DIAS_MODO);
      if (dias <= 0) throw appError_('VALIDATION', 'El rango no contiene días operativos.');
      o.fecha_inicial = p.fecha_inicial; o.fecha_final = p.fecha_final; o.dias_observados = dias;
      o.tasa_observada = fcRound_(cantidad / dias, 4); o.validacion = 'VERIFICADA';
    } else {
      throw appError_('VALIDATION', 'Tipo no soportado: ' + tipo + ' (use CONSUMO o FALTANTE).');
    }
    t.rows.push(o); fcWriteTable_('obs', t.rows);
    logAudit_(user, 'CREATE', 'consumption_observation', o.id, null, o);
    const res = { observacion: o, aprendizaje: null };
    if (tipo === 'CONSUMO' && p.aprenderAhora !== false) res.aprendizaje = fcRunLearning_(fcBuildContext_(), user, cat.sku);
    return res;
  } finally { lock.releaseLock(); }
}

function resolveObservation_(p, user) {
  if (!p || !p.id) throw appError_('VALIDATION', 'Debe indicar el id de la observación.');
  const lock = LockService.getScriptLock(); lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);
  try {
    const t = fcRead_('obs');
    const o = t.rows.filter(function(r) { return r.id === p.id; })[0];
    if (!o) throw appError_('NOT_FOUND', 'No existe la observación ' + p.id);
    const dec = String(p.decision || '').toUpperCase();
    if (dec === 'APROBAR') {
      if (!p.motivo) throw appError_('VALIDATION', 'Aprobar una anomalía requiere justificación (motivo).');
      o.validacion = 'APROBADA'; o.incorporada = 'NO';
    } else if (dec === 'RECHAZAR') {
      o.validacion = 'RECHAZADA'; o.incorporada = 'N/A';
    } else if (dec === 'CONFIRMAR_FALTANTE' && o.tipo === 'FALTANTE') {
      o.validacion = 'CONFIRMADA';
    } else {
      throw appError_('VALIDATION', 'decision debe ser APROBAR, RECHAZAR o CONFIRMAR_FALTANTE.');
    }
    o.observaciones = (o.observaciones || '') + ' | ' + dec + ': ' + (p.motivo || '') + ' [' + ((user && user.username) || '') + ']';
    fcWriteTable_('obs', t.rows);
    logAudit_(user, 'UPDATE', 'consumption_observation', o.id, null, o);
    return { observacion: o, aprendizaje: dec === 'APROBAR' ? fcRunLearning_(fcBuildContext_(), user, o.sku, p.motivo) : null };
  } finally { lock.releaseLock(); }
}

function updateConsumptionLearning_(user) {
  const lock = LockService.getScriptLock(); lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);
  try { return fcRunLearning_(fcBuildContext_(), user, null); } finally { lock.releaseLock(); }
}

function fcRunLearning_(ctx, user, soloSku, motivoExtra) {
  const P = ctx.P; const mode = P.DIAS_MODO; const W = Number(P.VENTANA_APRENDIZAJE_DIAS); const hoy = ctx.hoy;
  const obsT = fcRead_('obs'); const obs = obsT.rows;
  const learnT = fcRead_('learning'); const learn = {}; learnT.rows.forEach(function(r) { learn[r.sku] = r; });
  const ahora = Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const hist = []; const resumen = { ventanas_nuevas: 0, incorporadas: 0, anomalias: 0, skus_actualizados: [] };
  const ultima = {};

  ctx.catalog.forEach(function(cat) {
    const sku = cat.sku;
    if (soloSku && sku !== soloSku) return;
    if (!fcIsForecastable_(cat, ctx.cfgMap[sku])) return;
    const L = learn[sku];
    const desde = (L && L.ultima_fecha_procesada) ? fcAddDays_(L.ultima_fecha_procesada, 1) : ctx.dataStart;
    if (!desde || !ctx.dataStart) return;
    fcBuildWindows_(desde, hoy, W, mode).forEach(function(w) {
      if (fcOverlap_(obs, sku, w.ini, w.fin)) { ultima[sku] = w.fin; return; }
      const net = fcNet_(ctx.movsBySku[sku], w.ini, w.fin);
      if (!L && !learn['_n_' + sku] && net <= 0) return;
      if (net < 0) { ultima[sku] = w.fin; return; }
      const id = 'AUTO-' + sku + '-' + w.ini + '-' + w.fin;
      if (obs.some(function(o) { return o.id === id; })) { ultima[sku] = w.fin; return; }
      obs.push({
        id: id, sku: sku, fecha_inicial: w.ini, fecha_final: w.fin, cantidad: net, dias_observados: W,
        ubicacion: 'Todos', proyecto: '', fuente: 'KARDEX_AUTO', tipo: 'CONSUMO', validacion: 'AUTO_OK',
        observaciones: 'Salidas netas de devoluciones (Kardex)', tasa_observada: fcRound_(net / W, 4), incorporada: 'NO',
      });
      learn['_n_' + sku] = learn['_n_' + sku] || { sku: '_n_' };
      ultima[sku] = w.fin; resumen.ventanas_nuevas++;
    });
  });
  Object.keys(learn).forEach(function(k) { if (k.indexOf('_n_') === 0) delete learn[k]; });

  const pend = obs.filter(function(o) {
    return o.tipo === 'CONSUMO' && o.incorporada === 'NO' && (!soloSku || o.sku === soloSku) &&
      ['VERIFICADA', 'AUTO_OK', 'APROBADA'].indexOf(o.validacion) !== -1 && o.fecha_inicial && o.fecha_final;
  }).sort(function(a, b) { return a.fecha_final < b.fecha_final ? -1 : (a.fecha_final > b.fecha_final ? 1 : 0); });

  const catBy = {}; ctx.catalog.forEach(function(c) { catBy[c.sku] = c; });
  pend.forEach(function(o) {
    const cfg = ctx.cfgMap[o.sku] || {};
    const alpha = Number(cfg.factor_aprendizaje) > 0 ? Number(cfg.factor_aprendizaje) : Number(P.FACTOR_APRENDIZAJE);
    let L = learn[o.sku];
    const rate = Number(o.tasa_observada);
    const prev = L ? { tasa: L.tasa_aprendida, desv: L.desviacion_abs, nEfectivo: Number(L.observaciones_validas || 0) + (L.origen_tasa === 'SEED' ? 1 : 0) } : null;
    const r = fcLearnWindow_(prev, rate, alpha, P, o.validacion === 'APROBADA');
    if (r.anomalia) {
      o.validacion = 'ANOMALIA';
      o.observaciones = (o.observaciones || '') + ' | Tasa observada ' + fcRound_(rate, 2) + ' > ' + P.ANOMALIA_FACTOR + '× la tasa vigente ' + fcRound_(prev.tasa, 2) + '. Aprobar o rechazar.';
      resumen.anomalias++; return;
    }
    if (!L) {
      L = {
        sku: o.sku, tasa_inicial: fcRound_(rate, 4), tasa_aprendida: '', factor_aprendizaje: alpha,
        observaciones_validas: 0, confianza: 'BAJA', version: FC.VERSION, desviacion_abs: 0,
        ultima_fecha_procesada: '', origen_tasa: 'KARDEX',
      };
      learn[o.sku] = L;
    }
    const tasaAnt = L.tasa_aprendida === '' ? '' : Number(L.tasa_aprendida);
    L.tasa_aprendida = fcRound_(r.tasa, 4); L.desviacion_abs = fcRound_(r.desv, 4); L.factor_aprendizaje = alpha;
    L.observaciones_validas = Number(L.observaciones_validas || 0) + 1;
    L.fecha_actualizacion = ahora; L.version = FC.VERSION;
    if (L.origen_tasa === 'SEED') L.origen_tasa = 'SEED+APRENDIDA';
    o.incorporada = 'SI';
    hist.push({
      id: fcNewId_('LH'), sku: o.sku, tasa_anterior: tasaAnt, tasa_nueva: L.tasa_aprendida,
      observaciones_incorporadas: o.id, fecha_actualizacion: ahora,
      motivo: (motivoExtra ? motivoExtra + ' | ' : '') + 'EMA alpha=' + fcRound_(r.alpha, 3) + ' obs=' + fcRound_(rate, 2) + '/día (' + o.fuente + ')',
      version: FC.VERSION,
    });
    resumen.incorporadas++; if (resumen.skus_actualizados.indexOf(o.sku) === -1) resumen.skus_actualizados.push(o.sku);
  });

  Object.keys(learn).forEach(function(sku) {
    const L = learn[sku];
    if (ultima[sku] && (!L.ultima_fecha_procesada || ultima[sku] > L.ultima_fecha_procesada)) L.ultima_fecha_procesada = ultima[sku];
    const validas = obs.filter(function(o) { return o.sku === sku && o.tipo === 'CONSUMO' && o.incorporada === 'SI' && o.fuente !== 'PRODUCCION_SEED'; });
    let span = 0;
    if (validas.length) {
      const mn = validas.reduce(function(a, o) { return o.fecha_inicial < a ? o.fecha_inicial : a; }, validas[0].fecha_inicial);
      const mx = validas.reduce(function(a, o) { return o.fecha_final > a ? o.fecha_final : a; }, validas[0].fecha_final);
      span = Math.round((fcParseDay_(mx) - fcParseDay_(mn)) / 86400000) + 1;
    }
    const cat = catBy[sku] || {};
    const concOk = Math.abs(Number(cat.dif_conteo_vs_teorico || 0)) <= Number(P.TOLERANCIA_CONCILIACION);
    L.observaciones_validas = validas.length;
    const c = fcConfidence_(validas.length, span, concOk, P);
    if (L.confianza !== c && L.fecha_actualizacion) L.fecha_actualizacion = ahora;
    L.confianza = c;
  });

  fcWriteTable_('obs', obs);
  fcWriteTable_('learning', Object.keys(learn).map(function(k) { return learn[k]; }));
  fcAppend_('learnHist', hist);
  return resumen;
}

// ---- Historial, Precisión (WAPE) y Nuevas Rutas de Administración (v3.0) ----

function fcSnapshot_(ctx, rows) {
  const runId = 'FC-' + Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss');
  fcAppend_('history', rows.map(function(r) {
    return {
      run_id: runId, fecha: ctx.hoy, sku: r.sku, tasa_diaria: r.tasa_diaria === null ? '' : r.tasa_diaria,
      demanda_7d: r.demanda_7d === null ? '' : r.demanda_7d, demanda_estimada: r.demanda_cobertura_9d === null ? '' : r.demanda_cobertura_9d,
      stock_proyectado: r.stock_fisico, fecha_agotamiento: r.fecha_agotamiento || '', compra_sugerida: r.cantidad_sugerida,
      confianza: r.confianza, alerta: r.alerta.nivel, version: FC.VERSION,
    };
  }));
  return runId;
}

function fcRunWeeklyFeedback_(ctx) {
  const P = ctx.P; const mode = P.DIAS_MODO; const rev = Number(P.REVISION_DIAS);
  const hist = fcRead_('history').rows; if (!hist.length) return { registrados: 0 };
  const objetivo = fcAddDays_(ctx.hoy, -(rev + 1));
  let fechaRun = null;
  hist.forEach(function(h) { if (h.fecha <= objetivo && (!fechaRun || h.fecha > fechaRun)) fechaRun = h.fecha; });
  if (!fechaRun) return { registrados: 0, nota: 'Aún no hay un pronóstico con ' + rev + ' días de antigüedad.' };
  const fin = fcAddOpDays_(fechaRun, rev, mode); if (fin >= ctx.hoy) return { registrados: 0 };
  const ini = fcNextOp_(fechaRun, mode);
  const fbT = fcRead_('feedback'); const ya = {}; fbT.rows.forEach(function(f) { ya[f.id_pronostico] = 1; });
  const lastRun = {};
  hist.filter(function(h) { return h.fecha === fechaRun; }).forEach(function(h) { lastRun[h.sku] = h; });
  const nuevos = [];
  Object.keys(lastRun).forEach(function(sku) {
    const h = lastRun[sku]; const id = h.run_id + '|' + sku;
    if (ya[id] || h.demanda_7d === '') return;
    const real = Math.max(0, fcNet_(ctx.movsBySku[sku], ini, fin));
    const prev = Number(h.demanda_7d);
    if (prev === 0 && real === 0) return;
    nuevos.push({
      id_pronostico: id, run_id: h.run_id, sku: sku, consumo_previsto: prev, consumo_real: real,
      error_abs: fcRound_(prev - real, 2), error_pct: real > 0 ? fcRound_((prev - real) / real * 100, 1) : '',
      observaciones: 'Cierre semanal ' + ini + '→' + fin + (h.alerta === 'ROJO' ? ' (estaba en ROJO)' : ''),
      fecha_conciliacion: ctx.hoy,
    });
  });
  fcAppend_('feedback', nuevos);
  return { registrados: nuevos.length, semana: ini + ' → ' + fin };
}

function registerForecastFeedback_(p, user) {
  if (!p || !p.run_id || !p.sku || p.consumo_real === undefined) throw appError_('VALIDATION', 'Requiere run_id, sku y consumo_real.');
  const h = fcRead_('history').rows.filter(function(r) { return r.run_id === p.run_id && r.sku === p.sku; })[0];
  if (!h) throw appError_('NOT_FOUND', 'No existe esa ejecución/SKU en Forecast_History.');
  const real = Number(p.consumo_real); const prev = Number(h.demanda_7d || 0);
  const row = {
    id_pronostico: p.run_id + '|' + p.sku, run_id: p.run_id, sku: p.sku, consumo_previsto: prev, consumo_real: real,
    error_abs: fcRound_(prev - real, 2), error_pct: real > 0 ? fcRound_((prev - real) / real * 100, 1) : '',
    observaciones: p.observaciones || '', fecha_conciliacion: fcToday_(),
  };
  fcAppend_('feedback', [row]);
  logAudit_(user, 'CREATE', 'forecast_feedback', row.id_pronostico, null, row);
  return row;
}

function getForecastFeedback_(p) {
  let rows = fcRead_('feedback').rows;
  if (p && p.sku) rows = rows.filter(function(r) { return r.sku === p.sku; });
  const act = rows.reduce(function(a, r) { return a + Number(r.consumo_real || 0); }, 0);
  const err = rows.reduce(function(a, r) { return a + Math.abs(Number(r.error_abs || 0)); }, 0);
  return { wape_pct: act > 0 ? fcRound_(err / act * 100, 1) : null, nota: 'WAPE = Σ|error| / Σ consumo real. Menor es mejor.', total: rows.length, rows: rows };
}

function getLearningHistory_(p) {
  const sku = p && p.sku;
  const f = function(r) { return !sku || r.sku === sku; };
  return {
    aprendizaje_actual: fcRead_('learning').rows.filter(f),
    historial: fcRead_('learnHist').rows.filter(f),
    observaciones: fcRead_('obs').rows.filter(f),
  };
}

function getForecastHistory_(p) {
  p = p || {};
  let rows = fcRead_('history').rows;
  if (p.sku) rows = rows.filter(function(r) { return String(r.sku).toUpperCase() === String(p.sku).toUpperCase(); });
  if (p.desde) rows = rows.filter(function(r) { return String(r.fecha) >= String(p.desde); });
  if (p.hasta) rows = rows.filter(function(r) { return String(r.fecha) <= String(p.hasta); });
  const limit = Number(p.limit || 500);
  if (rows.length > limit) rows = rows.slice(-limit);
  return { total: rows.length, rows: rows };
}

function getForecastParamsApi_() {
  return { params: fcParams_(), rows: fcRead_('params').rows };
}

function updateForecastParamsApi_(p, user) {
  const updates = p && p.updates;
  if (!updates || typeof updates !== 'object') throw appError_('VALIDATION', 'Debe enviar updates como objeto { clave: valor }.');
  const lock = LockService.getScriptLock(); lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);
  try {
    const t = fcRead_('params');
    const byKey = {}; t.rows.forEach(function(r) { byKey[r.clave] = r; });
    Object.keys(updates).forEach(function(k) {
      if (byKey[k]) {
        byKey[k].valor = updates[k];
      } else {
        t.rows.push({ clave: k, valor: updates[k], nota: 'Agregado desde API' });
      }
    });
    fcWriteTable_('params', t.rows);
    logAudit_(user, 'UPDATE', 'forecast_params', 'batch', null, updates);
    return getForecastParamsApi_();
  } finally { lock.releaseLock(); }
}

function getForecastConfigApi_(p) {
  p = p || {};
  let rows = fcRead_('config').rows;
  if (p.sku) rows = rows.filter(function(r) { return String(r.sku).toUpperCase() === String(p.sku).toUpperCase(); });
  return { total: rows.length, rows: rows };
}

function updateForecastConfigApi_(p, user) {
  if (!p || !p.sku || !p.changes) throw appError_('VALIDATION', 'Debe indicar sku y changes.');
  const lock = LockService.getScriptLock(); lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);
  try {
    const t = fcRead_('config');
    const row = t.rows.filter(function(r) { return String(r.sku).toUpperCase() === String(p.sku).toUpperCase(); })[0];
    if (!row) throw appError_('NOT_FOUND', 'SKU no encontrado en Forecast_Config: ' + p.sku);
    const allowedFields = ['modo_prediccion', 'dias_seguridad', 'dias_revision', 'factor_aprendizaje', 'lead_time', 'empaque', 'minimo_compra', 'maximo_entrega', 'grupo_usuario', 'modo_consumo', 'notas'];
    const before = Object.assign({}, row);
    allowedFields.forEach(function(f) {
      if (p.changes[f] !== undefined) row[f] = p.changes[f];
    });
    fcWriteTable_('config', t.rows);
    logAudit_(user, 'UPDATE', 'forecast_config', row.sku, before, row);
    return { row: row };
  } finally { lock.releaseLock(); }
}

function getForecastBomApi_(p) {
  p = p || {};
  let rows = fcRead_('bom').rows;
  if (p.modelo) rows = rows.filter(function(r) { return String(r.modelo).toUpperCase() === String(p.modelo).toUpperCase(); });
  if (p.sku) rows = rows.filter(function(r) { return String(r.sku).toUpperCase() === String(p.sku).toUpperCase(); });
  return { total: rows.length, rows: rows };
}

function upsertForecastBomApi_(p, user) {
  if (!p || !p.modelo || !p.sku || !(Number(p.cantidad_por_puerta) > 0)) {
    throw appError_('VALIDATION', 'Requiere modelo, sku y cantidad_por_puerta > 0.');
  }
  validateSkuExists_(p.sku);
  const lock = LockService.getScriptLock(); lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);
  try {
    const t = fcRead_('bom');
    const mod = String(p.modelo).trim().toUpperCase();
    const sku = String(p.sku).trim().toUpperCase();
    const idx = t.rows.findIndex(function(r) { return String(r.modelo).trim().toUpperCase() === mod && String(r.sku).trim().toUpperCase() === sku; });
    const rec = { modelo: mod, sku: sku, cantidad_por_puerta: Number(p.cantidad_por_puerta), notas: p.notas || '' };
    if (idx >= 0) t.rows[idx] = rec; else t.rows.push(rec);
    fcWriteTable_('bom', t.rows);
    logAudit_(user, idx >= 0 ? 'UPDATE' : 'CREATE', 'bom_puertas', mod + '|' + sku, null, rec);
    return { row: rec };
  } finally { lock.releaseLock(); }
}

function deleteForecastBomApi_(p, user) {
  if (!p || !p.modelo || !p.sku) throw appError_('VALIDATION', 'Requiere modelo y sku para eliminar de BOM_Puertas.');
  const lock = LockService.getScriptLock(); lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);
  try {
    const t = fcRead_('bom');
    const mod = String(p.modelo).trim().toUpperCase();
    const sku = String(p.sku).trim().toUpperCase();
    const next = t.rows.filter(function(r) { return !(String(r.modelo).trim().toUpperCase() === mod && String(r.sku).trim().toUpperCase() === sku); });
    if (next.length === t.rows.length) throw appError_('NOT_FOUND', 'No existe esa combinación modelo/sku en BOM_Puertas.');
    fcWriteTable_('bom', next);
    logAudit_(user, 'DELETE', 'bom_puertas', mod + '|' + sku, null, null);
    return { deleted: true, modelo: mod, sku: sku };
  } finally { lock.releaseLock(); }
}

// ---- Alertas por Correo, Trigger Diario y Setup -----------------------------

function fcSendAlerts_(ctx, rows) {
  const to = String(ctx.P.ALERTAS_EMAIL || '').trim(); if (!to) return false;
  const crit = rows.filter(function(r) { return r.alerta.nivel === 'ROJO' || r.alerta.nivel === 'NARANJA'; }).slice(0, 40);
  if (!crit.length) return false;
  const body = crit.map(function(r) {
    return '[' + r.alerta.nivel + '] ' + r.sku + ' — ' + r.descripcion + '\n   Stock: ' + r.stock_fisico + ' ' + (r.unidad || '') +
      ' | Consumo: ' + (r.tasa_diaria === null ? 's/d' : r.tasa_diaria + '/día') + ' | Agota: ' + (r.fecha_agotamiento || '—') +
      ' | Sugerido: ' + r.cantidad_sugerida + '\n   ' + r.alerta.causa + '\n   → ' + r.alerta.accion;
  }).join('\n\n');
  try {
    MailApp.sendEmail(to, 'DICORMS ' + ctx.hoy + ' — ' + crit.length + ' materiales en riesgo de agotamiento', body);
    return true;
  } catch (e) {
    return false;
  }
}

function runDailyForecast() {
  const lock = LockService.getScriptLock(); lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);
  try {
    let ctx = fcBuildContext_();
    const aprendizaje = fcRunLearning_(ctx, { username: 'system', role: 'admin' }, null);
    ctx = fcBuildContext_();
    const rows = fcComputeAll_(ctx, false);
    const runId = fcSnapshot_(ctx, rows);
    let feedback = null;
    if (fcDayOfWeek_(ctx.hoy) === Number(ctx.P.DIA_FEEDBACK)) feedback = fcRunWeeklyFeedback_(ctx);
    const correo = fcSendAlerts_(ctx, rows);
    return { run_id: runId, resumen: fcSummary_(rows), aprendizaje: aprendizaje, feedback: feedback, correo_enviado: correo };
  } finally { lock.releaseLock(); }
}

function installForecastTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runDailyForecast') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runDailyForecast')
    .timeBased()
    .everyDays(1)
    .atHour(5)
    .nearMinute(30)
    .inTimezone(SCRIPT_CONFIG.TIMEZONE)
    .create();
  return 'Trigger diario instalado (≈5:30 a.m. ' + SCRIPT_CONFIG.TIMEZONE + ')';
}

function setupForecast() { return fcSetup_({ username: 'setup', role: 'admin' }); }

function fcSetup_(user) {
  const lock = LockService.getScriptLock(); lock.waitLock(SCRIPT_CONFIG.LOCK_TIMEOUT_MS);
  try {
    const report = { hojas: [], semillas: [], skus_sin_catalogo: [], config_agregada: 0 };
    Object.keys(FC_TABLES).forEach(function(k) { fcTable_(k, true); report.hojas.push(FC_TABLES[k].name); });

    const pT = fcRead_('params'); const have = {}; pT.rows.forEach(function(r) { have[r.clave] = 1; });
    fcAppend_('params', FC_DEFAULT_PARAMS.filter(function(d) { return !have[d[0]]; }).map(function(d) {
      return { clave: d[0], valor: d[1], nota: d[2] };
    }));

    const catalog = listEntity_('catalogo', { pageSize: 5000 }).rows.filter(function(r) { return r.sku; });
    const cT = fcRead_('config'); const cHave = {}; cT.rows.forEach(function(r) { cHave[r.sku] = 1; });
    const vigil = {}; FC_SEEDS.forEach(function(s) { if (s.tipo === 'VIGILANCIA') vigil[s.sku] = 1; });
    catalog.forEach(function(c) {
      if (cHave[c.sku]) return;
      cT.rows.push({
        sku: c.sku, unidad: c.unidad, modo_prediccion: vigil[c.sku] ? 'VIGILANCIA' : 'AUTO',
        dias_seguridad: '', dias_revision: '', factor_aprendizaje: '', lead_time: '',
        empaque: 1, minimo_compra: 0, maximo_entrega: 0,
        grupo_usuario: fcGroupFor_(c.descripcion, c.categoria, ''),
        modo_consumo: '',
        notas: 'modo_consumo: vacío = automático (solo grupo Insumos); SALIDA = forzar; NINGUNO = excluir',
      });
      report.config_agregada++;
    });
    fcWriteTable_('config', cT.rows);

    const oT = fcRead_('obs'); const lT = fcRead_('learning'); const lHave = {}; lT.rows.forEach(function(r) { lHave[r.sku] = r; });
    const catBy = {}; catalog.forEach(function(c) { catBy[c.sku] = c; });
    const ahora = Utilities.formatDate(new Date(), SCRIPT_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    FC_SEEDS.forEach(function(s) {
      if (!catBy[s.sku]) { report.skus_sin_catalogo.push(s.alias + ' (' + s.sku + ')'); return; }
      const id = 'SEED-' + s.sku;
      if (oT.rows.some(function(o) { return o.id === id; })) return;
      if (s.tipo === 'CONSUMO') {
        const tasa = s.cantidad / s.dias;
        oT.rows.push({
          id: id, sku: s.sku, fecha_inicial: '', fecha_final: '', cantidad: s.cantidad, dias_observados: s.dias,
          ubicacion: 'Todos', proyecto: '', fuente: 'PRODUCCION_SEED', tipo: 'CONSUMO', validacion: 'PROVISIONAL',
          observaciones: s.alias + ': dato inicial de producción', tasa_observada: tasa, incorporada: 'N/A',
        });
        if (!lHave[s.sku]) {
          lT.rows.push({
            sku: s.sku, tasa_inicial: tasa, tasa_aprendida: tasa, factor_aprendizaje: P_DEFAULT_ALPHA_(),
            observaciones_validas: 0, confianza: 'BAJA', fecha_actualizacion: ahora, version: FC.VERSION,
            desviacion_abs: 0, ultima_fecha_procesada: '', origen_tasa: 'SEED',
          });
        }
        report.semillas.push(s.alias + ' → ' + s.sku + ' = ' + tasa + '/día PROVISIONAL');
      } else if (s.tipo === 'FALTANTE') {
        oT.rows.push({
          id: id, sku: s.sku, fecha_inicial: fcToday_(), fecha_final: fcToday_(), cantidad: s.cantidad,
          dias_observados: '', ubicacion: 'Todos', proyecto: '', fuente: 'PRODUCCION_SEED', tipo: 'FALTANTE',
          validacion: 'PENDIENTE_CONTEO', observaciones: s.alias + ': faltante reportado, pendiente de conteo físico',
          tasa_observada: '', incorporada: 'N/A',
        });
        report.semillas.push(s.alias + ' → ' + s.sku + ' faltante ' + s.cantidad + ' (pendiente de conteo)');
      } else {
        oT.rows.push({
          id: id, sku: s.sku, fecha_inicial: '', fecha_final: '', cantidad: '', dias_observados: '',
          ubicacion: 'Todos', proyecto: '', fuente: 'PRODUCCION_SEED', tipo: 'VIGILANCIA', validacion: 'PROVISIONAL',
          observaciones: s.alias + ': ' + (s.nota || 'alta rotación'), tasa_observada: '', incorporada: 'N/A',
        });
        report.semillas.push(s.alias + ' → ' + s.sku + ' en VIGILANCIA (sin tasa)');
      }
    });
    fcWriteTable_('obs', oT.rows);
    fcWriteTable_('learning', lT.rows);
    logAudit_(user, 'SETUP', 'forecast', 'setup', null, report);
    return report;
  } finally { lock.releaseLock(); }
}

function P_DEFAULT_ALPHA_() { return 0.2; }