import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/bodega_provider.dart';
import '../config/theme.dart';
import '../config/constants.dart';
import '../widgets/sku_picker_dialog.dart';

class InsumoItemBatch {
  String sku;
  String descripcion;
  num cantidad;
  String unidad;

  InsumoItemBatch({
    required this.sku,
    required this.descripcion,
    required this.cantidad,
    required this.unidad,
  });
}

class InstaladoresScreen extends StatefulWidget {
  const InstaladoresScreen({super.key});

  @override
  State<InstaladoresScreen> createState() => _InstaladoresScreenState();
}

class _InstaladoresScreenState extends State<InstaladoresScreen> {
  String _selectedOperador = 'Jairo';
  String _selectedTaller = 'Instaladores';
  final _notasController = TextEditingController();
  final List<InsumoItemBatch> _items = [];
  bool _isSaving = false;

  // Catálogo de insumos rápidos para instaladores en obra
  final List<Map<String, String>> _insumosFrecuentes = [
    {'sku': 'CON-002', 'desc': 'Thinner laca / estándar', 'unid': 'galón'},
    {'sku': 'ABR-001', 'desc': 'Disco de lija seco 127 mm G80', 'unid': 'disco'},
    {'sku': 'ABR-002', 'desc': 'Lija flexible P320 multimaterial', 'unid': 'pliego'},
    {'sku': 'ABR-003', 'desc': 'Lija flexible P80 multimaterial', 'unid': 'pliego'},
    {'sku': 'ABR-008', 'desc': 'Disco de esmeril 4½"', 'unid': 'disco'},
    {'sku': 'CON-003', 'desc': 'Wipe tela multiuso (por libra)', 'unid': 'libra'},
    {'sku': 'CON-010', 'desc': 'Tirro uso general 50 mm', 'unid': 'rollo'},
    {'sku': 'SEL-002', 'desc': 'Jet Bond Masilla Pesada', 'unid': 'galón'},
    {'sku': 'HER-007', 'desc': 'Cerradura entrada LL-M', 'unid': 'unidad'},
    {'sku': 'HER-016', 'desc': 'Pasador de pie zincado 127 mm', 'unid': 'unidad'},
    {'sku': 'CON-009', 'desc': 'Plástico Strecht embalaje', 'unid': 'rollo'},
  ];

  void _agregarInsumoRapido(Map<String, String> f) {
    final idx = _items.indexWhere((it) => it.sku == f['sku']);
    setState(() {
      if (idx >= 0) {
        _items[idx].cantidad += 1;
      } else {
        _items.add(InsumoItemBatch(
          sku: f['sku']!,
          descripcion: f['desc']!,
          cantidad: 1,
          unidad: f['unid']!,
        ));
      }
    });
  }

  void _abrirSkuPicker() async {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    final art = await SkuPickerDialog.show(
      context,
      articulos: bodega.catalogo,
    );

    if (art != null) {
      final idx = _items.indexWhere((it) => it.sku == art.sku);
      setState(() {
        if (idx >= 0) {
          _items[idx].cantidad += 1;
        } else {
          _items.add(InsumoItemBatch(
            sku: art.sku,
            descripcion: art.descripcion,
            cantidad: 1,
            unidad: art.unidad,
          ));
        }
      });
    }
  }

