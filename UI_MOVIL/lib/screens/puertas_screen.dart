import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/bodega_provider.dart';
import '../models/puerta_model.dart';
import '../config/theme.dart';
import 'entrega_puerta_screen.dart';

class PuertasScreen extends StatefulWidget {
  const PuertasScreen({super.key});

  @override
  State<PuertasScreen> createState() => _PuertasScreenState();
}

class _PuertasScreenState extends State<PuertasScreen> {
  String _search = '';

  void _mostrarDialogoNuevaPuerta(BuildContext context) {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    final skuController = TextEditingController();
    final clienteController = TextEditingController();
    final modeloController = TextEditingController(text: 'Puerta Principal Enchapada');
    final medidasController = TextEditingController(text: '0.90 x 2.10 m');
    final colorController = TextEditingController(text: 'Nogal');
    String taller = 'Taller 1';
    String estado = 'En Proceso';
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
                    'Registrar Nueva Puerta en Producción',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: DecormTheme.primaryAmber,
                    ),
                  ),
                  const SizedBox(height: 14),

                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: skuController,
                          decoration: const InputDecoration(
                            labelText: 'SKU Puerta',
                            hintText: 'Ej: PTA-005',
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: taller,
                          dropdownColor: DecormTheme.cardDark,
                          decoration: const InputDecoration(labelText: 'Taller'),
                          items: const [
                            DropdownMenuItem(value: 'Taller 1', child: Text('Taller 1')),
                            DropdownMenuItem(value: 'Taller 2', child: Text('Taller 2')),
                            DropdownMenuItem(value: 'Taller 3', child: Text('Taller 3')),
                          ],
                          onChanged: (val) => setModalState(() => taller = val!),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  TextField(
                    controller: clienteController,
                    decoration: const InputDecoration(labelText: 'Cliente / Proyecto'),
                  ),
                  const SizedBox(height: 12),

                  TextField(
                    controller: modeloController,
                    decoration: const InputDecoration(labelText: 'Modelo'),
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: medidasController,
                          decoration: const InputDecoration(labelText: 'Medidas'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: colorController,
                          decoration: const InputDecoration(labelText: 'Color / Acabado'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  ElevatedButton(
                    onPressed: isSaving
                        ? null
                        : () async {
                            if (skuController.text.trim().isEmpty || clienteController.text.trim().isEmpty) return;
                            setModalState(() => isSaving = true);
                            try {
                              await bodega.createPuerta({
                                'sku_puerta': skuController.text.trim().toUpperCase(),
                                'dia_entrega': DateFormat('yyyy-MM-dd').format(DateTime.now().add(const Duration(days: 7))),
                                'cliente': clienteController.text.trim(),
                                'modelo': modeloController.text.trim(),
                                'posicion': 'Izquierda',
                                'unidades': 1,
                                'estado': estado,
                                'medidas': medidasController.text.trim(),
                                'color': colorController.text.trim(),
                                'taller': taller,
                              });
                              if (ctx.mounted) Navigator.pop(ctx);
                            } finally {
                              setModalState(() => isSaving = false);
                            }
                          },
                    child: Text(isSaving ? 'GUARDANDO...' : 'CREAR PUERTA'),
                  ),
                ],
              ),
            ),
          );
        });
      },
    );
  }

  void _mostrarDialogoEditarPuerta(BuildContext context, PuertaModel p) {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    final clienteController = TextEditingController(text: p.cliente);
    final modeloController = TextEditingController(text: p.modelo);
    final medidasController = TextEditingController(text: p.medidas ?? '');
    final colorController = TextEditingController(text: p.color ?? '');
    String estado = p.estado;
    String taller = p.taller;
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: DecormTheme.cardDark,
            title: Text(
              'Editar Puerta — ${p.skuPuerta}',
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
                  DropdownButtonFormField<String>(
                    initialValue: estado,
                    dropdownColor: DecormTheme.cardDark,
                    decoration: const InputDecoration(labelText: 'Estado de Fabricación'),
                    items: const [
                      DropdownMenuItem(value: 'Pendiente', child: Text('Pendiente')),
                      DropdownMenuItem(value: 'En Proceso', child: Text('En Proceso')),
                      DropdownMenuItem(value: 'Terminada', child: Text('Terminada')),
                      DropdownMenuItem(value: 'Entregada', child: Text('Entregada')),
                    ],
                    onChanged: (val) => setDialogState(() => estado = val!),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: clienteController,
                    decoration: const InputDecoration(labelText: 'Cliente'),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: taller,
                    dropdownColor: DecormTheme.cardDark,
                    decoration: const InputDecoration(labelText: 'Taller Asignado'),
                    items: const [
                      DropdownMenuItem(value: 'Taller 1', child: Text('Taller 1')),
                      DropdownMenuItem(value: 'Taller 2', child: Text('Taller 2')),
                      DropdownMenuItem(value: 'Taller 3', child: Text('Taller 3')),
                    ],
                    onChanged: (val) => setDialogState(() => taller = val!),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: modeloController,
                    decoration: const InputDecoration(labelText: 'Modelo'),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: medidasController,
                          decoration: const InputDecoration(labelText: 'Medidas'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: colorController,
                          decoration: const InputDecoration(labelText: 'Color'),
                        ),
                      ),
                    ],
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
                          await bodega.updatePuerta(p.skuPuerta, {
                            'cliente': clienteController.text.trim(),
                            'modelo': modeloController.text.trim(),
                            'medidas': medidasController.text.trim(),
                            'color': colorController.text.trim(),
                            'estado': estado,
                            'taller': taller,
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

  @override
  Widget build(BuildContext context) {
    final bodega = Provider.of<BodegaProvider>(context);
    final puertas = bodega.puertas;

    final filtered = puertas.where((p) {
      final s = _search.toLowerCase();
      return p.skuPuerta.toLowerCase().contains(s) ||
          p.cliente.toLowerCase().contains(s) ||
          p.modelo.toLowerCase().contains(s) ||
          p.taller.toLowerCase().contains(s);
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Agenda de Puertas'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: DecormTheme.primaryAmber,
        foregroundColor: const Color(0xFF0F172A),
        icon: const Icon(Icons.add),
        label: const Text('NUEVA PUERTA', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: () => _mostrarDialogoNuevaPuerta(context),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Buscar por código, cliente o taller...',
                prefixIcon: Icon(Icons.search, color: DecormTheme.textSecondary),
              ),
              onChanged: (val) => setState(() => _search = val),
            ),
          ),
          Expanded(
            child: filtered.isEmpty
                ? const Center(
                    child: Text(
                      'No hay puertas en producción.',
                      style: TextStyle(color: DecormTheme.textSecondary),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final p = filtered[index];
                      final isDone = p.estado.toLowerCase().contains('terminad');

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
                                  p.skuPuerta,
                                  style: const TextStyle(
                                    fontFamily: 'monospace',
                                    fontWeight: FontWeight.bold,
                                    color: DecormTheme.primaryAmber,
                                    fontSize: 14,
                                  ),
                                ),
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: isDone
                                            ? DecormTheme.statusSuccess.withOpacity(0.15)
                                            : DecormTheme.statusWarning.withOpacity(0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        p.estado,
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: isDone
                                              ? DecormTheme.statusSuccess
                                              : DecormTheme.statusWarning,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    IconButton(
                                      constraints: const BoxConstraints(),
                                      padding: EdgeInsets.zero,
                                      icon: const Icon(Icons.edit_outlined, size: 18, color: DecormTheme.primaryAmber),
                                      onPressed: () => _mostrarDialogoEditarPuerta(context, p),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              p.cliente,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            Text(
                              '${p.modelo} · ${p.taller}',
                              style: const TextStyle(fontSize: 11, color: DecormTheme.textSecondary),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Medidas: ${p.medidas ?? "Estándar"}',
                                  style: const TextStyle(fontSize: 11, color: DecormTheme.textSecondary),
                                ),
                                ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: DecormTheme.statusInfo.withOpacity(0.15),
                                    foregroundColor: DecormTheme.statusInfo,
                                    elevation: 0,
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  ),
                                  icon: const Icon(Icons.door_sliding, size: 14),
                                  label: const Text('Entregar Material', style: TextStyle(fontSize: 11)),
                                  onPressed: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => const EntregaPuertaScreen()),
                                  ),
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
