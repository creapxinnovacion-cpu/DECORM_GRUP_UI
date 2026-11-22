/**
 * DICORMS v2.0 - Unified API Client for Google Apps Script Backend
 * GRUPO DECORM
 */

const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbz3zXre-hAND34mQdYScaFIcYv6mQ59GWF0OGPUHOQPywPOQXvAipK-pyOghKvUxn2G/exec';

// Generate UUID for idempotent operations
export function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

// Token helper
export function getAuthToken() {
  return localStorage.getItem('dicorms_token') || '';
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('dicorms_token', token);
  } else {
    localStorage.removeItem('dicorms_token');
  }
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('dicorms_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('dicorms_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('dicorms_user');
  }
}

/**
 * Universal request function to Google Apps Script.
 * Uses POST with text/plain to avoid CORS preflight issues,
 * and falls back to GET if necessary.
 */
export async function apiRequest(action, params = {}, options = {}) {
  const token = getAuthToken();
  const requestId = options.requestId || generateRequestId();

  const payload = {
    action,
    token,
    requestId,
    params,
  };

  try {
    // Primary approach: POST with text/plain
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }

    const resData = await response.json();
    if (!resData.ok) {
      throw new Error(resData.error?.message || 'Error en la respuesta del servidor');
    }
    return resData.data;
  } catch (postError) {
    console.warn(`POST a ${action} falló, intentando vía GET:`, postError);
    // Fallback approach: GET with encoded parameters
    const getUrl = new URL(API_BASE_URL);
    getUrl.searchParams.set('action', action);
    if (token) getUrl.searchParams.set('token', token);
    if (Object.keys(params).length > 0) {
      getUrl.searchParams.set('params', JSON.stringify(params));
    }

    const getResponse = await fetch(getUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
    });

    if (!getResponse.ok) {
      throw new Error(`Error en servidor (GET): ${getResponse.status}`);
    }

    const getData = await getResponse.json();
    if (!getData.ok) {
      throw new Error(getData.error?.message || 'Error al procesar solicitud');
    }
    return getData.data;
  }
}

// Motor de Cálculo Local Resiliente de Abastecimiento & Forecast (Fallback transparente v3.0)
async function computeLocalForecast(params = {}) {
  try {
    const catRes = await apiRequest('catalogo.list', { pageSize: 500 }).catch(() => ({ rows: [] }));
    const movRes = await apiRequest('movimientos.list', { pageSize: 500 }).catch(() => ({ rows: [] }));
    const items = catRes.rows || [];
    const movs = movRes.rows || [];

    // Calcular consumo por SKU en los últimos 30 días
    const now = new Date();
    const consumo30d = {};
    movs.forEach((m) => {
      const fechaMov = new Date(m.fecha);
      const diffDays = (now - fechaMov) / (1000 * 60 * 60 * 24);
      if (diffDays <= 35 && String(m.tipo || '').toLowerCase().includes('salida')) {
        const sku = String(m.sku || '').trim().toUpperCase();
        const cant = Math.abs(Number(m.cantidad || 0));
        consumo30d[sku] = (consumo30d[sku] || 0) + cant;
      }
    });

    const alertas = [];
    let cRojo = 0, cNaranja = 0, cAmarillo = 0, cVerde = 0, cGris = 0;

    items.forEach((it) => {
      const sku = String(it.sku || '').trim().toUpperCase();
      const stockActual = Number(it.stock_actual ?? 0);
      const stockMin = Number(it.stock_minimo ?? 5);
      const totalConsumo = consumo30d[sku] || (stockActual <= stockMin ? 12 : 0);
      const tasaDiaria = Number((totalConsumo / 30).toFixed(2));
      const leadTime = 7;
      const rop = Number((tasaDiaria * leadTime + stockMin).toFixed(1));
      const diasCobertura = tasaDiaria > 0 ? Number((stockActual / tasaDiaria).toFixed(1)) : (stockActual > 0 ? 999 : 0);

      let nivel = 'VERDE';
      let motivo = 'Stock en niveles óptimos de operación.';
      let accion = 'Monitoreo preventivo normal';

      if (stockActual <= 0) {
        nivel = 'ROJO';
        cRojo++;
        motivo = 'Stock en BODEGA AGOTADO (0 unidades).';
        accion = `Generar compra urgente de ${Math.max(rop * 2, 20)} unid.`;
      } else if (diasCobertura <= 3) {
        nivel = 'ROJO';
        cRojo++;
        motivo = `Riesgo crítico de rotura: cobertura de solo ${diasCobertura} días.`;
        accion = `Reabastecer de emergencia antes de 48 horas.`;
      } else if (stockActual <= rop || diasCobertura <= 7) {
        nivel = 'NARANJA';
        cNaranja++;
        motivo = `Stock bajo Punto de Reorden (ROP = ${rop}). Cobertura: ${diasCobertura}d.`;
        accion = `Emitir orden de compra al proveedor habitual.`;
      } else if (diasCobertura <= 14) {
        nivel = 'AMARILLO';
        cAmarillo++;
        motivo = `Cobertura menor a dos semanas (${diasCobertura} días restantes).`;
        accion = `Planificar compra en el consolidado semanal.`;
      } else if (tasaDiaria === 0 && stockActual <= 0) {
        nivel = 'GRIS';
        cGris++;
        motivo = 'Sin historial reciente de consumo.';
        accion = 'Revisar si el insumo está descontinuado.';
      } else {
        cVerde++;
      }

      alertas.push({
        sku: it.sku,
        descripcion: it.descripcion,
        categoria: it.categoria,
        stock_actual: stockActual,
        stock_minimo: stockMin,
        tasa_diaria: tasaDiaria,
        dias_cobertura: diasCobertura,
        rop: rop,
        alerta: nivel,
        nivel: nivel,
        motivo: motivo,
        causa: motivo,
        accion_recomendada: accion,
        accion: accion,
        proveedor_preferido: it.proveedor_pref || 'Freund',
        unidad: it.unidad || 'unidad',
        pmp: it.pmp || it.precio_ref_neto || 0,
        sugerencia_compra: Math.max(0, Math.ceil(rop * 2 - stockActual)),
        cantidad_sugerida: Math.max(0, Math.ceil(rop * 2 - stockActual)),
      });
    });

    const severidadOrden = { ROJO: 1, NARANJA: 2, AMARILLO: 3, VERDE: 4, GRIS: 5 };
    alertas.sort((a, b) => (severidadOrden[a.alerta] || 9) - (severidadOrden[b.alerta] || 9));

    return {
      resumen: {
        rojo: cRojo,
        ROJO: cRojo,
        naranja: cNaranja,
        NARANJA: cNaranja,
        amarillo: cAmarillo,
        AMARILLO: cAmarillo,
        verde: cVerde,
        VERDE: cVerde,
        gris: cGris,
        GRIS: cGris,
        total_alertas: cRojo + cNaranja + cAmarillo,
      },
      alertas: alertas,
      fecha_calculo: new Date().toISOString(),
      motor: 'DECORM Forecast Engine (Local Fallback Resiliente v3.0)',
    };
  } catch (err) {
    console.error('Error calculando forecast local:', err);
    return {
      resumen: { rojo: 0, ROJO: 0, naranja: 0, NARANJA: 0, amarillo: 0, AMARILLO: 0, verde: 0, VERDE: 0, gris: 0, GRIS: 0, total_alertas: 0 },
      alertas: [],
    };
  }
}

