import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/bodega_provider.dart';
import '../models/seguimiento_model.dart';
import '../config/theme.dart';

class ConteoFisicoScreen extends StatefulWidget {
  const ConteoFisicoScreen({super.key});

  @override
  State<ConteoFisicoScreen> createState() => _ConteoFisicoScreenState();
}

class _ConteoFisicoScreenState extends State<ConteoFisicoScreen> {
  String _search = '';

  void _editarConteo(BuildContext context, SeguimientoModel item) {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    final stockController = TextEditingController(text: '${item.stock}');
    final minController = TextEditingController(text: '${item.stockMinimo}');
    final notasController = TextEditingController(text: item.notas ?? '');
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: DecormTheme.cardDark,
            title: Text(
              'Actualizar Conteo: ${item.idArticulo}',
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
                  Text(
                    item.nombreArticulo,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: stockController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Conteo Físico Real (Unidades)',
                      prefixIcon: Icon(Icons.pin,
                          color: DecormTheme.primaryAmber),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: minController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Stock Mínimo',
                      prefixIcon: Icon(Icons.warning_amber_outlined,
                          color: DecormTheme.primaryAmber),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: notasController,
                    decoration: const InputDecoration(
                      labelText: 'Notas / Observaciones de Conteo',
                      prefixIcon: Icon(Icons.notes,
                          color: DecormTheme.primaryAmber),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('CANCELAR',
                    style: TextStyle(color: DecormTheme.textSecondary)),
              ),
              ElevatedButton(
                onPressed: isSaving
                    ? null
                    : () async {
                        final n = num.tryParse(stockController.text.trim());
                        final min = num.tryParse(minController.text.trim());
                        if (n == null) return;
                        setDialogState(() => isSaving = true);
                        try {
                          await bodega.upsertSeguimiento(
                            SeguimientoModel(
                              idArticulo: item.idArticulo,
                              nombreArticulo: item.nombreArticulo,
                              tipo: item.tipo,
                              stock: n,
                              stockMinimo: min ?? item.stockMinimo,
                              estado: item.estado,
                              notas: notasController.text.trim(),
                            ),
                          );
                          if (ctx.mounted) Navigator.pop(ctx);
                        } finally {
                          setDialogState(() => isSaving = false);
                        }
                      },
                child: Text(isSaving ? 'GUARDANDO...' : 'GUARDAR'),
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
    final items = bodega.seguimiento;

    final filtered = items.where((it) {
      final s = _search.toLowerCase();
      return it.idArticulo.toLowerCase().contains(s) ||
          it.nombreArticulo.toLowerCase().contains(s);
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Toma de Inventario Físico'),
      ),
      body: Column(
        children: [
          // Search
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Buscar por INS o nombre...',
                prefixIcon: Icon(Icons.search,
                    color: DecormTheme.textSecondary),
              ),
              onChanged: (val) => setState(() => _search = val),
            ),
          ),

          // Items list
          Expanded(
            child: filtered.isEmpty
                ? const Center(
                    child: Text(
                      'No se encontraron artículos en conteo manual.',
                      style: TextStyle(color: DecormTheme.textSecondary),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final item = filtered[index];
                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: DecormTheme.cardDark,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: DecormTheme.cardBorder),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: DecormTheme.primaryAmber.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                item.idArticulo,
                                style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontWeight: FontWeight.bold,
                                  color: DecormTheme.primaryAmber,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.nombreArticulo,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Tipo: ${item.tipo} · Mín: ${item.stockMinimo}',
                                    style: const TextStyle(
                                      color: DecormTheme.textSecondary,
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '${item.stock} u.',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 16,
                                    color: DecormTheme.statusSuccess,
                                  ),
                                ),
                                IconButton(
                                  constraints: const BoxConstraints(),
                                  padding: const EdgeInsets.only(top: 4),
                                  icon: const Icon(Icons.edit_outlined,
                                      size: 18,
                                      color: DecormTheme.primaryAmber),
                                  onPressed: () => _editarConteo(context, item),
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
