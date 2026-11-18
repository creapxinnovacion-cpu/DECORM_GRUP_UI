import 'package:flutter/material.dart';
import '../models/articulo_model.dart';
import '../config/theme.dart';

class SkuPickerDialog extends StatefulWidget {
  final List<ArticuloModel> articulos;
  final String? initialSku;

  const SkuPickerDialog({
    super.key,
    required this.articulos,
    this.initialSku,
  });

  static Future<ArticuloModel?> show(
    BuildContext context, {
    required List<ArticuloModel> articulos,
    String? initialSku,
  }) {
    return showModalBottomSheet<ArticuloModel>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SkuPickerDialog(
        articulos: articulos,
        initialSku: initialSku,
      ),
    );
  }

  @override
  State<SkuPickerDialog> createState() => _SkuPickerDialogState();
}

class _SkuPickerDialogState extends State<SkuPickerDialog> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _filter = '';

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() {
      setState(() {
        _filter = _searchCtrl.text.trim().toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = widget.articulos.where((a) {
      if (_filter.isEmpty) return true;
      return a.sku.toLowerCase().contains(_filter) ||
          a.descripcion.toLowerCase().contains(_filter) ||
          a.categoria.toLowerCase().contains(_filter);
    }).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.78,
      decoration: const BoxDecoration(
        color: DecormTheme.cardDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Seleccionar Insumo',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white54),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          // Search Field
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: TextField(
              controller: _searchCtrl,
              autofocus: true,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Buscar por SKU o palabra clave (ej: lija, disco)...',
                hintStyle: const TextStyle(color: Colors.white38, fontSize: 13),
                prefixIcon: const Icon(Icons.search, color: DecormTheme.primaryAmber),
                suffixIcon: _filter.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: Colors.white54, size: 18),
                        onPressed: () => _searchCtrl.clear(),
                      )
                    : null,
                filled: true,
                fillColor: DecormTheme.backgroundDark,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: DecormTheme.cardBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: DecormTheme.primaryAmber),
                ),
              ),
            ),
          ),

          // Count
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '${filtered.length} artículos encontrados',
                style: const TextStyle(color: Colors.white38, fontSize: 12),
              ),
            ),
          ),

          const Divider(color: DecormTheme.cardBorder, height: 16),

          // List
          Expanded(
            child: filtered.isEmpty
                ? const Center(
                    child: Text(
                      'No se encontraron artículos.',
                      style: TextStyle(color: Colors.white38),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const Divider(color: Colors.white10, height: 1),
                    itemBuilder: (context, index) {
                      final item = filtered[index];
                      final isSelected = item.sku == widget.initialSku;
                      final inStock = item.stockActual > 0;

                      return ListTile(
                        onTap: () => Navigator.pop(context, item),
                        tileColor: isSelected ? const Color(0x22F59E0B) : null,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        title: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0x2AF59E0B),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0x66F59E0B)),
                              ),
                              child: Text(
                                item.sku,
                                style: const TextStyle(
                                  color: DecormTheme.primaryAmber,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                  fontFamily: 'monospace',
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                item.descripcion,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            item.categoria,
                            style: const TextStyle(color: Colors.white38, fontSize: 11),
                          ),
                        ),
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: inStock ? const Color(0x2A10B981) : const Color(0x2AF43F5E),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'Stock: ${item.stockActual} ${item.unidad}',
                            style: TextStyle(
                              color: inStock ? DecormTheme.statusSuccess : DecormTheme.statusDanger,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
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