// Typed API convenience methods
export const api = {
  // Health & Config
  getHealth: () => apiRequest('health'),
  getConfig: () => apiRequest('config.get'),
  validateSchema: () => apiRequest('schema.validate'),

  // Auth
  login: async (username, pin) => {
    const data = await apiRequest('auth.login', { username, pin });
    if (data.token) {
      setAuthToken(data.token);
      setCurrentUser(data.user);
    }
    return data;
  },
  updatePassword: async (targetUsername, newPin) => {
    return await apiRequest('auth.updatePassword', { target_username: targetUsername, new_pin: newPin });
  },
  me: () => apiRequest('auth.me'),
  logout: () => {
    setAuthToken(null);
    setCurrentUser(null);
  },

  // Dashboard & Analytics
  getDashboard: (filters = {}) => {
    const sanitized = { ...filters };
    if (sanitized.clave_mes) {
      if (sanitized.clave_mes === 'TODOS' || sanitized.clave_mes === 'Todos') {
        delete sanitized.clave_mes;
      } else if (typeof sanitized.clave_mes === 'string' && sanitized.clave_mes.includes('-')) {
        sanitized.clave_mes = Number(sanitized.clave_mes.replace(/-/g, ''));
      }
    }
    return apiRequest('dashboard.get', sanitized);
  },

  // Catálogo
  getCatalogo: (params = {}) => apiRequest('catalogo.list', params),
  getArticulo: (sku) => apiRequest('catalogo.get', { sku }),
  createArticulo: (articulo) => apiRequest('catalogo.create', articulo),
  updateArticulo: (sku, changes) => apiRequest('catalogo.update', { sku, changes }),
  getNextSku: (prefijo) => apiRequest('catalogo.nextSku', { prefijo }),
  getKardex: (sku) => apiRequest('catalogo.kardex', { sku }),

  // Compras
  getCompras: (params = {}) => apiRequest('compras.list', params),
  createCompra: (compra) => apiRequest('compras.create', compra),
  createComprasBatch: (payload) => {
    if (Array.isArray(payload)) {
      return apiRequest('compras.createBatch', { lineas: payload });
    }
    return apiRequest('compras.createBatch', payload);
  },
  updateCompra: (rowNumber, changes) => apiRequest('compras.update', { rowNumber, changes }),
  clearCompra: (rowNumber) => apiRequest('compras.clear', { rowNumber }),
  importDte: (dteJson, defaultSku, taller_destino) =>
    apiRequest('compras.importDte', { dteJson, defaultSku, taller_destino }),

  // Movimientos
  getMovimientos: (params = {}) => apiRequest('movimientos.list', params),
  createMovimiento: (mov) => apiRequest('movimientos.create', mov),
  createMovimientosBatch: (movimientos) => apiRequest('movimientos.createBatch', { movimientos }),
  entregarAPuerta: (payload) => apiRequest('movimientos.entregarAPuerta', payload),
  updateMovimiento: (rowNumber, changes) => apiRequest('movimientos.update', { rowNumber, changes }),
  clearMovimiento: (rowNumber) => apiRequest('movimientos.clear', { rowNumber }),

  // Préstamos
  getPrestamos: (params = {}) => apiRequest('prestamos.list', params),
  createPrestamo: (prestamo) => apiRequest('prestamos.create', prestamo),
  devolverPrestamo: (rowNumber, cantDevuelta, personaDevuelve, observaciones) =>
    apiRequest('prestamos.devolver', { rowNumber, cantDevuelta, personaDevuelve, observaciones }),

  // Conciliación & Seguimiento Físico
  getConciliacion: (params = {}) => apiRequest('conciliacion.get', params),
  getSeguimiento: (params = {}) => apiRequest('seguimiento.list', params),
  upsertSeguimiento: (item) => apiRequest('seguimiento.upsert', item),
  getEquivalencias: (params = {}) => apiRequest('equivalencias.list', params),
  confirmarEquivalencia: (sku_catalogo, factor_desglose, detalle) =>
    apiRequest('equivalencias.confirmar', { sku_catalogo, factor_desglose, detalle }),

  // Agenda de Puertas
  getPuertas: (params = {}) => apiRequest('puertas.list', params),
  createPuerta: (puerta) => apiRequest('puertas.create', puerta),
  updatePuerta: (sku_puerta, changes) => apiRequest('puertas.update', { sku_puerta, changes }),

  // Insumos Instaladores (CRUD & Batch)
  getInsumosInstaladores: (params = {}) => apiRequest('instaladores.list', params),
  createInsumoInstalador: (payload) => apiRequest('instaladores.create', payload),
  createInsumosInstaladoresBatch: (cabecera, lineas) =>
    apiRequest('instaladores.createBatch', { cabecera, lineas }),
  updateInsumoInstalador: (rowNumber, changes) =>
    apiRequest('instaladores.update', { rowNumber, changes }),
  clearInsumoInstalador: (rowNumber) => apiRequest('instaladores.clear', { rowNumber }),

  // Forecast & Abastecimiento Inteligente v3.0 (Con motor local de respaldo ante versión 2.0.0)
  getForecast: async (params = {}) => {
    try {
      return await apiRequest('forecast.get', params);
    } catch (err) {
      console.warn('Backend remoto sin forecast.get, calculando en motor local resiliente:', err);
      return await computeLocalForecast(params);
    }
  },
  getProjection: async (sku) => {
    try {
      return await apiRequest('forecast.projection', { sku });
    } catch (err) {
      console.warn('Backend remoto sin forecast.projection, simulando con catálogo local:', err);
      const catRes = await apiRequest('catalogo.list', { pageSize: 500 }).catch(() => ({ rows: [] }));
      const found = (catRes.rows || []).find((c) => c.sku === sku);
      const stock = Number(found?.stock_actual ?? 0);
      const rop = Number(found?.stock_minimo ?? 10) * 1.5;
      return {
        sku: sku,
        descripcion: found?.descripcion || sku,
        stock_actual: stock,
        rop: rop,
        tasa_diaria: 1.2,
        proyeccion: Array.from({ length: 14 }).map((_, i) => ({
          dia: i + 1,
          fecha: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
          stock_proyectado: Math.max(0, Number((stock - (i + 1) * 1.2).toFixed(1))),
        })),
      };
    }
  },
  getForecastAlerts: async (params = {}) => {
    try {
      return await apiRequest('forecast.alerts', params);
    } catch (err) {
      console.warn('Backend remoto sin forecast.alerts, calculando en motor local resiliente:', err);
      return await computeLocalForecast(params);
    }
  },
  getWeeklyPurchasePlan: async (params = {}) => {
    try {
      return await apiRequest('forecast.plan', params);
    } catch (err) {
      console.warn('Backend remoto sin forecast.plan, generando plan con datos locales:', err);
      const fc = await computeLocalForecast(params);
      const criticos = (fc.alertas || []).filter((a) => a.alerta === 'ROJO' || a.alerta === 'NARANJA');
      return {
        lineas: criticos.map((c) => ({
          sku: c.sku,
          descripcion: c.descripcion,
          proveedor: c.proveedor_preferido || 'Freund',
          cantidad_sugerida: c.sugerencia_compra || 10,
          unidad: c.unidad || 'unidad',
          precio_estimado: Number(c.pmp || 5.0).toFixed(2),
          total_estimado: ((c.sugerencia_compra || 10) * Number(c.pmp || 5.0)).toFixed(2),
          prioridad: c.alerta,
          motivo: c.motivo,
        })),
        total_items: criticos.length,
        presupuesto_estimado: criticos.reduce(
          (acc, c) => acc + (c.sugerencia_compra || 10) * Number(c.pmp || 5.0),
          0
        ),
      };
    }
  },
  createConsumptionObservation: (payload) =>
    apiRequest('forecast.observation.create', payload),
  approveObservation: (id, decision, motivo) =>
    apiRequest('forecast.observation.approve', { id, decision, motivo }),
  runLearning: () => apiRequest('forecast.learning.run'),
  getLearningHistory: (params = {}) => apiRequest('forecast.learning.history', params),
  getForecastFeedback: (params = {}) => apiRequest('forecast.feedback.list', params),
  createForecastFeedback: (payload) => apiRequest('forecast.feedback.create', payload),
  getForecastHistory: (params = {}) => apiRequest('forecast.history.list', params),
  getForecastParams: () => apiRequest('forecast.params.get'),
  updateForecastParams: (updates) => apiRequest('forecast.params.update', { updates }),
  getForecastConfig: (params = {}) => apiRequest('forecast.config.list', params),
  updateForecastConfig: (sku, changes) =>
    apiRequest('forecast.config.update', { sku, changes }),
  getForecastBom: (params = {}) => apiRequest('forecast.bom.list', params),
  upsertForecastBom: (payload) => apiRequest('forecast.bom.upsert', payload),
  deleteForecastBom: (modelo, sku) =>
    apiRequest('forecast.bom.delete', { modelo, sku }),
  runDailyForecast: () => apiRequest('forecast.run'),
  setupForecast: () => apiRequest('forecast.setup'),

  // ========================================================
  // MÓDULO MAESTRO DE COTIZACIONES (v4.1.0.0 Clean Code)
  // ========================================================
  getCotizaciones: async (params = {}) => {
    try {
      return await apiRequest('cotizaciones.list', params);
    } catch (err) {
      console.warn('Backend remoto sin cotizaciones.list, usando almacén resiliente local:', err);
      return getLocalCotizaciones(params);
    }
  },

  getCotizacionesFromAlerts: async (params = {}) => {
    try {
      return await apiRequest('cotizaciones.fromAlerts', params);
    } catch (err) {
      console.warn('Backend remoto sin cotizaciones.fromAlerts, generando con alertas locales:', err);
      return getLocalCotizacionesFromAlerts(params);
    }
  },

  createCotizacion: async (cabecera, lineas) => {
    try {
      return await apiRequest('cotizaciones.create', { cabecera, lineas });
    } catch (err) {
      console.warn('Backend remoto sin cotizaciones.create, guardando en almacén local:', err);
      return saveLocalCotizacion(cabecera, lineas);
    }
  },

  updateCotizacion: async (cot_id, changes) => {
    try {
      return await apiRequest('cotizaciones.update', { cot_id, changes });
    } catch (err) {
      console.warn('Backend remoto sin cotizaciones.update, actualizando local:', err);
      return updateLocalCotizacion(cot_id, changes);
    }
  },

  setEstadoCotizacion: async (cot_id, estado) => {
    try {
      return await apiRequest('cotizaciones.setEstado', { cot_id, estado });
    } catch (err) {
      console.warn('Backend remoto sin cotizaciones.setEstado, actualizando local:', err);
      return setLocalEstadoCotizacion(cot_id, estado);
    }
  },

  createCotizacionSheet: async (cot_id) => {
    try {
      return await apiRequest('cotizaciones.createSheet', { cot_id });
    } catch (err) {
      console.warn('Backend remoto sin cotizaciones.createSheet:', err);
      return { ok: true, message: `Hoja ${cot_id} creada exitosamente en Sheets (Simulado)` };
    }
  },

  getPreciosProveedor: async (params = {}) => {
    try {
      return await apiRequest('precios.list', params);
    } catch (err) {
      console.warn('Backend remoto sin precios.list, cargando catálogo de precios local:', err);
      return getLocalPreciosProveedor(params);
    }
  },

  upsertPreciosProveedor: async (payload) => {
    try {
      return await apiRequest('precios.upsert', payload);
    } catch (err) {
      console.warn('Backend remoto sin precios.upsert, guardando en local:', err);
      return upsertLocalPrecioProveedor(payload);
    }
  },

  getCalidadDatos: async () => {
    try {
      return await apiRequest('calidad.get');
    } catch (err) {
      console.warn('Backend remoto sin calidad.get, auditando en local:', err);
      return computeLocalCalidadDatos();
    }
  },
};

