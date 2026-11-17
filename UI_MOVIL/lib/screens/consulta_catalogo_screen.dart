import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/bodega_provider.dart';
import '../config/theme.dart';

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
    'Herrajes',
    'Pinturas',
    'Lijas',
    'Selladores y Silicones',
    'Consumibles',
    'Equipos',
  ];

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
        title: const Text('Consulta de Catálogo & Stock'),
      ),
      body: Column(
        children: [
          // Search box
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Buscar por SKU o descripción...',
                prefixIcon: Icon(Icons.search,
                    color: DecormTheme.textSecondary),
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

          // List of SKUs
          Expanded(
            child: filtered.isEmpty
                ? const Center(
                    child: Text(
                      'No se encontraron artículos.',
                      style: TextStyle(color: DecormTheme.textSecondary),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
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
