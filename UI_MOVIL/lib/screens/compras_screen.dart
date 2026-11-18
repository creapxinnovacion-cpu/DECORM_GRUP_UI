import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/bodega_provider.dart';
import '../models/articulo_model.dart';
import '../config/theme.dart';
import '../config/constants.dart';
import '../widgets/sku_picker_dialog.dart';

class ComprasScreen extends StatefulWidget {
  const ComprasScreen({super.key});

  @override
  State<ComprasScreen> createState() => _ComprasScreenState();
}

class _ComprasScreenState extends State<ComprasScreen> {
  String _search = '';

  void _mostrarDialogoNuevaCompra(BuildContext context) {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    final articulos = bodega.catalogo;
    String? selectedSku = articulos.isNotEmpty ? articulos.first.sku : null;
    final provController = TextEditingController();
    final cantController = TextEditingController(text: '1');
    final precioController = TextEditingController(text: '0.00');
    final dteController = TextEditingController();
    String tipoDte = 'CCF';
    String taller = 'Santa Ana';
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: DecormTheme.cardDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(builder: (context, setModalState) {
          final selectedArt = selectedSku != null
              ? articulos.firstWhere((a) => a.sku == selectedSku,
                  orElse: () => ArticuloModel(
                      sku: selectedSku!,
                      descripcion: '',
                      categoria: '',
                      unidad: '',
                      stockInicial: 0,
                      stockActual: 0,
                      stockMinimo: 0,
                      pmp: 0,
                      valorInventario: 0,
                      estado: ''))
              : null;

          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(context).viewInsets.bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Registrar Nueva Compra en Sheets',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: DecormTheme.statusInfo,
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Searchable SKU Picker
                  InkWell(
                    onTap: () async {
                      final picked = await SkuPickerDialog.show(
                        context,
                        articulos: articulos,
                        initialSku: selectedSku,
                      );
                      if (picked != null) {
                        setModalState(() => selectedSku = picked.sku);
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: DecormTheme.cardDark,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: selectedSku != null
                              ? DecormTheme.statusInfo
                              : DecormTheme.cardBorder,
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.search, color: DecormTheme.statusInfo, size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              selectedArt != null && selectedArt.descripcion.isNotEmpty
                                  ? '${selectedArt.sku} — ${selectedArt.descripcion}'
                                  : (selectedSku ?? 'Toca para buscar SKU o palabra clave...'),
                              style: TextStyle(
                                color: selectedSku != null ? Colors.white : Colors.white38,
                                fontSize: 13,
                                fontWeight: selectedSku != null ? FontWeight.w600 : FontWeight.normal,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const Icon(Icons.arrow_drop_down, color: Colors.white54),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: provController,
                          decoration: const InputDecoration(labelText: 'Proveedor', hintText: 'FREUND / EPA / VIDRI'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: taller,
                          dropdownColor: DecormTheme.cardDark,
                          decoration: const InputDecoration(labelText: 'Taller Destino'),
                          items: AppConstants.talleres.map((t) {
                            return DropdownMenuItem(value: t, child: Text(t, style: const TextStyle(fontSize: 12)));
                          }).toList(),
                          onChanged: (val) => setModalState(() => taller = val!),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: cantController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Cant. Recibida'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: precioController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(labelText: 'Precio Unit. \$'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: tipoDte,
                          dropdownColor: DecormTheme.cardDark,
                          decoration: const InputDecoration(labelText: 'Tipo DTE'),
                          items: const [
                            DropdownMenuItem(value: 'CCF', child: Text('CCF (13% IVA)')),
                            DropdownMenuItem(value: 'Factura', child: Text('Factura')),
                            DropdownMenuItem(value: 'Sujeto Excluido', child: Text('Sujeto Excl.')),
                          ],
                          onChanged: (val) => setModalState(() => tipoDte = val!),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: dteController,
                          decoration: const InputDecoration(labelText: 'N.° DTE / Factura'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: DecormTheme.statusInfo),
                    onPressed: isSaving
                        ? null
                        : () async {
                            if (selectedSku == null || provController.text.trim().isEmpty) return;
                            setModalState(() => isSaving = true);
                            try {
                              await bodega.createCompra({
                                'fecha': DateFormat('yyyy-MM-dd').format(DateTime.now()),
                                'proveedor': provController.text.trim(),
                                'sku': selectedSku,
                                'cant_pedida': num.tryParse(cantController.text.trim()) ?? 1,
                                'cant_recibida': num.tryParse(cantController.text.trim()) ?? 1,
                                'precio_unit_pagado': num.tryParse(precioController.text.trim()) ?? 0,
                                'taller_destino': taller,
                                'tipo_dte': tipoDte,
                                'n_dte': dteController.text.trim(),
                              });
                              if (ctx.mounted) Navigator.pop(ctx);
                            } finally {
                              setModalState(() => isSaving = false);
                            }
                          },
                    child: Text(isSaving ? 'GUARDANDO...' : 'GUARDAR COMPRA'),
                  ),
                ],
              ),
            ),
          );
        });
      },
    );
  }

  void _mostrarDialogoEditarCompra(BuildContext context, Map<String, dynamic> c) {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    final rowNum = c['_rowNumber'] is int ? c['_rowNumber'] as int : 2;
    final provController = TextEditingController(text: c['proveedor']?.toString() ?? '');
    final cantController = TextEditingController(text: '${c['cant_recibida'] ?? 1}');
    final precioController = TextEditingController(text: '${c['precio_unit_pagado'] ?? 0}');
    final dteController = TextEditingController(text: c['n_dte']?.toString() ?? '');
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: DecormTheme.cardDark,
            title: Text(
              'Editar Compra — Fila R$rowNum',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: DecormTheme.statusInfo,
              ),
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'SKU: ${c['sku']} (${c['fecha']})',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: provController,
                    decoration: const InputDecoration(labelText: 'Proveedor'),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: cantController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Cant.'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: precioController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(labelText: 'Precio \$'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: dteController,
                    decoration: const InputDecoration(labelText: 'N.° DTE / Factura'),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('CANCELAR', style: TextStyle(color: DecormTheme.textSecondary)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: DecormTheme.statusInfo),
                onPressed: isSaving
                    ? null
                    : () async {
                        setDialogState(() => isSaving = true);
                        try {
                          await bodega.updateCompra(rowNum, {
                            'proveedor': provController.text.trim(),
                            'cant_recibida': num.tryParse(cantController.text.trim()) ?? 1,
                            'precio_unit_pagado': num.tryParse(precioController.text.trim()) ?? 0,
                            'n_dte': dteController.text.trim(),
                          });
                          if (ctx.mounted) Navigator.pop(ctx);
                        } finally {
                          setDialogState(() => isSaving = false);
                        }
                      },
                child: Text(isSaving ? 'ACTUALIZANDO...' : 'GUARDAR CAMBIOS'),
              ),
            ],
          );
        });
      },
    );
  }

  void _eliminarCompra(BuildContext context, Map<String, dynamic> c) async {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    final rowNum = c['_rowNumber'] is int ? c['_rowNumber'] as int : 2;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: DecormTheme.cardDark,
        title: const Text('¿Eliminar / Limpiar Fila de Compra?',
            style: TextStyle(color: DecormTheme.statusDanger)),
        content: Text('Se limpiará la compra de ${c['proveedor']} (${c['sku']}) en la fila R$rowNum.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('CANCELAR')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: DecormTheme.statusDanger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('ELIMINAR FILA'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await bodega.clearCompra(rowNum);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Fila de compra limpiada en Sheets.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bodega = Provider.of<BodegaProvider>(context);
    final compras = bodega.compras;

    final filtered = compras.where((c) {
      final s = _search.toLowerCase();
      final sku = (c['sku']?.toString() ?? '').toLowerCase();
      final prov = (c['proveedor']?.toString() ?? '').toLowerCase();
      final dte = (c['n_dte']?.toString() ?? '').toLowerCase();
      return sku.contains(s) || prov.contains(s) || dte.contains(s);
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Gestión de Compras (DTE)'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: DecormTheme.statusInfo,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('NUEVA COMPRA', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: () => _mostrarDialogoNuevaCompra(context),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Buscar por SKU, proveedor o N.° DTE...',
                prefixIcon: Icon(Icons.search, color: DecormTheme.textSecondary),
              ),
              onChanged: (val) => setState(() => _search = val),
            ),
          ),
          Expanded(
            child: filtered.isEmpty
                ? const Center(
                    child: Text(
                      'No hay compras registradas.',
                      style: TextStyle(color: DecormTheme.textSecondary),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final c = filtered[index];
                      final rowNum = c['_rowNumber'] ?? (index + 2);
                      final total = (num.tryParse(c['cant_recibida']?.toString() ?? '1') ?? 1) *
                          (num.tryParse(c['precio_unit_pagado']?.toString() ?? '0') ?? 0);

                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: DecormTheme.cardDark,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: DecormTheme.cardBorder),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'R$rowNum · ${c['fecha'] ?? ""}',
                                  style: const TextStyle(
                                    fontFamily: 'monospace',
                                    color: DecormTheme.textSecondary,
                                    fontSize: 11,
                                  ),
                                ),
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: DecormTheme.statusSuccess.withOpacity(0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        c['tipo_dte']?.toString() ?? 'CCF',
                                        style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: DecormTheme.statusSuccess,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    IconButton(
                                      constraints: const BoxConstraints(),
                                      padding: EdgeInsets.zero,
                                      icon: const Icon(Icons.edit_outlined, size: 18, color: DecormTheme.statusInfo),
                                      onPressed: () => _mostrarDialogoEditarCompra(context, c),
                                    ),
                                    const SizedBox(width: 8),
                                    IconButton(
                                      constraints: const BoxConstraints(),
                                      padding: EdgeInsets.zero,
                                      icon: const Icon(Icons.delete_outline, size: 18, color: DecormTheme.statusDanger),
                                      onPressed: () => _eliminarCompra(context, c),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${c['proveedor'] ?? "Proveedor"}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            Text(
                              'SKU: ${c['sku']} — ${c['descripcion'] ?? ""}',
                              style: const TextStyle(fontSize: 12, color: DecormTheme.primaryAmber, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Recibido: ${c['cant_recibida']} u. @ \$${c['precio_unit_pagado']}',
                                  style: const TextStyle(fontSize: 11, color: DecormTheme.textSecondary),
                                ),
                                Text(
                                  '\$${total.toStringAsFixed(2)}',
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: DecormTheme.statusSuccess),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