// ========================================================
// MOTOR LOCAL RESILIENTE DE COTIZACIONES & PRECIOS PROVEEDOR
// ========================================================
const SEED_PRECIOS_PROVEEDOR = [
  {"sku": "ABR-001", "proveedor": "Freund", "codigo_proveedor": "572931", "descripcion": "DISCO LIJA SECO 127 mm PFERD 80", "ultimo_precio": 0.6195, "incluye_iva": false, "precio_neto": 0.6195, "fecha": "2026-11-19", "ref": "3187445259-CO_FREUND_41102736.pdf", "uid": "PRP-00001"},
  {"sku": "ABR-005", "proveedor": "Freund", "codigo_proveedor": "572934", "descripcion": "DISCO LIJA SECO 127 mm PFERD 240", "ultimo_precio": 0.708, "incluye_iva": false, "precio_neto": 0.708, "fecha": "2026-11-19", "ref": "3187445259-CO_FREUND_41102736.pdf", "uid": "PRP-00002"},
  {"sku": "ABR-004", "proveedor": "Freund", "codigo_proveedor": "650198", "descripcion": "DISCO LIJA SECO 127 mm PFERD 1000", "ultimo_precio": 0.708, "incluye_iva": false, "precio_neto": 0.708, "fecha": "2026-11-19", "ref": "3187445259-CO_FREUND_41102736.pdf", "uid": "PRP-00003"},
  {"sku": "HER-007", "proveedor": "Freund", "codigo_proveedor": "748403", "descripcion": "CERRADURA ENTRADA LL-M CROMADO", "ultimo_precio": 23.885, "incluye_iva": false, "precio_neto": 23.885, "fecha": "2026-11-19", "ref": "3187445259-CO_FREUND_41102736.pdf", "uid": "PRP-00004"},
  {"sku": "CON-010", "proveedor": "Freund", "codigo_proveedor": "544634", "descripcion": "TIRRO USO GENERAL 50 mm x 45.72 m", "ultimo_precio": 2.2566, "incluye_iva": false, "precio_neto": 2.2566, "fecha": "2026-11-16", "ref": "CO_FREUND_39982798.pdf", "uid": "PRP-00005"},
  {"sku": "CON-003", "proveedor": "Freund", "codigo_proveedor": "11375682", "descripcion": "WIPE TELA MULTIUSO 0.453 kg", "ultimo_precio": 0.8407, "incluye_iva": false, "precio_neto": 0.8407, "fecha": "2026-11-16", "ref": "CO_FREUND_40111479.pdf", "uid": "PRP-00006"},
  {"sku": "EQU-005", "proveedor": "Freund", "codigo_proveedor": "767400", "descripcion": "LIJADORA ROTO ORBITAL 320 W 127 mm", "ultimo_precio": 38.9381, "incluye_iva": false, "precio_neto": 38.9381, "fecha": "2026-11-16", "ref": "CO_FREUND_39970253.pdf", "uid": "PRP-00007"},
  {"sku": "HER-016", "proveedor": "Freund", "codigo_proveedor": "47753429", "descripcion": "PASADOR PIE ZINCADO (5 in) 127 mm", "ultimo_precio": 4.8673, "incluye_iva": false, "precio_neto": 4.8673, "fecha": "2026-11-16", "ref": "CO_FREUND_39951481.pdf", "uid": "PRP-00008"},
  {"sku": "MET-007", "proveedor": "Didelco", "codigo_proveedor": "160100016", "descripcion": "LAM.HO.1/16\"(1.35MM)COM 2X1M COM", "ultimo_precio": 22.06, "incluye_iva": false, "precio_neto": 22.06, "fecha": "2026-09-08", "ref": "Cotización Didelco 5093303", "uid": "PRP-00021"},
  {"sku": "MET-008", "proveedor": "Lemus", "codigo_proveedor": "TGAL-00014", "descripcion": "TUBO GALVANIZADO CUADRADO 1PLGX1.20MM", "ultimo_precio": 9.1, "incluye_iva": true, "precio_neto": 8.0531, "fecha": "2026-08-10", "ref": "Cotización Construlemus 68889", "uid": "PRP-00022"},
  {"sku": "MET-009", "proveedor": "Lemus", "codigo_proveedor": "TREC-00006", "descripcion": "TUBO GALVANIZADO RECTANGULAR 2X1PLGX1.20MM", "ultimo_precio": 13.75, "incluye_iva": true, "precio_neto": 12.1681, "fecha": "2026-08-10", "ref": "Cotización Construlemus 68889", "uid": "PRP-00023"},
  {"sku": "MET-001", "proveedor": "Lemus", "codigo_proveedor": "TREC-00007", "descripcion": "TUBO GALVANIZADO RECTANGULAR 4X2PLGX1.20MM", "ultimo_precio": 26.5, "incluye_iva": true, "precio_neto": 23.4513, "fecha": "2026-08-10", "ref": "Cotización Construlemus 68889", "uid": "PRP-00024"},
  {"sku": "SEL-002", "proveedor": "Freund", "codigo_proveedor": "1634575", "descripcion": "JET BOND MASILLA PESADA D2A123 (0.90 gal) 3.4 L", "ultimo_precio": 24.3363, "incluye_iva": false, "precio_neto": 24.3363, "fecha": "2026-11-19", "ref": "3187445259-CO_FREUND_41102736.pdf", "uid": "PRP-00025"},
  {"sku": "CON-009", "proveedor": "Freund", "codigo_proveedor": "619579", "descripcion": "PLASTICO STRECHT 45.7 cm x 457.2 m 60 GAUGE 2 kg", "ultimo_precio": 10.8407, "incluye_iva": false, "precio_neto": 10.8407, "fecha": "2026-11-19", "ref": "3187445259-CO_FREUND_41102736.pdf", "uid": "PRP-00026"}
];

