import 'package:flutter/material.dart';
import '../models/articulo_model.dart';
import '../models/movimiento_model.dart';
import '../models/prestamo_model.dart';
import '../models/puerta_model.dart';
import '../models/seguimiento_model.dart';
import '../services/api_service.dart';

class BodegaProvider extends ChangeNotifier {
  final ApiService apiService;

  List<ArticuloModel> _catalogo = [];
  List<PrestamoModel> _prestamos = [];
  List<PuertaModel> _puertas = [];
  List<SeguimientoModel> _seguimiento = [];
  Map<String, dynamic> _kpis = {};

  bool _isLoading = false;
  String? _error;

  BodegaProvider(this.apiService);

  List<ArticuloModel> get catalogo => _catalogo;
  List<PrestamoModel> get prestamos => _prestamos;
  List<PuertaModel> get puertas => _puertas;
  List<SeguimientoModel> get seguimiento => _seguimiento;
  Map<String, dynamic> get kpis => _kpis;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> fetchAll() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final futures = await Future.wait([
        apiService.getCatalogo(),
        apiService.getPrestamos(),
        apiService.getPuertas(),
        apiService.getSeguimiento(),
        apiService.getDashboard(),
      ]);

      _catalogo = futures[0] as List<ArticuloModel>;
      _prestamos = futures[1] as List<PrestamoModel>;
      _puertas = futures[2] as List<PuertaModel>;
      _seguimiento = futures[3] as List<SeguimientoModel>;
      final dash = futures[4] as Map<String, dynamic>;
      _kpis = dash['kpis'] as Map<String, dynamic>? ?? {};

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> registrarSalida(MovimientoModel mov) async {
    await apiService.registrarSalida(mov);
    await fetchAll();
  }

  Future<void> entregarAPuerta({
    required String skuPuerta,
    required String sku,
    required num cantidad,
    required String entregadoA,
    String? observaciones,
  }) async {
    await apiService.entregarAPuerta(
      skuPuerta: skuPuerta,
      sku: sku,
      cantidad: cantidad,
      entregadoA: entregadoA,
      observaciones: observaciones,
    );
    await fetchAll();
  }

  Future<void> registrarPrestamo(Map<String, dynamic> prestamo) async {
    await apiService.crearPrestamo(prestamo);
    await fetchAll();
  }

  Future<void> devolverPrestamo({
    required int rowNumber,
    required num cantDevuelta,
    required String personaDevuelve,
    String? observaciones,
  }) async {
    await apiService.devolverPrestamo(
      rowNumber: rowNumber,
      cantDevuelta: cantDevuelta,
      personaDevuelve: personaDevuelve,
      observaciones: observaciones,
    );
    await fetchAll();
  }

  Future<void> upsertSeguimiento(SeguimientoModel item) async {
    await apiService.upsertSeguimiento(item);
    await fetchAll();
  }
}
