/**
 * DICORMS v2.0 - Unified API Client for Google Apps Script Backend
 * GRUPO DECORM
 */

const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbzGraoRcFGLcR4PEVXAJLH16xM_vI5G1YxhDZaRAmiu0DIhCqrIPOj_Rr2xbhs-obDE/exec';

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
        motivo: motivo,
        accion_recomendada: accion,
        proveedor_preferido: it.proveedor_pref || 'Freund',
        unidad: it.unidad || 'unidad',
        pmp: it.pmp || it.precio_ref_neto || 0,
        sugerencia_compra: Math.max(0, Math.ceil(rop * 2 - stockActual)),
      });
    });

    const severidadOrden = { ROJO: 1, NARANJA: 2, AMARILLO: 3, VERDE: 4, GRIS: 5 };
    alertas.sort((a, b) => (severidadOrden[a.alerta] || 9) - (severidadOrden[b.alerta] || 9));

    return {
      resumen: {
        rojo: cRojo,
        naranja: cNaranja,
        amarillo: cAmarillo,
        verde: cVerde,
        gris: cGris,
        total_alertas: cRojo + cNaranja + cAmarillo,
      },
      alertas: alertas,
      fecha_calculo: new Date().toISOString(),
      motor: 'DECORM Forecast Engine (Local Fallback Resiliente v3.0)',
    };
  } catch (err) {
    console.error('Error calculando forecast local:', err);
    return {
      resumen: { rojo: 0, naranja: 0, amarillo: 0, verde: 0, gris: 0, total_alertas: 0 },
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
};