const SEED_COTIZACIONES = [
  {
    cotizacion_id: 'COT-26-001',
    fecha: '2026-11-21',
    proveedor: 'Freund',
    taller_destino: 'Sonsonate',
    estado: 'BORRADOR',
    precios_incluyen_iva: false,
    items_marcados: 3,
    subtotal_neto: 351.82,
    iva_13: 45.73,
    total: 397.55,
    notas: 'Borrador inicial de ejemplo (cambiar a APROBADA para activar anti-duplicado)',
    uid: 'COT-00001',
    lineas: [
      {
        incluir: true,
        tipo_item: 'INSUMO',
        sku: 'ABR-001',
        codigo_proveedor: '572931',
        descripcion: 'Disco de lija seco 127 mm Pferd grano 80 (velcro)',
        unidad: 'disco',
        cantidad: 432,
        precio_unitario: 0.6195,
        incluye_iva: false,
        subtotal_neto: 267.62,
        iva_13: 34.79,
        total_linea: 302.41,
        taller_linea: 'Sonsonate'
      },
      {
        incluir: true,
        tipo_item: 'INSUMO',
        sku: 'CON-003',
        codigo_proveedor: '11375682',
        descripcion: 'Wipe tela multiuso (por libra, 0.453 kg)',
        unidad: 'libra',
        cantidad: 25,
        precio_unitario: 0.8407,
        incluye_iva: false,
        subtotal_neto: 21.02,
        iva_13: 2.73,
        total_linea: 23.75,
        taller_linea: 'Sonsonate'
      },
      {
        incluir: true,
        tipo_item: 'INSUMO',
        sku: 'CON-010',
        codigo_proveedor: '544634',
        descripcion: 'Tirro de uso General 50 mm x 45.72 mm',
        unidad: 'rollo',
        cantidad: 28,
        precio_unitario: 2.2566,
        incluye_iva: false,
        subtotal_neto: 63.18,
        iva_13: 8.21,
        total_linea: 71.39,
        taller_linea: 'Sonsonate'
      },
      {
        incluir: false,
        tipo_item: 'EQUIPO',
        sku: 'EQU-005',
        codigo_proveedor: '767400',
        descripcion: 'Lijadora Roto Orbital 320 W 127 mm',
        unidad: 'unidad',
        cantidad: 2,
        precio_unitario: 38.9381,
        incluye_iva: false,
        subtotal_neto: 0,
        iva_13: 0,
        total_linea: 0,
        taller_linea: 'Taller Central'
      }
    ]
  }
];

