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

class _SalidasScreenState extends State<SalidasScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _formKey = GlobalKey<FormState>();
  String? _selectedSku;
  String _tallerDestino = 'Taller 1';
  final _cantidadController = TextEditingController(text: '1');
  final _entregadoAController = TextEditingController();
  final _observacionesController = TextEditingController();
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _mostrarDialogoEditarMovimiento(BuildContext context, MovimientoModel m) {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    final cantController = TextEditingController(text: '${m.cantidad}');
    final personaController = TextEditingController(text: m.entregadoA ?? '');
    final tallerController = TextEditingController(text: m.tallerDestino);
    final obsController = TextEditingController(text: m.observaciones ?? '');
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: DecormTheme.cardDark,
            title: Text(
              'Editar Salida — ${m.id ?? m.sku}',
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
                    'SKU: ${m.sku} (${m.fecha})',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: cantController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Cantidad'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: tallerController,
                    decoration: const InputDecoration(labelText: 'Taller / Destino'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: personaController,
                    decoration: const InputDecoration(labelText: 'Entregado a'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: obsController,
                    decoration: const InputDecoration(labelText: 'Observaciones'),
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
                        final n = num.tryParse(cantController.text.trim());
                        if (n == null) return;
                        setDialogState(() => isSaving = true);
                        try {
                          // Extract rowNumber from id or position if available
                          int rowNum = 2;
                          if (m.id != null && m.id!.startsWith('MOV-')) {
                            rowNum = (int.tryParse(m.id!.replaceFirst('MOV-', '')) ?? 1) + 1;
                          }
                          await bodega.updateMovimiento(rowNum, {
                            'cantidad': n,
                            'taller_destino': tallerController.text.trim(),
                            'entregado_a': personaController.text.trim(),
                            'observaciones': obsController.text.trim(),
                          });
                          if (ctx.mounted) Navigator.pop(ctx);
                        } finally {
                          setDialogState(() => isSaving = false);
                        }
                      },
                child: Text(isSaving ? 'GUARDANDO...' : 'ACTUALIZAR'),
              ),
            ],
          );
        });
      },
    );
  }

  void _anularMovimiento(BuildContext context, MovimientoModel m) async {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    int rowNum = 2;
    if (m.id != null && m.id!.startsWith('MOV-')) {
      rowNum = (int.tryParse(m.id!.replaceFirst('MOV-', '')) ?? 1) + 1;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: DecormTheme.cardDark,
        title: const Text('¿Anular / Limpiar Movimiento?',
            style: TextStyle(color: DecormTheme.statusDanger)),
        content: Text('Se limpiará la fila R$rowNum de ${m.sku} (${m.cantidad} u.) en Sheets.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('CANCELAR')),
          ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: DecormTheme.statusDanger),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('ANULAR FILA')),
        ],
      ),
    );

    if (confirm == true) {
      await bodega.clearMovimiento(rowNum);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Fila de movimiento limpiada en Sheets.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bodega = Provider.of<BodegaProvider>(context);
    final articulos = bodega.catalogo;
    final movimientos = bodega.movimientos;

    ArticuloModel? selectedArticulo;
    if (_selectedSku != null) {
      try {
        selectedArticulo = articulos.firstWhere((a) => a.sku == _selectedSku);
      } catch (_) {}
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Movimientos & Salidas'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: DecormTheme.primaryAmber,
          labelColor: DecormTheme.primaryAmber,
          unselectedLabelColor: DecormTheme.textSecondary,
          tabs: const [
            Tab(text: 'NUEVA SALIDA', icon: Icon(Icons.add_shopping_cart, size: 18)),
            Tab(text: 'HISTORIAL CRUD', icon: Icon(Icons.history, size: 18)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Formulario Nueva Salida
          SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Seleccione el Insumo',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: DecormTheme.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedSku,
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
                                'Stock Actual:',
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

                  DropdownButtonFormField<String>(
                    initialValue: _tallerDestino,
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

                  TextFormField(
                    controller: _observacionesController,
                    decoration: const InputDecoration(
                      labelText: 'Observaciones (Opcional)',
                      prefixIcon: Icon(Icons.notes_outlined,
                          color: DecormTheme.primaryAmber),
                    ),
                  ),
                  const SizedBox(height: 24),

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

          // Tab 2: Historial con botones de Editar y Eliminar
          movimientos.isEmpty
              ? const Center(
                  child: Text(
                    'No hay movimientos registrados.',
                    style: TextStyle(color: DecormTheme.textSecondary),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: movimientos.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final m = movimientos[index];
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
                                m.id ?? 'MOV-${index + 1}',
                                style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontWeight: FontWeight.bold,
                                  color: DecormTheme.textSecondary,
                                  fontSize: 11,
                                ),
                              ),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: m.tipo == 'Salida'
                                          ? DecormTheme.statusWarning.withOpacity(0.15)
                                          : DecormTheme.statusSuccess.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      m.tipo,
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: m.tipo == 'Salida'
                                            ? DecormTheme.statusWarning
                                            : DecormTheme.statusSuccess,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  IconButton(
                                    constraints: const BoxConstraints(),
                                    padding: EdgeInsets.zero,
                                    icon: const Icon(Icons.edit_outlined,
                                        size: 18, color: DecormTheme.primaryAmber),
                                    onPressed: () =>
                                        _mostrarDialogoEditarMovimiento(context, m),
                                  ),
                                  const SizedBox(width: 8),
                                  IconButton(
                                    constraints: const BoxConstraints(),
                                    padding: EdgeInsets.zero,
                                    icon: const Icon(Icons.delete_outline,
                                        size: 18, color: DecormTheme.statusDanger),
                                    onPressed: () => _anularMovimiento(context, m),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${m.sku} — ${m.descripcion ?? ""}',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              color: DecormTheme.primaryAmber,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Cant: -${m.cantidad} u. · ${m.tallerDestino}',
                                style: const TextStyle(
                                    fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                              Text(
                                m.fecha,
                                style: const TextStyle(
                                    fontSize: 11,
                                    fontFamily: 'monospace',
                                    color: DecormTheme.textSecondary),
                              ),
                            ],
                          ),
                          if (m.entregadoA != null && m.entregadoA!.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                'Entregado a: ${m.entregadoA}',
                                style: const TextStyle(
                                    fontSize: 11, color: DecormTheme.textSecondary),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
        ],
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
        _cantidadController.text = '1';
        _entregadoAController.clear();
        _observacionesController.clear();
        _tabController.animateTo(1);
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
