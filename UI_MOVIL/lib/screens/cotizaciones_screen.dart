import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/bodega_provider.dart';
import '../config/theme.dart';
import '../widgets/sku_picker_dialog.dart';

class CotizacionesScreen extends StatefulWidget {
  const CotizacionesScreen({super.key});

  @override
  State<CotizacionesScreen> createState() => _CotizacionesScreenState();
}

class _CotizacionesScreenState extends State<CotizacionesScreen> {
  bool _isLoading = false;
  List<Map<String, dynamic>> _cotizaciones = [];
  String _filtroEstado = 'TODAS';

  @override
  void initState() {
    super.initState();
    _cargarCotizaciones();
  }

  Future<void> _cargarCotizaciones() async {
    setState(() => _isLoading = true);
    try {
      final bodega = Provider.of<BodegaProvider>(context, listen: false);
      final list = await bodega.getCotizaciones();
      setState(() {
        _cotizaciones = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al cargar cotizaciones: $e'),
            backgroundColor: DecormTheme.statusDanger,
          ),
        );
      }
    }
  }

  Color _colorPorEstado(String estado) {
    switch (estado.toUpperCase()) {
      case 'APROBADA':
      case 'RECIBIDA':
        return DecormTheme.statusSuccess;
      case 'ENVIADA':
        return DecormTheme.statusInfo;
      case 'BORRADOR':
        return DecormTheme.primaryAmber;
      case 'RECHAZADA':
        return DecormTheme.statusDanger;
      default:
        return DecormTheme.textSecondary;
    }
  }

  void _mostrarModalNuevaCotizacion() {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    final articulos = bodega.catalogo;
    final provController = TextEditingController();
    final notasController = TextEditingController();
    String? selectedSku = articulos.isNotEmpty ? articulos.first.sku : null;
    final cantController = TextEditingController(text: '1');
    final precioController = TextEditingController(text: '0.00');

    final List<Map<String, dynamic>> lineas = [];
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: DecormTheme.cardDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            double totalCotizacion = lineas.fold(
              0.0,
              (sum, item) => sum + ((item['cantidad'] as num) * (item['precio_unitario'] as num)),
            );

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
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Nueva Cotización (v4.1)',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: DecormTheme.primaryAmber,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: DecormTheme.textSecondary),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Proveedor
                    TextField(
                      controller: provController,
                      decoration: const InputDecoration(
                        labelText: 'Nombre del Proveedor *',
                        prefixIcon: Icon(Icons.business, color: DecormTheme.primaryAmber),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Notas
                    TextField(
                      controller: notasController,
                      decoration: const InputDecoration(
                        labelText: 'Notas / Observaciones',
                        prefixIcon: Icon(Icons.notes, color: DecormTheme.primaryAmber),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Agregar Item
                    const Text(
                      'AGREGAR ÍTEM A COTIZAR',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: DecormTheme.textSecondary,
                        letterSpacing: 1.0,
                      ),
                    ),
                    const SizedBox(height: 8),

                    // SKU Picker
                    InkWell(
                      onTap: () async {
                        final picked = await SkuPickerDialog.show(
                          context,
                          articulos: articulos,
                          initialSku: selectedSku,
                        );
                        if (picked != null) {
                          setModalState(() {
                            selectedSku = picked.sku;
                            if (picked.pmp > 0) {
                              precioController.text = picked.pmp.toStringAsFixed(2);
                            }
                          });
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: DecormTheme.backgroundDark,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: DecormTheme.cardBorder),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.search, color: DecormTheme.primaryAmber, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                selectedSku != null
                                    ? '$selectedSku - ${articulos.firstWhere((a) => a.sku == selectedSku, orElse: () => articulos.first).descripcion}'
                                    : 'Seleccionar SKU...',
                                style: TextStyle(
                                  color: selectedSku != null
                                      ? DecormTheme.textPrimary
                                      : DecormTheme.textSecondary,
                                  fontSize: 13,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),

                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: cantController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Cantidad',
                              prefixIcon: Icon(Icons.numbers, color: DecormTheme.primaryAmber),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: precioController,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: const InputDecoration(
                              labelText: 'Precio Unit. (\$)',
                              prefixIcon: Icon(Icons.attach_money, color: DecormTheme.statusSuccess),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: DecormTheme.backgroundDark,
                        foregroundColor: DecormTheme.primaryAmber,
                        side: const BorderSide(color: DecormTheme.primaryAmber),
                      ),
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Agregar Línea'),
                      onPressed: () {
                        if (selectedSku == null) return;
                        final cant = double.tryParse(cantController.text) ?? 1.0;
                        final precio = double.tryParse(precioController.text) ?? 0.0;
                        final art = articulos.firstWhere((a) => a.sku == selectedSku, orElse: () => articulos.first);

                        setModalState(() {
                          lineas.add({
                            'sku': selectedSku,
                            'descripcion': art.descripcion,
                            'cantidad': cant,
                            'precio_unitario': precio,
                            'subtotal': cant * precio,
                          });
                          cantController.text = '1';
                        });
                      },
                    ),

                    if (lineas.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      const Text(
                        'LÍNEAS DE LA COTIZACIÓN:',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: DecormTheme.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        constraints: const BoxConstraints(maxHeight: 180),
                        decoration: BoxDecoration(
                          color: DecormTheme.backgroundDark,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: lineas.length,
                          separatorBuilder: (_, __) => const Divider(color: DecormTheme.cardBorder, height: 1),
                          itemBuilder: (ctx, i) {
                            final item = lineas[i];
                            return ListTile(
                              dense: true,
                              title: Text(
                                '${item['sku']} - ${item['descripcion']}',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(
                                'Cant: ${item['cantidad']} × \$${(item['precio_unitario'] as num).toStringAsFixed(2)} = \$${(item['subtotal'] as num).toStringAsFixed(2)}',
                                style: const TextStyle(fontSize: 11, color: DecormTheme.primaryAmber),
                              ),
                              trailing: IconButton(
                                icon: const Icon(Icons.delete_outline, color: DecormTheme.statusDanger, size: 18),
                                onPressed: () {
                                  setModalState(() {
                                    lineas.removeAt(i);
                                  });
                                },
                              ),
                            );
                          },
                        ),
                      ),
                    ],

                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'TOTAL ESTIMADO:',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        Text(
                          '\$${totalCotizacion.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: DecormTheme.statusSuccess,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: DecormTheme.primaryAmber,
                        foregroundColor: const Color(0xFF0F172A),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: isSaving || lineas.isEmpty || provController.text.trim().isEmpty
                          ? null
                          : () async {
                              setModalState(() => isSaving = true);
                              try {
                                await bodega.crearCotizacion(
                                  {
                                    'proveedor': provController.text.trim(),
                                    'notas': notasController.text.trim(),
                                    'estado': 'BORRADOR',
                                    'total_estimado': totalCotizacion,
                                  },
                                  lineas,
                                );
                                if (ctx.mounted) Navigator.pop(ctx);
                                _cargarCotizaciones();
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('✓ Cotización guardada en Google Sheets'),
                                      backgroundColor: DecormTheme.statusSuccess,
                                    ),
                                  );
                                }
                              } catch (e) {
                                setModalState(() => isSaving = false);
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Error al crear cotización: $e'),
                                      backgroundColor: DecormTheme.statusDanger,
                                    ),
                                  );
                                }
                              }
                            },
                      child: isSaving
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(color: Color(0xFF0F172A), strokeWidth: 2),
                            )
                          : const Text(
                              'Guardar Cotización en Sheets',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _cambiarEstadoDialog(Map<String, dynamic> cot) {
    final cotId = cot['id_cotizacion']?.toString() ?? '';
    final estadoActual = cot['estado']?.toString() ?? 'BORRADOR';
    final estados = ['BORRADOR', 'ENVIADA', 'APROBADA', 'RECIBIDA', 'RECHAZADA'];

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: DecormTheme.cardDark,
          title: Text(
            'Estado: $cotId',
            style: const TextStyle(color: DecormTheme.primaryAmber, fontSize: 16),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: estados.map((est) {
              final isSel = est == estadoActual;
              return ListTile(
                dense: true,
                leading: Icon(
                  isSel ? Icons.radio_button_checked : Icons.radio_button_off,
                  color: _colorPorEstado(est),
                ),
                title: Text(
                  est,
                  style: TextStyle(
                    color: isSel ? DecormTheme.textPrimary : DecormTheme.textSecondary,
                    fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
                onTap: () async {
                  Navigator.pop(ctx);
                  try {
                    final bodega = Provider.of<BodegaProvider>(context, listen: false);
                    await bodega.setEstadoCotizacion(cotId, est);
                    _cargarCotizaciones();
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('✓ Estado actualizado a $est'),
                          backgroundColor: DecormTheme.statusSuccess,
                        ),
                      );
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Error al cambiar estado: $e'),
                          backgroundColor: DecormTheme.statusDanger,
                        ),
                      );
                    }
                  }
                },
              );
            }).toList(),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final cotizacionesFiltradas = _filtroEstado == 'TODAS'
        ? _cotizaciones
        : _cotizaciones.where((c) => (c['estado']?.toString().toUpperCase() ?? '') == _filtroEstado).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cotizaciones v4.1'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: DecormTheme.primaryAmber),
            onPressed: _cargarCotizaciones,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: DecormTheme.primaryAmber,
        foregroundColor: const Color(0xFF0F172A),
        icon: const Icon(Icons.add),
        label: const Text('Nueva Cotización', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: _mostrarModalNuevaCotizacion,
      ),
      body: Column(
        children: [
          // Filtros por Estado
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: DecormTheme.cardDark,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: ['TODAS', 'BORRADOR', 'ENVIADA', 'APROBADA', 'RECIBIDA', 'RECHAZADA'].map((est) {
                  final isSel = _filtroEstado == est;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      selected: isSel,
                      label: Text(est),
                      selectedColor: DecormTheme.primaryAmber.withOpacity(0.25),
                      checkmarkColor: DecormTheme.primaryAmber,
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                        color: isSel ? DecormTheme.primaryAmber : DecormTheme.textSecondary,
                      ),
                      onSelected: (val) {
                        setState(() => _filtroEstado = est);
                      },
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          // Listado
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: DecormTheme.primaryAmber))
                : cotizacionesFiltradas.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.request_quote_outlined, size: 64, color: DecormTheme.textSecondary),
                            const SizedBox(height: 12),
                            Text(
                              _filtroEstado == 'TODAS'
                                  ? 'No hay cotizaciones registradas'
                                  : 'No hay cotizaciones en estado $_filtroEstado',
                              style: const TextStyle(color: DecormTheme.textSecondary),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        color: DecormTheme.primaryAmber,
                        backgroundColor: DecormTheme.cardDark,
                        onRefresh: _cargarCotizaciones,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: cotizacionesFiltradas.length,
                          itemBuilder: (ctx, i) {
                            final cot = cotizacionesFiltradas[i];
                            final id = cot['id_cotizacion']?.toString() ?? 'COT-???';
                            final prov = cot['proveedor']?.toString() ?? 'Proveedor';
                            final estado = cot['estado']?.toString() ?? 'BORRADOR';
                            final fecha = cot['fecha']?.toString() ?? '';
                            final total = (cot['total_estimado'] as num?)?.toDouble() ?? 0.0;
                            final estadoColor = _colorPorEstado(estado);

                            return Card(
                              margin: const EdgeInsets.only(bottom: 12),
                              color: DecormTheme.cardDark,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                                side: BorderSide(color: DecormTheme.cardBorder),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          id,
                                          style: const TextStyle(
                                            color: DecormTheme.primaryAmber,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14,
                                          ),
                                        ),
                                        InkWell(
                                          onTap: () => _cambiarEstadoDialog(cot),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: estadoColor.withOpacity(0.15),
                                              borderRadius: BorderRadius.circular(20),
                                              border: Border.all(color: estadoColor.withOpacity(0.4)),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Text(
                                                  estado,
                                                  style: TextStyle(
                                                    color: estadoColor,
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                                const SizedBox(width: 4),
                                                Icon(Icons.edit, size: 12, color: estadoColor),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      prov,
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: DecormTheme.textPrimary,
                                      ),
                                    ),
                                    if (fecha.isNotEmpty) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        'Fecha: $fecha',
                                        style: const TextStyle(color: DecormTheme.textSecondary, fontSize: 12),
                                      ),
                                    ],
                                    const SizedBox(height: 10),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        const Text(
                                          'Monto Total Cotizado:',
                                          style: TextStyle(color: DecormTheme.textSecondary, fontSize: 12),
                                        ),
                                        Text(
                                          '\$${total.toStringAsFixed(2)}',
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: DecormTheme.statusSuccess,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