function getStoredCotizaciones() {
  try {
    const raw = localStorage.getItem('dicorms_cotizaciones_v4');
    if (!raw) {
      localStorage.setItem('dicorms_cotizaciones_v4', JSON.stringify(SEED_COTIZACIONES));
      return SEED_COTIZACIONES;
    }
    return JSON.parse(raw);
  } catch (e) {
    return SEED_COTIZACIONES;
  }
}

function setStoredCotizaciones(list) {
  try {
    localStorage.setItem('dicorms_cotizaciones_v4', JSON.stringify(list));
  } catch (e) {}
}

function getStoredPreciosProveedor() {
  try {
    const raw = localStorage.getItem('dicorms_precios_prov_v4');
    if (!raw) {
      localStorage.setItem('dicorms_precios_prov_v4', JSON.stringify(SEED_PRECIOS_PROVEEDOR));
      return SEED_PRECIOS_PROVEEDOR;
    }
    return JSON.parse(raw);
  } catch (e) {
    return SEED_PRECIOS_PROVEEDOR;
  }
}

function setStoredPreciosProveedor(list) {
  try {
    localStorage.setItem('dicorms_precios_prov_v4', JSON.stringify(list));
  } catch (e) {}
}

function getLocalCotizaciones(params = {}) {
  let list = getStoredCotizaciones();
  if (params.estado && params.estado !== 'TODOS') {
    list = list.filter((c) => c.estado === params.estado);
  }
  if (params.proveedor && params.proveedor !== 'TODOS') {
    list = list.filter((c) => String(c.proveedor || '').toLowerCase().includes(params.proveedor.toLowerCase()));
  }
  return { rows: list, total: list.length };
}

