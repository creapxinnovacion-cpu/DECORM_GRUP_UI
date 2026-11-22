import React, { useState } from 'react';
import { ShieldAlert, KeyRound, User, CheckCircle2, AlertTriangle, RefreshCw, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Modal } from './Modal';

export function CambiarPasswordModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [targetUsername, setTargetUsername] = useState('cristian');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const esCristian = user && (
    user.username?.toLowerCase() === 'cristian' ||
    user.nombre?.toLowerCase().includes('cristian')
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!esCristian) {
      setError('Operación restringida: Únicamente Cristian Cajul tiene permisos para modificar contraseñas.');
      return;
    }

    if (newPin.length < 4) {
      setError('El nuevo PIN debe tener al menos 4 caracteres.');
      return;
    }

    if (newPin !== confirmPin) {
      setError('Los PINs no coinciden. Por favor verifique.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.updatePassword(targetUsername, newPin);
      setSuccess(res.message || `PIN de ${targetUsername} actualizado correctamente.`);
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      setError(err.message || 'Error al actualizar contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestión de Seguridad & Contraseñas" maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="text-center pb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3">
            <Lock className="w-6 h-6 text-slate-950" />
          </div>
          <h4 className="font-bold text-slate-100 text-base">Actualización de PIN / Clave</h4>
          <p className="text-xs text-amber-400 font-medium mt-0.5">
            Módulo restringido exclusivamente a Cristian Cajul (R-47)
          </p>
        </div>

        {!esCristian && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Acceso no autorizado. Debe iniciar sesión como Cristian Cajul.</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Usuario a Actualizar
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                disabled={!esCristian || loading}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500 cursor-pointer"
              >
                <option value="cristian">cristian (Cristian Cajul)</option>
                <option value="emma">emma (Enmanuel Sanches)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nuevo PIN de Acceso
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                disabled={!esCristian || loading}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Mínimo 4 dígitos / caracteres"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Confirmar Nuevo PIN
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                disabled={!esCristian || loading}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Repita el nuevo PIN"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!esCristian || loading}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Actualizando en Google Sheets...
              </>
            ) : (
              'Guardar Nuevo PIN en Sheets'
            )}
          </button>
        </form>
      </div>
    </Modal>
  );
}
