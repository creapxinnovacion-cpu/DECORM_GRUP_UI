import React, { useState } from 'react';
import { ShieldCheck, KeyRound, User, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from './Modal';

export function LoginModal({ isOpen, onClose }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, pin);
      onClose();
    } catch (err) {
      setError(err.message || 'Credenciales inválidas o usuario inactivo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Acceso al Sistema Maestro DICORMS" maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="text-center pb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3">
            <ShieldCheck className="w-7 h-7 text-slate-950" />
          </div>
          <h4 className="font-bold text-slate-100 text-base">Iniciar Sesión</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Autenticación Segura HMAC-SHA256 con Control de Acceso por Roles (RBAC)
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Usuario
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nombre de usuario"
                autoComplete="username"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              PIN de Acceso
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="******"
                autoComplete="current-password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Verificando en Google Sheets...
              </>
            ) : (
              'Ingresar al Sistema'
            )}
          </button>
        </form>
      </div>
    </Modal>
  );
}