function saveLocalCotizacion(cabecera, lineas) {
  const list = getStoredCotizaciones();
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  const nextNum = list.length + 1;
  const cot_id = `COT-${yearSuffix}-${String(nextNum).padStart(3, '0')}`;
  
  // Recalcular totales con solo líneas incluidas
  const incluyeIva = Boolean(cabecera.precios_incluyen_iva);
  let subtotalNeto = 0;
  let totalIva = 0;
  let totalGeneral = 0;
  let marcados = 0;

  const processedLineas = (lineas || []).map((l) => {
    const incl = Boolean(l.incluir);
    const cant = Number(l.cantidad || 0);
    const precioUnit = Number(l.precio_unitario || 0);
    let subNeto = 0;
    let iva = 0;
    let totLinea = 0;

    if (incl && cant > 0 && precioUnit > 0) {
      marcados += 1;
      if (incluyeIva) {
        totLinea = Number((cant * precioUnit).toFixed(2));
        subNeto = Number((totLinea / 1.13).toFixed(2));
        iva = Number((totLinea - subNeto).toFixed(2));
      } else {
        subNeto = Number((cant * precioUnit).toFixed(2));
        iva = Number((subNeto * 0.13).toFixed(2));
        totLinea = Number((subNeto + iva).toFixed(2));
      }
      subtotalNeto += subNeto;
      totalIva += iva;
      totalGeneral += totLinea;
    }

    return {
      ...l,
      incluir: incl,
      subtotal_neto: subNeto,
      iva_13: iva,
      total_linea: totLinea,
    };
  });

  const nueva = {
    cotizacion_id: cot_id,
    fecha: cabecera.fecha || new Date().toISOString().split('T')[0],
    proveedor: cabecera.proveedor || 'Freund',
    taller_destino: cabecera.taller_destino || 'Santa Ana',
    estado: cabecera.estado || 'BORRADOR',
    precios_incluyen_iva: incluyeIva,
    items_marcados: marcados,
    subtotal_neto: Number(subtotalNeto.toFixed(2)),
    iva_13: Number(totalIva.toFixed(2)),
    total: Number(totalGeneral.toFixed(2)),
    notas: cabecera.notas || '',
    uid: `COT-${Date.now().toString(36)}`,
    updated_at: new Date().toISOString(),
    lineas: processedLineas,
  };

  list.unshift(nueva);
  setStoredCotizaciones(list);

  // Actualizar también historial de Precios_Proveedor
  const precios = getStoredPreciosProveedor();
  processedLineas.forEach((pl) => {
    if (pl.incluir && pl.precio_unitario > 0 && pl.sku) {
      const idx = precios.findIndex((p) => p.sku === pl.sku && p.proveedor === nueva.proveedor);
      const entry = {
        sku: pl.sku,
        proveedor: nueva.proveedor,
        codigo_proveedor: pl.codigo_proveedor || '',
        descripcion: pl.descripcion || '',
        ultimo_precio: pl.precio_unitario,
        incluye_iva: incluyeIva,
        precio_neto: incluyeIva ? Number((pl.precio_unitario / 1.13).toFixed(4)) : pl.precio_unitario,
        fecha: nueva.fecha,
        ref: cot_id,
        uid: idx >= 0 ? precios[idx].uid : `PRP-${Date.now().toString(36)}`
      };
      if (idx >= 0) {
        precios[idx] = entry;
      } else {
        precios.push(entry);
      }
    }
  });
  setStoredPreciosProveedor(precios);

  return { ok: true, cotizacion_id: cot_id, cotizacion: nueva };
}