  void _guardarDespacho() async {
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agrega al menos un insumo para el instalador')),
      );
      return;
    }

    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    setState(() => _isSaving = true);

    try {
      final cabecera = {
        'encargado_instalacion': _selectedOperador,
        'taller': _selectedTaller,
        'observaciones': _notasController.text.trim(),
      };

      final lineas = _items.map((it) => {
        'sku': it.sku,
        'insumo': it.descripcion,
        'cantidad': it.cantidad,
        'unidad': it.unidad,
        'check': true,
      }).toList();

      final res = await bodega.registrarInsumosInstaladoresBatch(cabecera, lineas);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: DecormTheme.statusSuccess,
            content: Text(
              '¡Despacho registrado con éxito! Lote: ${res['lote_id'] ?? 'OK'} (Stock descontado en bodega)',
            ),
          ),
        );
        setState(() {
          _items.clear();
          _notasController.clear();
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: DecormTheme.statusDanger,
            content: Text('Error al registrar despacho: $e'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Despacho a Instaladores'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline, color: DecormTheme.primaryAmber),
            tooltip: 'Buscar en catálogo',
            onPressed: _abrirSkuPicker,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Cabecera: Instalador y Destino
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: DecormTheme.cardDark,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: DecormTheme.cardBorder),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _selectedOperador,
                          dropdownColor: DecormTheme.cardDark,
                          decoration: const InputDecoration(
                            labelText: 'Instalador Receptor',
                            prefixIcon: Icon(Icons.person, color: DecormTheme.primaryAmber),
                          ),
                          items: AppConstants.operadores.map((op) {
                            return DropdownMenuItem(value: op, child: Text(op));
                          }).toList(),
                          onChanged: (val) => setState(() => _selectedOperador = val!),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _selectedTaller,
                          dropdownColor: DecormTheme.cardDark,
                          decoration: const InputDecoration(
                            labelText: 'Taller / Destino',
                            prefixIcon: Icon(Icons.location_on, color: DecormTheme.primaryAmber),
                          ),
                          items: AppConstants.talleres.map((t) {
                            return DropdownMenuItem(value: t, child: Text(t));
                          }).toList(),
                          onChanged: (val) => setState(() => _selectedTaller = val!),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _notasController,
                    decoration: const InputDecoration(
                      labelText: 'Notas / Proyecto de Obra',
                      prefixIcon: Icon(Icons.notes, color: DecormTheme.primaryAmber),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Chips de Insumos Frecuentes
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Insumos Frecuentes (Toca para agregar)',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: DecormTheme.primaryAmber,
                  ),
                ),
                TextButton.icon(
                  onPressed: _abrirSkuPicker,
                  icon: const Icon(Icons.search, size: 14, color: DecormTheme.primaryAmber),
                  label: const Text('Ver Todo', style: TextStyle(fontSize: 11, color: DecormTheme.primaryAmber)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _insumosFrecuentes.map((f) {
                final isAdded = _items.any((it) => it.sku == f['sku']);
                return ActionChip(
                  avatar: CircleAvatar(
                    backgroundColor: isAdded ? DecormTheme.primaryAmber : Colors.transparent,
                    child: Icon(
                      isAdded ? Icons.check : Icons.add,
                      size: 14,
                      color: isAdded ? Colors.black : DecormTheme.textSecondary,
                    ),
                  ),
                  label: Text(
                    f['desc']!,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: isAdded ? FontWeight.bold : FontWeight.normal,
                      color: isAdded ? DecormTheme.primaryAmber : DecormTheme.textPrimary,
                    ),
                  ),
                  backgroundColor: isAdded
                      ? DecormTheme.primaryAmber.withOpacity(0.15)
                      : DecormTheme.cardDark,
                  side: BorderSide(
                    color: isAdded ? DecormTheme.primaryAmber : DecormTheme.cardBorder,
                  ),
                  onPressed: () => _agregarInsumoRapido(f),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Lista de Ítems Seleccionados para el Despacho
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Artículos a Despachar (${_items.length})',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                if (_items.isNotEmpty)
                  TextButton(
                    onPressed: () => setState(() => _items.clear()),
                    child: const Text('Limpiar Todo', style: TextStyle(color: DecormTheme.statusDanger, fontSize: 11)),
                  ),
              ],
            ),
            const SizedBox(height: 8),

            if (_items.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: DecormTheme.cardDark.withOpacity(0.5),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: DecormTheme.cardBorder, style: BorderStyle.solid),
                ),
                child: const Column(
                  children: [
                    Icon(Icons.inventory_2_outlined, size: 36, color: DecormTheme.textSecondary),
                    SizedBox(height: 8),
                    Text(
                      'No hay insumos seleccionados',
                      style: TextStyle(color: DecormTheme.textSecondary, fontSize: 13),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Toca los chips de arriba o busca en el catálogo para armar el lote',
                      style: TextStyle(color: DecormTheme.textSecondary, fontSize: 11),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (ctx, i) {
                  final it = _items[i];
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: DecormTheme.cardDark,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: DecormTheme.primaryAmber.withOpacity(0.2)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: DecormTheme.primaryAmber.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            it.sku,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                              color: DecormTheme.primaryAmber,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                it.descripcion,
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                'Unidad: ${it.unidad}',
                                style: const TextStyle(color: DecormTheme.textSecondary, fontSize: 10),
                              ),
                            ],
                          ),
                        ),
                        // Steppers
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline, size: 20),
                              color: DecormTheme.textSecondary,
                              onPressed: () {
                                setState(() {
                                  if (it.cantidad > 1) {
                                    it.cantidad -= 1;
                                  } else {
                                    _items.removeAt(i);
                                  }
                                });
                              },
                            ),
                            Text(
                              '${it.cantidad}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                            IconButton(
                              icon: const Icon(Icons.add_circle_outline, size: 20),
                              color: DecormTheme.primaryAmber,
                              onPressed: () {
                                setState(() {
                                  it.cantidad += 1;
                                });
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            const SizedBox(height: 24),

            // Botón de Despacho Atómico
            ElevatedButton.icon(
              onPressed: _isSaving ? null : _guardarDespacho,
              style: ElevatedButton.styleFrom(
                backgroundColor: DecormTheme.primaryAmber,
                foregroundColor: const Color(0xFF0F172A),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              icon: _isSaving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                    )
                  : const Icon(Icons.local_shipping_outlined),
              label: Text(
                _isSaving ? 'DESPACHANDO Y DESCONTANDO STOCK...' : 'REGISTRAR ENTREGA MULTI-INSUMO',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
