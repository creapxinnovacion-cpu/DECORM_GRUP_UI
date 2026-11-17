import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/bodega_provider.dart';
import '../models/articulo_model.dart';
import '../models/movimiento_model.dart';
import '../config/theme.dart';

class SalidasScreen extends StatefulWidget {
  const SalidasScreen({super.key});

  @override
  State<SalidasScreen> createState() => _SalidasScreenState();
}

class _SalidasScreenState extends State<SalidasScreen> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedSku;
  String _tallerDestino = 'Taller 1';
  final _cantidadController = TextEditingController(text: '1');
  final _entregadoAController = TextEditingController();
  final _observacionesController = TextEditingController();
  bool _isSaving = false;

  @override
  Widget build(BuildContext context) {
    final bodega = Provider.of<BodegaProvider>(context);
    final articulos = bodega.catalogo;

    ArticuloModel? selectedArticulo;
    if (_selectedSku != null) {
      try {
        selectedArticulo =
            articulos.firstWhere((a) => a.sku == _selectedSku);
      } catch (_) {}
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Salida de Insumos a Taller'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Article selection
              const Text(
                'Seleccione el Insumo',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: DecormTheme.textSecondary),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: _selectedSku,
                isExpanded: true,
                dropdownColor: DecormTheme.cardDark,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.inventory_2_outlined,
                      color: DecormTheme.primaryAmber),
                  hintText: '-- Seleccionar SKU --',
                ),
                items: articulos.map((a) {
                  return DropdownMenuItem<String>(
                    value: a.sku,
                    child: Text(
                      '${a.sku} — ${a.descripcion}',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12),
                    ),
                  );
                }).toList(),
                onChanged: (val) => setState(() => _selectedSku = val),
                validator: (val) =>
                    val == null ? 'Debe seleccionar un insumo' : null,
              ),
              const SizedBox(height: 12),

              // Stock preview card
              if (selectedArticulo != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: DecormTheme.cardDark,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: DecormTheme.cardBorder),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            selectedArticulo.categoria,
                            style: const TextStyle(
                                fontSize: 10,
                                color: DecormTheme.textSecondary),
                          ),
                          Text(
                            'Unidad: ${selectedArticulo.unidad}',
                            style: const TextStyle(fontSize: 11),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text(
                            'Stock Actual en Sistema:',
                            style: TextStyle(
                                fontSize: 10,
                                color: DecormTheme.textSecondary),
                          ),
                          Text(
                            '${selectedArticulo.stockActual} u.',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: selectedArticulo.stockActual > 0
                                  ? DecormTheme.statusSuccess
                                  : DecormTheme.statusDanger,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 16),

              // Quantity
              TextFormField(
                controller: _cantidadController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Cantidad a Entregar',
                  prefixIcon: Icon(Icons.numbers,
                      color: DecormTheme.primaryAmber),
                ),
                validator: (val) {
                  final n = num.tryParse(val ?? '');
                  if (n == null || n <= 0) return 'Ingrese una cantidad válida';
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Workshop Destination
              DropdownButtonFormField<String>(
                value: _tallerDestino,
                dropdownColor: DecormTheme.cardDark,
                decoration: const InputDecoration(
                  labelText: 'Taller / Destino',
                  prefixIcon: Icon(Icons.location_on_outlined,
                      color: DecormTheme.primaryAmber),
                ),
                items: const [
                  DropdownMenuItem(value: 'Taller 1', child: Text('Taller 1')),
                  DropdownMenuItem(value: 'Taller 2', child: Text('Taller 2')),
                  DropdownMenuItem(value: 'Taller 3', child: Text('Taller 3')),
                  DropdownMenuItem(
                      value: 'Área de Pintura', child: Text('Área de Pintura')),
                  DropdownMenuItem(
                      value: 'Área de Armado', child: Text('Área de Armado')),
                ],
                onChanged: (val) => setState(() => _tallerDestino = val!),
              ),
              const SizedBox(height: 16),

              // Operator / Person
              TextFormField(
                controller: _entregadoAController,
                decoration: const InputDecoration(
                  labelText: 'Entregado a (Operario / Carpintero)',
                  prefixIcon: Icon(Icons.person_outline,
                      color: DecormTheme.primaryAmber),
                  hintText: 'Nombre de la persona',
                ),
                validator: (val) =>
                    val == null || val.trim().isEmpty ? 'Requerido' : null,
              ),
              const SizedBox(height: 16),

              // Notes
              TextFormField(
                controller: _observacionesController,
                decoration: const InputDecoration(
                  labelText: 'Observaciones (Opcional)',
                  prefixIcon: Icon(Icons.notes_outlined,
                      color: DecormTheme.primaryAmber),
                ),
              ),
              const SizedBox(height: 24),

              // Submit Button
              ElevatedButton.icon(
                onPressed: _isSaving ? null : _guardarSalida,
                icon: _isSaving
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF0F172A),
                        ),
                      )
                    : const Icon(Icons.check_circle_outline),
                label: Text(_isSaving ? 'GUARDANDO...' : 'REGISTRAR SALIDA'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _guardarSalida() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);

    final mov = MovimientoModel(
      fecha: DateFormat('yyyy-MM-dd').format(DateTime.now()),
      tipo: 'Salida',
      sku: _selectedSku!,
      cantidad: num.parse(_cantidadController.text.trim()),
      tallerDestino: _tallerDestino,
      entregadoA: _entregadoAController.text.trim(),
      observaciones: _observacionesController.text.trim(),
    );

    try {
      final bodega = Provider.of<BodegaProvider>(context, listen: false);
      await bodega.registrarSalida(mov);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('¡Salida registrada con éxito en el sistema!'),
            backgroundColor: DecormTheme.statusSuccess,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: DecormTheme.statusDanger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }
}