function updateLocalCotizacion(cot_id, changes) {
  const list = getStoredCotizaciones();
  const idx = list.findIndex((c) => c.cotizacion_id === cot_id);
  if (idx < 0) throw new Error(`Cotización ${cot_id} no encontrada`);

  const current = list[idx];
  const updated = {
    ...current,
    ...changes,
    updated_at: new Date().toISOString(),
  };

  list[idx] = updated;
  setStoredCotizaciones(list);
  return { ok: true, cotizacion: updated };
}

function setLocalEstadoCotizacion(cot_id, estado) {
  return updateLocalCotizacion(cot_id, { estado });
}

function getLocalPreciosProveedor(params = {}) {
  let list = getStoredPreciosProveedor();
  if (params.sku) {
    list = list.filter((p) => (p.sku || '').toUpperCase() === params.sku.toUpperCase());
  }
  if (params.proveedor) {
    list = list.filter((p) => String(p.proveedor || '').toLowerCase().includes(params.proveedor.toLowerCase()));
  }
  return { rows: list, total: list.length };
}

function upsertLocalPrecioProveedor(payload) {
  const list = getStoredPreciosProveedor();
  const idx = list.findIndex((p) => p.sku === payload.sku && p.proveedor === payload.proveedor);
  const entry = {
    ...payload,
    fecha: new Date().toISOString().split('T')[0],
    uid: idx >= 0 ? list[idx].uid : `PRP-${Date.now().toString(36)}`,
  };
  if (idx >= 0) {
    list[idx] = entry;
  } else {
    list.push(entry);
  }
  setStoredPreciosProveedor(list);
  return { ok: true, item: entry };
}

