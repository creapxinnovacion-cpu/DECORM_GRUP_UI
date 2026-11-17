import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getAuthToken, getCurrentUser } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCurrentUser());
  const [token, setToken] = useState(getAuthToken());
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const configData = await api.getConfig();
        setConfig(configData);
      } catch (err) {
        console.error('Error al cargar config inicial:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const login = async (username, pin) => {
    const res = await api.login(username, pin);
    setUser(res.user);
    setToken(res.token);
    return res;
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setToken(null);
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    // Map permissions by role
    const rolePermissions = {
      compras: ['catalogo', 'compras', 'dashboard', 'puertas', 'conciliacion_view'],
      bodega: ['catalogo', 'movimientos', 'prestamos', 'seguimiento', 'conciliacion', 'dashboard', 'puertas'],
      taller: ['catalogo_view', 'movimientos_view', 'puertas_view', 'dashboard'],
      lectura: ['dashboard', 'catalogo_view'],
    };
    const userPerms = rolePermissions[user.role] || [];
    return userPerms.includes(permission) || userPerms.includes(permission + '_view');
  };

  return (
    <AuthContext.Provider value={{ user, token, config, loading, login, logout, hasPermission, setConfig }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
