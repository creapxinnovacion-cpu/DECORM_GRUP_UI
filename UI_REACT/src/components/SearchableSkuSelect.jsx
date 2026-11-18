import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export default function SearchableSkuSelect({
  items = [],
  value = '',
  onChange,
  placeholder = 'Buscar por SKU o descripción (ej: lija, disco, ABR-001)...',
  disabled = false,
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  const selectedItem = items.find((i) => i.sku === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = items.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    const desc = (item.descripcion || '').toLowerCase();
    const cat = (item.categoria || '').toLowerCase();
    return sku.includes(term) || desc.includes(term) || cat.includes(term);
  });

  const handleSelect = (item) => {
    onChange(item.sku, item);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
    setSearchTerm('');
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      {/* Trigger / Display Bar */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={`w-full min-h-[44px] px-3 py-2 bg-slate-900 border rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-slate-700'
            : isOpen
            ? 'border-amber-500 ring-1 ring-amber-500/20'
            : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        <div className="flex-1 flex items-center gap-2 overflow-hidden mr-2">
          {selectedItem ? (
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-xs border border-amber-500/30 shrink-0">
                {selectedItem.sku}
              </span>
              <span className="text-slate-100 truncate">
                {selectedItem.descripcion}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  Number(selectedItem.stock_actual || 0) > 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                Stock: {selectedItem.stock_actual ?? 0} {selectedItem.unidad || ''}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 text-sm flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500" />
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedItem && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
              title="Quitar selección"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              isOpen ? 'rotate-180 text-amber-400' : ''
            }`}
          />
        </div>
      </div>

      {/* Hidden input to support required form validation */}
      {required && (
        <input
          type="text"
          value={value}
          required
          tabIndex={-1}
          className="sr-only"
          onChange={() => {}}
        />
      )}

      {/* Dropdown Options */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden backdrop-blur-md">
          {/* Quick search input */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/60 sticky top-0 flex items-center gap-2">
            <Search className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Escribe palabra clave (ej: lija, disco, metro)..."
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/40 text-sm">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                No se encontraron insumos coincidentes con "{searchTerm}"
              </div>
            ) : (
              filtered.map((item) => {
                const isSelected = item.sku === value;
                const stock = Number(item.stock_actual || 0);
                return (
                  <div
                    key={item.sku}
                    onClick={() => handleSelect(item)}
                    className={`px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-500/15 border-l-2 border-amber-500'
                        : 'hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-amber-400 text-xs">
                          {item.sku}
                        </span>
                        <span className="text-slate-200 font-medium text-xs truncate">
                          {item.descripcion}
                        </span>
                      </div>
                      {item.categoria && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.categoria}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded font-mono ${
                          stock > 0
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        Stock: {stock} {item.unidad || ''}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