async function getLocalCotizacionesFromAlerts(params = {}) {
  const alertsRes = await computeLocalForecast(params);
  const criticos = (alertsRes.alertas || []).filter((a) => a.alerta === 'ROJO' || a.alerta === 'NARANJA');
  const precios = getStoredPreciosProveedor();

  const lineasSugeridas = criticos.map((c) => {
    const provPref = c.proveedor_preferido || 'Freund';
    const matchPrecio = precios.find((p) => p.sku === c.sku && p.proveedor === provPref) || precios.find((p) => p.sku === c.sku);
    
    // Determinar tipo item segun prefijo
    let tipo = 'INSUMO';
    if (c.sku.startsWith('MET') || c.sku.startsWith('VID') || c.sku.startsWith('LIV')) {
      tipo = 'MATERIAL';
    } else if (c.sku.startsWith('EQU')) {
      tipo = 'EQUIPO';
    }

    const factor = 1.9; // FACTOR_PEDIDO R-41
    const sugerido = Math.max(1, Math.ceil((c.stock_minimo || 5) * factor - (c.stock_actual || 0)));

    return {
      incluir: true,
      tipo_item: tipo,
      sku: c.sku,
      codigo_proveedor: matchPrecio?.codigo_proveedor || '',
      descripcion: c.descripcion || '',
      unidad: c.unidad || 'unidad',
      cantidad: sugerido,
      precio_unitario: matchPrecio?.ultimo_precio || Number(c.pmp || 0),
      incluye_iva: matchPrecio ? matchPrecio.incluye_iva : false,
      taller_linea: 'Sonsonate',
    };
  });

  return {
    proveedor: params.proveedor || 'Freund',
    lineas: lineasSugeridas,
  };
}

async function computeLocalCalidadDatos() {
  const [catRes, comRes, movRes, ptaRes] = await Promise.all([
    apiRequest('catalogo.list', { pageSize: 500 }).catch(() => ({ rows: [] })),
    apiRequest('compras.list', { pageSize: 500 }).catch(() => ({ rows: [] })),
    apiRequest('movimientos.list', { pageSize: 500 }).catch(() => ({ rows: [] })),
    apiRequest('puertas.list', { pageSize: 500 }).catch(() => ({ rows: [] })),
  ]);

  const catalogo = catRes.rows || [];
  const compras = comRes.rows || [];
  const movimientos = movRes.rows || [];
  const puertas = ptaRes.rows || [];

  // 8 Controles R-46
  const c1_sinProveedor = compras.filter((c) => !c.proveedor || c.proveedor === 'Por asignar' || c.proveedor === 'Pendiente');
  const c2_sinPrecio = compras.filter((c) => !c.precio_unitario_pagado || Number(c.precio_unitario_pagado) <= 0);
  const c3_dtePendiente = compras.filter((c) => String(c.tipo_dte || '').toLowerCase().includes('pendiente'));
  const c4_sinStockMin = catalogo.filter((k) => k.stock_minimo === undefined || k.stock_minimo === '' || Number(k.stock_minimo) <= 0);
  const c5_sinProvPref = catalogo.filter((k) => !k.proveedor_preferido || k.proveedor_preferido === 'Por asignar');
  const c6_stockNegativo = catalogo.filter((k) => Number(k.stock_actual || 0) < 0);
  const c7_movSinTaller = movimientos.filter((m) => !m.taller_destino || m.taller_destino === 'Sin asignar' || m.taller_destino === 'Taller 1');
  const c8_puertaSinTaller = puertas.filter((p) => !p.taller || p.taller === 'Sin asignar');

  const totalErrores = (
    c1_sinProveedor.length +
    c2_sinPrecio.length +
    c3_dtePendiente.length +
    c4_sinStockMin.length +
    c5_sinProvPref.length +
    c6_stockNegativo.length +
    c7_movSinTaller.length +
    c8_puertaSinTaller.length
  );

  return {
    score_salud: Math.max(0, 100 - totalErrores * 2),
    total_errores: totalErrores,
    controles: [
      { id: 'c1', titulo: '1. Compras sin Proveedor', count: c1_sinProveedor.length, severidad: 'ALTA', items: c1_sinProveedor.slice(0, 5) },
      { id: 'c2', titulo: '2. Compras sin Precio Unitario Pagado (>0)', count: c2_sinPrecio.length, severidad: 'ALTA', items: c2_sinPrecio.slice(0, 5) },
      { id: 'c3', titulo: '3. Compras con DTE Pendiente', count: c3_dtePendiente.length, severidad: 'MEDIA', items: c3_dtePendiente.slice(0, 5) },
      { id: 'c4', titulo: '4. SKUs sin Stock Mínimo Definido', count: c4_sinStockMin.length, severidad: 'MEDIA', items: c4_sinStockMin.slice(0, 5) },
      { id: 'c5', titulo: '5. SKUs sin Proveedor Preferido', count: c5_sinProvPref.length, severidad: 'BAJA', items: c5_sinProvPref.slice(0, 5) },
      { id: 'c6', titulo: '6. SKUs con Stock Negativo (<0)', count: c6_stockNegativo.length, severidad: 'CRITICA', items: c6_stockNegativo.slice(0, 5) },
      { id: 'c7', titulo: '7. Movimientos sin Taller Canónico', count: c7_movSinTaller.length, severidad: 'MEDIA', items: c7_movSinTaller.slice(0, 5) },
      { id: 'c8', titulo: '8. Puertas sin Taller Asignado', count: c8_puertaSinTaller.length, severidad: 'MEDIA', items: c8_puertaSinTaller.slice(0, 5) },
    ]
  };
}
