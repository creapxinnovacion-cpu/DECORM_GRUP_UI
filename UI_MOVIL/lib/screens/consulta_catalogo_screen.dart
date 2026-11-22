import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/bodega_provider.dart';
import '../models/articulo_model.dart';
import '../config/theme.dart';
import '../config/constants.dart';

class ConsultaCatalogoScreen extends StatefulWidget {
  const ConsultaCatalogoScreen({super.key});

  @override
  State<ConsultaCatalogoScreen> createState() => _ConsultaCatalogoScreenState();
}

class _ConsultaCatalogoScreenState extends State<ConsultaCatalogoScreen> {
  String _search = '';
  String _selectedCategory = 'Todas';

  final List<String> _categories = [
    'Todas',
    ...AppConstants.categorias,
  ];

  void _mostrarDialogoNuevoArticulo(BuildContext context) {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    String prefijo = 'CON';
    final skuController = TextEditingController();
    final descController = TextEditingController();
    final provController = TextEditingController();
    final inicialController = TextEditingController(text: '0');
    final minController = TextEditingController(text: '10');
    String unidad = 'Unidad';
    String categoria = 'Consumibles';
    bool isGenerating = false;
    bool isSaving = false;

    void generarSku(void Function(void Function()) setModalState) async {
      setModalState(() => isGenerating = true);
      try {
        final regex = RegExp('^$prefijo-(\\d+)\$', caseSensitive: false);
        int maxNum = 0;
        for (final item in bodega.catalogo) {
          final match = regex.firstMatch(item.sku.trim());
          if (match != null) {
            final n = int.tryParse(match.group(1) ?? '0') ?? 0;
            if (n > maxNum) maxNum = n;
          }
        }

        int candidate = maxNum + 1;
        try {
          final next = await bodega.getNextSku(prefijo);
          final bMatch = regex.firstMatch(next.trim());
          if (bMatch != null) {
            final bN = int.tryParse(bMatch.group(1) ?? '0') ?? 0;
            if (bN > candidate) candidate = bN;
          }
        } catch (_) {}

        final formatted = '$prefijo-${candidate.toString().padLeft(3, '0')}';
        skuController.text = formatted;
      } finally {
        setModalState(() => isGenerating = false);
      }
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: DecormTheme.cardDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(builder: (context, setModalState) {
          if (skuController.text.isEmpty && !isGenerating) {
            generarSku(setModalState);
          }

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
                    'Crear Nuevo Artículo en Catálogo',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: DecormTheme.primaryAmber,
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Prefijo & SKU
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: prefijo,
                          dropdownColor: DecormTheme.cardDark,
                          decoration: const InputDecoration(labelText: 'Familia'),
                          items: AppConstants.familiasPrefijos.map((f) {
                            return DropdownMenuItem(
                              value: f['prefix'],
                              child: Text(f['prefix']!),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setModalState(() {
                                prefijo = val;
                                const catMap = {
                                  'ABR': 'Abrasivos',
                                  'CON': 'Consumibles y EPP',
                                  'EQU': 'Equipos y herramientas',
                                  'HER': 'Herrajes y accesorios',
                                  'MET': 'Metal y estructura',
                                  'PIN': 'Pintura y recubrimientos',
                                  'SEL': 'Selladores y adhesivos',
                                  'VID': 'Vidrio',
                                  'LIV': 'Construcción liviana',
                                };
                                categoria = catMap[val] ?? 'Consumibles y EPP';
                              });
                              generarSku(setModalState);
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: skuController,
                          decoration: InputDecoration(
                            labelText: 'SKU',
                            suffixIcon: isGenerating
                                ? const SizedBox(
                                    height: 14,
                                    width: 14,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : IconButton(
                                    icon: const Icon(Icons.refresh, size: 18),
                                    onPressed: () => generarSku(setModalState),
                                  ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  TextField(
                    controller: descController,
                    decoration: const InputDecoration(
                      labelText: 'Descripción Completa',
                      hintText: 'Ej: Tornillo drywall 1 1/4 pulg.',
                    ),
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: unidad,
                          dropdownColor: DecormTheme.cardDark,
                          decoration: const InputDecoration(labelText: 'Unidad'),
                          items: AppConstants.unidades.map((u) {
                            return DropdownMenuItem(value: u, child: Text(u));
                          }).toList(),
                          onChanged: (val) => setModalState(() => unidad = val!),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: provController,
                          decoration: const InputDecoration(
                            labelText: 'Proveedor',
                            hintText: 'FREUND / EPA',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: inicialController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Stock Inicial'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: minController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Stock Mínimo'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  ElevatedButton(
                    onPressed: isSaving
                        ? null
                        : () async {
                            if (skuController.text.trim().isEmpty ||
                                descController.text.trim().isEmpty) {
                              return;
                            }
                            setModalState(() => isSaving = true);
                            try {
                              await bodega.createArticulo({
                                'sku': skuController.text.trim(),
                                'descripcion': descController.text.trim(),
                                'categoria': categoria,
                                'unidad': unidad,
                                'proveedor_pref': provController.text.trim(),
                                'stock_inicial': num.tryParse(inicialController.text.trim()) ?? 0,
                                'stock_minimo': num.tryParse(minController.text.trim()) ?? 10,
                              });
                              if (ctx.mounted) Navigator.pop(ctx);
                            } finally {
                              setModalState(() => isSaving = false);
                            }
                          },
                    child: Text(isSaving ? 'GUARDANDO...' : 'CREAR EN SHEETS'),
                  ),
                ],
              ),
            ),
          );
        });
      },
    );
  }

  void _mostrarDialogoEditarArticulo(BuildContext context, ArticuloModel item) {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    final descController = TextEditingController(text: item.descripcion);
    final provController = TextEditingController();
    final minController = TextEditingController(text: '${item.stockMinimo}');
    final conteoController = TextEditingController(text: '${item.stockActual}');
    String unidad = item.unidad;
    String categoria = item.categoria;
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: DecormTheme.cardDark,
            title: Text(
              'Editar Artículo — ${item.sku}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: DecormTheme.primaryAmber,
              ),
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: descController,
                    decoration: const InputDecoration(
                      labelText: 'Descripción',
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: categoria.isNotEmpty ? categoria : 'Consumibles',
                    dropdownColor: DecormTheme.cardDark,
                    decoration: const InputDecoration(labelText: 'Categoría'),
                    items: const [
                      DropdownMenuItem(value: 'Consumibles', child: Text('Consumibles')),
                      DropdownMenuItem(value: 'Herrajes', child: Text('Herrajes')),
                      DropdownMenuItem(value: 'Pinturas', child: Text('Pinturas')),
                      DropdownMenuItem(value: 'Lijas', child: Text('Lijas')),
                      DropdownMenuItem(value: 'Selladores y Silicones', child: Text('Selladores y Silicones')),
                      DropdownMenuItem(value: 'Equipos', child: Text('Equipos')),
                    ],
                    onChanged: (val) => setDialogState(() => categoria = val!),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: unidad.isNotEmpty ? unidad : 'Unidad',
                          dropdownColor: DecormTheme.cardDark,
                          decoration: const InputDecoration(labelText: 'Unidad'),
                          items: AppConstants.unidades.map((u) {
                            return DropdownMenuItem(value: u, child: Text(u));
                          }).toList(),
                          onChanged: (val) => setDialogState(() => unidad = val!),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: minController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Stock Mín.'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: provController,
                    decoration: const InputDecoration(labelText: 'Proveedor Preferido'),
                  ),
                  const SizedBox(height: 12),
                  // Bloque de Conteo Físico a Mano (Auditoría en Bodega)
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: DecormTheme.primaryAmber.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: DecormTheme.primaryAmber.withOpacity(0.2)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Conteo Físico a Mano (Auditoría en Bodega)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: DecormTheme.primaryAmber,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextField(
                          controller: conteoController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Stock Físico Contado a Mano',
                            prefixIcon: Icon(Icons.inventory_2_outlined, color: DecormTheme.primaryAmber, size: 20),
                          ),
                        ),
                      ],
                    ),
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
                onPressed: isSaving
                    ? null
                    : () async {
                        setDialogState(() => isSaving = true);
                        try {
                          final changes = <String, dynamic>{
                            'descripcion': descController.text.trim(),
                            'categoria': categoria,
                            'unidad': unidad,
                            'proveedor_pref': provController.text.trim(),
                            'stock_minimo': num.tryParse(minController.text.trim()) ?? item.stockMinimo,
                          };
                          final conteoNum = num.tryParse(conteoController.text.trim());
                          if (conteoNum != null) {
                            changes['ultimo_conteo'] = conteoNum;
                            changes['fecha_conteo'] = DateFormat('yyyy-MM-dd').format(DateTime.now());
                          }
                          await bodega.updateArticulo(item.sku, changes);
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

  @override
  Widget build(BuildContext context) {
    final bodega = Provider.of<BodegaProvider>(context);
    final catalogo = bodega.catalogo;

    final filtered = catalogo.where((a) {
      final matchSearch = a.sku.toLowerCase().contains(_search.toLowerCase()) ||
          a.descripcion.toLowerCase().contains(_search.toLowerCase());
      final matchCat = _selectedCategory == 'Todas' ||
          a.categoria.toLowerCase().contains(_selectedCategory.toLowerCase());
      return matchSearch && matchCat;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Catálogo de Artículos & Stock'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: DecormTheme.primaryAmber,
        foregroundColor: const Color(0xFF0F172A),
        icon: const Icon(Icons.add),
        label: const Text('NUEVO ARTÍCULO', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: () => _mostrarDialogoNuevoArticulo(context),
      ),
      body: Column(
        children: [
          // Search box
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Buscar por SKU o descripción...',
                prefixIcon: Icon(Icons.search, color: DecormTheme.textSecondary),
              ),
              onChanged: (val) => setState(() => _search = val),
            ),
          ),

          // Horizontal category filters
          SizedBox(
            height: 38,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final cat = _categories[index];
                final isSelected = _selectedCategory == cat;
                return ChoiceChip(
                  label: Text(cat),
                  selected: isSelected,
                  selectedColor: DecormTheme.primaryAmber,
                  backgroundColor: DecormTheme.cardDark,
                  labelStyle: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isSelected
                        ? const Color(0xFF0F172A)
                        : DecormTheme.textSecondary,
                  ),
                  onSelected: (_) => setState(() => _selectedCategory = cat),
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // List of SKUs with Edit button
          Expanded(
            child: filtered.isEmpty
                ? const Center(
                    child: Text(
                      'No se encontraron artículos.',
                      style: TextStyle(color: DecormTheme.textSecondary),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final item = filtered[index];
                      final isLow = item.stockActual <= item.stockMinimo;
                      final isOut = item.stockActual <= 0;

                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: DecormTheme.cardDark,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isOut
                                ? DecormTheme.statusDanger.withOpacity(0.5)
                                : isLow
                                    ? DecormTheme.statusWarning.withOpacity(0.4)
                                    : DecormTheme.cardBorder,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  item.sku,
                                  style: const TextStyle(
                                    fontFamily: 'monospace',
                                    fontWeight: FontWeight.bold,
                                    color: DecormTheme.primaryAmber,
                                    fontSize: 13,
                                  ),
                                ),
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: isOut
                                            ? DecormTheme.statusDanger.withOpacity(0.15)
                                            : isLow
                                                ? DecormTheme.statusWarning
                                                    .withOpacity(0.15)
                                                : DecormTheme.statusSuccess
                                                    .withOpacity(0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        isOut
                                            ? 'AGOTADO'
                                            : isLow
                                                ? 'STOCK BAJO'
                                                : 'NORMAL',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: isOut
                                              ? DecormTheme.statusDanger
                                              : isLow
                                                  ? DecormTheme.statusWarning
                                                  : DecormTheme.statusSuccess,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    // Edit button
                                    IconButton(
                                      constraints: const BoxConstraints(),
                                      padding: EdgeInsets.zero,
                                      icon: const Icon(Icons.edit_outlined,
                                          size: 18, color: DecormTheme.primaryAmber),
                                      onPressed: () =>
                                          _mostrarDialogoEditarArticulo(context, item),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.descripcion,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  '${item.categoria} · ${item.unidad}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: DecormTheme.textSecondary,
                                  ),
                                ),
                                Row(
                                  children: [
                                    Text(
                                      'Mín: ${item.stockMinimo} | ',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: DecormTheme.textSecondary,
                                      ),
                                    ),
                                    Text(
                                      '${item.stockActual} u.',
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w900,
                                        color: isOut
                                            ? DecormTheme.statusDanger
                                            : isLow
                                                ? DecormTheme.statusWarning
                                                : DecormTheme.statusSuccess,
                                      ),
                                    ),
                                  ],
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
