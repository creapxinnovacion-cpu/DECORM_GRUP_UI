import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/bodega_provider.dart';
import '../models/puerta_model.dart';
import '../config/theme.dart';

class EntregaPuertaScreen extends StatefulWidget {
  const EntregaPuertaScreen({super.key});

  @override
  State<EntregaPuertaScreen> createState() => _EntregaPuertaScreenState();
}

class _EntregaPuertaScreenState extends State<EntregaPuertaScreen> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedSkuPuerta;
  String? _selectedSkuInsumo;
  final _cantidadController = TextEditingController(text: '1');
  final _entregadoAController = TextEditingController();
  final _observacionesController = TextEditingController();
  bool _isSaving = false;

  @override
  Widget build(BuildContext context) {
    final bodega = Provider.of<BodegaProvider>(context);
    final puertas = bodega.puertas;
    final articulos = bodega.catalogo;

    PuertaModel? selectedPuerta;
    if (_selectedSkuPuerta != null) {
      try {
        selectedPuerta =
            puertas.firstWhere((p) => p.skuPuerta == _selectedSkuPuerta);
      } catch (_) {}
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Entregar Insumo a Puerta'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Door selector
              const Text(
                'Seleccione la Puerta de Producción',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: DecormTheme.textSecondary),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: _selectedSkuPuerta,
                isExpanded: true,
                dropdownColor: DecormTheme.cardDark,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.meeting_room_outlined,
                      color: DecormTheme.statusInfo),
                  hintText: '-- Seleccionar Puerta --',
                ),
                items: puertas.map((p) {
                  return DropdownMenuItem<String>(
                    value: p.skuPuerta,
                    child: Text(
                      '${p.skuPuerta} — ${p.cliente} (${p.modelo})',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12),
                    ),
                  );
                }).toList(),
                onChanged: (val) => setState(() => _selectedSkuPuerta = val),
                validator: (val) =>
                    val == null ? 'Debe seleccionar una puerta' : null,
              ),
              const SizedBox(height: 12),

              // Door detail info
              if (selectedPuerta != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: DecormTheme.cardDark,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: DecormTheme.cardBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Taller: ${selectedPuerta.taller}',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: DecormTheme.primaryAmber,
                                fontSize: 12),
                          ),
                          Text(
                            'Entrega: ${selectedPuerta.diaEntrega}',
                            style: const TextStyle(
                                fontSize: 11,
                                color: DecormTheme.textSecondary),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Medidas: ${selectedPuerta.medidas ?? "Estándar"} · Color: ${selectedPuerta.color ?? "-"}',
                        style: const TextStyle(
                            fontSize: 11, color: DecormTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 16),

              // Insumo selector
              const Text(
                'Insumo a Entregar',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: DecormTheme.textSecondary),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: _selectedSkuInsumo,
                isExpanded: true,
                dropdownColor: DecormTheme.cardDark,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.inventory_2_outlined,
                      color: DecormTheme.primaryAmber),
                  hintText: '-- Seleccionar Insumo --',
                ),
                items: articulos.map((a) {
                  return DropdownMenuItem<String>(
                    value: a.sku,
                    child: Text(
                      '${a.sku} — ${a.descripcion} (Stock: ${a.stockActual})',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12),
                    ),
                  );
                }).toList(),
                onChanged: (val) => setState(() => _selectedSkuInsumo = val),
                validator: (val) =>
                    val == null ? 'Debe seleccionar un insumo' : null,
              ),
              const SizedBox(height: 16),

              // Quantity
              TextFormField(
                controller: _cantidadController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Cantidad a Despachar',
                  prefixIcon: Icon(Icons.numbers,
                      color: DecormTheme.primaryAmber),
                ),
                validator: (val) {
                  final n = num.tryParse(val ?? '');
                  if (n == null || n <= 0) return 'Cantidad inválida';
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Entregado a
              TextFormField(
                controller: _entregadoAController,
                decoration: const InputDecoration(
                  labelText: 'Entregado a (Armador / Carpintero)',
                  prefixIcon: Icon(Icons.person_outline,
                      color: DecormTheme.primaryAmber),
                  hintText: 'Nombre del operario responsable',
                ),
                validator: (val) =>
                    val == null || val.trim().isEmpty ? 'Requerido' : null,
              ),
              const SizedBox(height: 16),

              // Observaciones
              TextFormField(
                controller: _observacionesController,
                decoration: const InputDecoration(
                  labelText: 'Notas Técnicas (Opcional)',
                  prefixIcon: Icon(Icons.notes_outlined,
                      color: DecormTheme.primaryAmber),
                  hintText: 'Ej: Para bisagras de cazoleta o marco',
                ),
              ),
              const SizedBox(height: 24),

              // Submit
              ElevatedButton.icon(
                onPressed: _isSaving ? null : _confirmarEntrega,
                icon: _isSaving
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF0F172A),
                        ),
                      )
                    : const Icon(Icons.done_all),
                label: Text(
                    _isSaving ? 'DESPACHANDO...' : 'CONFIRMAR ENTREGA A PUERTA'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmarEntrega() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);

    try {
      final bodega = Provider.of<BodegaProvider>(context, listen: false);
      await bodega.entregarAPuerta(
        skuPuerta: _selectedSkuPuerta!,
        sku: _selectedSkuInsumo!,
        cantidad: num.parse(_cantidadController.text.trim()),
        entregadoA: _entregadoAController.text.trim(),
        observaciones: _observacionesController.text.trim(),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('¡Material entregado y vinculado a la puerta!'),
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
