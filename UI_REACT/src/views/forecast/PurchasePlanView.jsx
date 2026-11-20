import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  Truck,
  Building2,
  Calendar,
  CheckSquare,
  Square,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertOctagon,
} from 'lucide-react';
import { api, generateRequestId } from '../../services/api';
import { Modal } from '../../components/Modal';

export function PurchasePlanView({ onNavigateCompras }) {
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState(null);
  
  // Selected items to buy: key = sku, value = { cantidad, proveedor, precio_unit, etc }
  const [selectedItems, setSelectedItems] = useState({});
  const [quantities, setQuantities] = useState({});
  const [tallerDestinoGlobal, setTallerDestinoGlobal] = useState('Bodega');

  // Authorization modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const res = await api.getWeeklyPurchasePlan();
      setPlanData(res || null);

      // Pre-select urgent items or items with cantidad_sugerida > 0
      const initialSelected = {};
      const initialQty = {};
      (res?.items || []).forEach((item) => {
        if (item.cantidad_sugerida > 0) {
          initialSelected[item.sku] = true;
          initialQty[item.sku] = item.cantidad_sugerida;
        }
      });
      setSelectedItems(initialSelected);
      setQuantities(initialQty);
    } catch (err) {
      console.error('Error al cargar plan semanal de compras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, []);

  const toggleSelect = (sku) => {
    setSelectedItems((prev) => ({
      ...prev,
      [sku]: !prev[sku],
    }));
  };

  const handleQtyChange = (sku, val) => {
    setQuantities((prev) => ({
      ...prev,
      [sku]: Number(val),
    }));
  };

  // Compute selected items summary
  const selectedList = (planData?.items || []).filter((it) => selectedItems[it.sku]);
  const totalItemsToBuy = selectedList.length;
  const totalCostEstimate = selectedList.reduce((acc, it) => {
    const qty = quantities[it.sku] ?? it.cantidad_sugerida;
    const price = Number(it.costo_unitario || it.precio_ref_neto || 0);
    return acc + qty * price;
  }, 0);

  // Issue purchases in batch to Apps Script
  const handleAuthorizePurchase = async () => {
    if (!selectedList.length) return;
    setIssuing(true);
    try {
      const lineas = selectedList.map((it) => {
        const qty = quantities[it.sku] ?? it.cantidad_sugerida;
        const price = Number(it.costo_unitario || it.precio_ref_neto || 0);
        return {
          sku: it.sku,
          cant_pedida: qty,
          cant_recibida: qty,
          precio_unit_pagado: price,
          taller_destino: tallerDestinoGlobal,
          proveedor: it.proveedor || 'Por asignar',
          observaciones: `Orden generada desde Forecast v3.0 (${it.base_sugerencia || 'AUTO'})`,
        };
      });

      const todayStr = new Date().toISOString().slice(0, 10);
      const cabecera = {
        fecha: todayStr,
        tipo_dte: 'Pendiente',
        taller_destino: tallerDestinoGlobal,
      };

      const requestId = generateRequestId();
      await api.createComprasBatch({ cabecera, lineas }, { requestId });

      setShowConfirmModal(false);
      alert(`¡Orden de compra autorizada y registrada exitosamente! (${lineas.length} líneas generadas)`);
      fetchPlan();
      if (onNavigateCompras) onNavigateCompras();
    } catch (err) {
      console.error('Error al emitir compras:', err);
      alert('Error al emitir compras sugeridas: ' + err.message);
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShoppingCart className="w-6 h-6" />
            </span>
            Plan Semanal de Compras Sugeridas
            <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
              Autorización Requerida
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cálculo de reposición semanal según consumo real, horizonte de protección y lotes de empaque.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPlan}
            disabled={loading}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
            title="Recalcular plan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={totalItemsToBuy === 0 || loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 transition disabled:opacity-40 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Autorizar y Emitir Compras ({totalItemsToBuy})</span>
          </button>
        </div>
      </div>

      {/* Top KPIs Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Total Ítems a Pedir
            </span>
            <span className="text-2xl sm:text-3xl font-black text-slate-100 font-mono">
              {planData?.total_items || 0}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-rose-400 font-bold uppercase tracking-wider block">
              Ítems Urgentes (0 Días)
            </span>
            <span className="text-2xl sm:text-3xl font-black text-rose-400 font-mono">
              {planData?.urgentes || 0}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider block">
              Inversión Estimada Total
            </span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              ${Number(planData?.costo_estimado_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Provider Sections */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
          <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
          <p className="text-xs">Consolidando sugerencias y dividiendo por proveedor...</p>
        </div>
      ) : !planData?.items || planData.items.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto opacity-70" />
          <h3 className="text-base font-bold text-slate-200">No se requieren compras urgentes esta semana</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            El inventario físico actual cubre los horizontes de protección y puntos de reorden programados.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(planData.por_proveedor || { 'Todos los Proveedores': planData.items }).map(
            ([proveedorNombre, itemsProveedor]) => {
              const subtotalProveedor = itemsProveedor.reduce((acc, it) => {
                const qty = quantities[it.sku] ?? it.cantidad_sugerida;
                const price = Number(it.costo_unitario || it.precio_ref_neto || 0);
                return acc + qty * price;
              }, 0);

              return (
                <div
                  key={proveedorNombre}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
                >
                  {/* Provider Header */}
                  <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">{proveedorNombre}</h3>
                        <span className="text-[11px] text-slate-400">
                          {itemsProveedor.length} {itemsProveedor.length === 1 ? 'artículo sugerido' : 'artículos sugeridos'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span className="text-slate-400">
                        Subtotal Estimado:{' '}
                        <strong className="text-emerald-400 font-bold">
                          ${subtotalProveedor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Provider Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/40 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800/80">
                        <tr>
                          <th className="py-2.5 px-4 w-10 text-center">Sel.</th>
                          <th className="py-2.5 px-4">SKU / Descripción</th>
                          <th className="py-2.5 px-4 text-center">Stock Físico</th>
                          <th className="py-2.5 px-4 text-center">Días Cob.</th>
                          <th className="py-2.5 px-4 text-center">Base Sugerencia</th>
                          <th className="py-2.5 px-4 text-center">Sugerido</th>
                          <th className="py-2.5 px-4 text-center">Cantidad a Pedir</th>
                          <th className="py-2.5 px-4 text-right">Precio Ref.</th>
                          <th className="py-2.5 px-4 text-right">Total Est.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {itemsProveedor.map((item) => {
                          const isSelected = Boolean(selectedItems[item.sku]);
                          const qty = quantities[item.sku] ?? item.cantidad_sugerida;
                          const price = Number(item.costo_unitario || item.precio_ref_neto || 0);
                          const totalLinea = qty * price;

                          return (
                            <tr
                              key={item.sku}
                              className={`hover:bg-slate-800/30 transition ${
                                isSelected ? 'bg-amber-500/[0.03]' : 'opacity-60'
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleSelect(item.sku)}
                                  className="text-amber-400 hover:text-amber-300 transition cursor-pointer"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-amber-500" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-600" />
                                  )}
                                </button>
                              </td>

                              {/* SKU & Desc */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-amber-400">{item.sku}</span>
                                  {item.urgente && (
                                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      URGENTE
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-200 font-medium max-w-xs truncate" title={item.descripcion}>
                                  {item.descripcion}
                                </p>
                              </td>

                              {/* Stock Fisico */}
                              <td className="py-3 px-4 text-center font-mono">
                                <span className={item.stock_fisico <= 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                                  {item.stock_fisico} {item.unidad}
                                </span>
                              </td>

                              {/* Cobertura */}
                              <td className="py-3 px-4 text-center font-mono">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    item.dias_cobertura <= 0
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : item.dias_cobertura <= (item.lead_time_dias || 3)
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-emerald-500/20 text-emerald-300'
                                  }`}
                                >
                                  {item.dias_cobertura !== null ? `${item.dias_cobertura}d` : '--'}
                                </span>
                              </td>

                              {/* Base */}
                              <td className="py-3 px-4 text-center">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                  {item.base_sugerencia || 'DEMANDA_HORIZONTE'}
                                </span>
                              </td>

                              {/* Sugerido */}
                              <td className="py-3 px-4 text-center font-mono text-slate-400">
                                {item.cantidad_sugerida} {item.unidad}
                              </td>

                              {/* Cantidad a Pedir (Editable) */}
                              <td className="py-3 px-4 text-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    disabled={!isSelected}
                                    value={qty}
                                    onChange={(e) => handleQtyChange(item.sku, e.target.value)}
                                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-amber-400 text-xs focus:outline-none focus:border-amber-500 disabled:opacity-40"
                                  />
                                  <span className="text-[10px] text-slate-500">{item.unidad}</span>
                                </div>
                              </td>

                              {/* Precio Unitario */}
                              <td className="py-3 px-4 text-right font-mono text-slate-400">
                                {price > 0 ? `$${price.toFixed(2)}` : <span className="text-slate-600">S/D</span>}
                              </td>

                              {/* Subtotal */}
                              <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                                {totalLinea > 0 ? `$${totalLinea.toFixed(2)}` : '$0.00'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirmar Emisión de Orden de Compras"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-300">
            <strong>Atención:</strong> Las órdenes de compra emitidas quedarán registradas formalmente en la hoja <code>Compras</code> de Google Sheets como recepción en estado <em>Pendiente</em> para alimentar la cobertura del sistema.
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Taller de Destino Inicial</label>
            <select
              value={tallerDestinoGlobal}
              onChange={(e) => setTallerDestinoGlobal(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="Bodega">Bodega Central</option>
              <option value="Santa Ana">Taller Santa Ana</option>
              <option value="Sonsonate">Taller Sonsonate</option>
              <option value="Taller Central">Taller Central</option>
            </select>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold sticky top-0">
                <tr>
                  <th className="p-2">SKU</th>
                  <th className="p-2">Insumo</th>
                  <th className="p-2 text-center">Cant.</th>
                  <th className="p-2 text-right">Costo Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {selectedList.map((it) => {
                  const qty = quantities[it.sku] ?? it.cantidad_sugerida;
                  const price = Number(it.costo_unitario || it.precio_ref_neto || 0);
                  return (
                    <tr key={it.sku}>
                      <td className="p-2 font-mono text-amber-400 font-bold">{it.sku}</td>
                      <td className="p-2 text-slate-200 truncate max-w-xs">{it.descripcion}</td>
                      <td className="p-2 text-center font-mono font-bold">
                        {qty} {it.unidad}
                      </td>
                      <td className="p-2 text-right font-mono text-emerald-400">
                        ${(qty * price).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl font-mono text-xs">
            <span className="text-slate-400">Inversión Total Autorizada:</span>
            <span className="text-base font-bold text-emerald-400">
              ${totalCostEstimate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={issuing}
              onClick={handleAuthorizePurchase}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {issuing ? 'Autorizando en Sheets...' : 'Autorizar y Generar Orden'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default PurchasePlanView;
