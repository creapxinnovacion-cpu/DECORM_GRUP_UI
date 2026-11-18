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
  createComprasBatch: (compras) => apiRequest('compras.createBatch', { compras }),
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
};
