import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/bodega_provider.dart';
import '../models/prestamo_model.dart';
import '../models/articulo_model.dart';
import '../config/theme.dart';

class PrestamosScreen extends StatefulWidget {
  const PrestamosScreen({super.key});

  @override
  State<PrestamosScreen> createState() => _PrestamosScreenState();
}

class _PrestamosScreenState extends State<PrestamosScreen> {
  void _mostrarDialogoNuevoPrestamo(BuildContext context) {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    final equipos = bodega.catalogo
        .where((a) =>
            a.sku.startsWith('EQU-') ||
            a.categoria.toLowerCase().contains('equipo'))
        .toList();

    String? selectedSku = equipos.isNotEmpty ? equipos.first.sku : null;
    final personaController = TextEditingController();
    final cantController = TextEditingController(text: '1');
    final tallerController = TextEditingController(text: 'Taller 1');
    final obsController = TextEditingController();
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
                    'Prestar Equipo / Herramienta (EQU)',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: DecormTheme.primaryAmber,
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Equipment dropdown
                  DropdownButtonFormField<String>(
                    value: selectedSku,
                    isExpanded: true,
                    dropdownColor: DecormTheme.cardDark,
                    decoration: const InputDecoration(
                      labelText: 'Equipo a Prestar',
                      prefixIcon: Icon(Icons.build_outlined,
                          color: DecormTheme.primaryAmber),
                    ),
                    items: equipos.map((e) {
                      return DropdownMenuItem(
                        value: e.sku,
                        child: Text('${e.sku} — ${e.descripcion}',
                            overflow: TextOverflow.ellipsis),
                      );
                    }).toList(),
                    onChanged: (val) => setModalState(() => selectedSku = val),
                  ),
                  const SizedBox(height: 12),

                  // Persona
                  TextField(
                    controller: personaController,
                    decoration: const InputDecoration(
                      labelText: 'Persona Responsable',
                      prefixIcon: Icon(Icons.person_outline,
                          color: DecormTheme.primaryAmber),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Cantidad & Taller
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: cantController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Cantidad',
                            prefixIcon: Icon(Icons.numbers,
                                color: DecormTheme.primaryAmber),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: tallerController,
                          decoration: const InputDecoration(
                            labelText: 'Taller / Proyecto',
                            prefixIcon: Icon(Icons.location_on_outlined,
                                color: DecormTheme.primaryAmber),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Obs
                  TextField(
                    controller: obsController,
                    decoration: const InputDecoration(
                      labelText: 'Observaciones / Estado físico',
                      prefixIcon: Icon(Icons.notes_outlined,
                          color: DecormTheme.primaryAmber),
                    ),
                  ),
                  const SizedBox(height: 18),

                  ElevatedButton(
                    onPressed: isSaving
                        ? null
                        : () async {
                            if (selectedSku == null ||
                                personaController.text.trim().isEmpty) {
                              return;
                            }
                            setModalState(() => isSaving = true);
                            try {
                              await bodega.registrarPrestamo({
                                'fecha_salida': DateFormat('yyyy-MM-dd')
                                    .format(DateTime.now()),
                                'persona': personaController.text.trim(),
                                'sku_equipo': selectedSku,
                                'cant_prestada':
                                    int.parse(cantController.text.trim()),
                                'cant_devuelta': 0,
                                'taller_proyecto': tallerController.text.trim(),
                                'observaciones': obsController.text.trim(),
                              });
                              if (ctx.mounted) Navigator.pop(ctx);
                            } finally {
                              setModalState(() => isSaving = false);
                            }
                          },
                    child: Text(
                        isSaving ? 'GUARDANDO...' : 'REGISTRAR PRÉSTAMO'),
                  ),
                ],
              ),
            ),
          );
        });
      },
    );
  }

  void _mostrarDialogoDevolucion(BuildContext context, PrestamoModel p) {
    final bodega = Provider.of<BodegaProvider>(context, listen: false);
    final cantPendiente = p.cantPrestada - p.cantDevuelta;
    final cantDevolverController =
        TextEditingController(text: '$cantPendiente');
    final personaController = TextEditingController(text: p.persona);
    final obsController = TextEditingController();
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: DecormTheme.cardDark,
            title: const Text(
              'Devolución de Herramienta',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: DecormTheme.statusSuccess),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${p.skuEquipo} — ${p.descripcionEquipo ?? ""}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: DecormTheme.primaryAmber),
                ),
                Text(
                  'Prestado a: ${p.persona} (${p.cantPrestada} u.)',
                  style: const TextStyle(
                      fontSize: 11, color: DecormTheme.textSecondary),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: cantDevolverController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Cantidad a Devolver',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: personaController,
                  decoration: const InputDecoration(
                    labelText: 'Persona que entrega',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: obsController,
                  decoration: const InputDecoration(
                    labelText: 'Estado al recibir',
                  ),
                ),
              ],
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
                        final n = num.tryParse(cantDevolverController.text);
                        if (n == null || n <= 0 || p.rowNumber == null) return;
                        setDialogState(() => isSaving = true);
                        try {
                          await bodega.devolverPrestamo(
                            rowNumber: p.rowNumber!,
                            cantDevuelta: n,
                            personaDevuelve: personaController.text.trim(),
                            observaciones: obsController.text.trim(),
                          );
                          if (ctx.mounted) Navigator.pop(ctx);
                        } finally {
                          setDialogState(() => isSaving = false);
                        }
                      },
                child: Text(isSaving ? 'GUARDANDO...' : 'CONFIRMAR'),
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
    final prestamos = bodega.prestamos;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Préstamos de Herramientas'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: DecormTheme.primaryAmber,
        foregroundColor: const Color(0xFF0F172A),
        icon: const Icon(Icons.add),
        label: const Text('PRESTAR',
            style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: () => _mostrarDialogoNuevoPrestamo(context),
      ),
      body: prestamos.isEmpty
          ? const Center(
              child: Text(
                'No hay herramientas en préstamo actualmente.',
                style: TextStyle(color: DecormTheme.textSecondary),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: prestamos.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final p = prestamos[index];
                final isDevuelto = p.cantDevuelta >= p.cantPrestada;
                final isParcial =
                    p.cantDevuelta > 0 && p.cantDevuelta < p.cantPrestada;

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
                            p.skuEquipo,
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
                              color: isDevuelto
                                  ? DecormTheme.statusSuccess.withOpacity(0.15)
                                  : isParcial
                                      ? DecormTheme.statusWarning
                                          .withOpacity(0.15)
                                      : DecormTheme.statusDanger
                                          .withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              isDevuelto
                                  ? 'DEVUELTO'
                                  : isParcial
                                      ? 'PARCIAL'
                                      : 'PENDIENTE',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: isDevuelto
                                    ? DecormTheme.statusSuccess
                                    : isParcial
                                        ? DecormTheme.statusWarning
                                        : DecormTheme.statusDanger,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        p.descripcionEquipo ?? 'Equipo de Bodega',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Responsable: ${p.persona}',
                            style: const TextStyle(
                                fontSize: 11,
                                color: DecormTheme.textSecondary),
                          ),
                          Text(
                            'Cant: ${p.cantPrestada} u. (Dev: ${p.cantDevuelta})',
                            style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: DecormTheme.textPrimary),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Destino: ${p.tallerProyecto} · Fecha: ${p.fechaSalida}',
                        style: const TextStyle(
                            fontSize: 10, color: DecormTheme.textSecondary),
                      ),
                      if (!isDevuelto) ...[
                        const SizedBox(height: 10),
                        Align(
                          alignment: Alignment.centerRight,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor:
                                  DecormTheme.statusSuccess.withOpacity(0.15),
                              foregroundColor: DecormTheme.statusSuccess,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 8),
                            ),
                            icon: const Icon(Icons.replay, size: 14),
                            label: const Text('Devolver a Bodega',
                                style: TextStyle(fontSize: 11)),
                            onPressed: () =>
                                _mostrarDialogoDevolucion(context, p),
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
    );
  }
}
