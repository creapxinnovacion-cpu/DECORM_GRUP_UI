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
  List<MovimientoModel> _movimientos = [];
  List<Map<String, dynamic>> _compras = [];
  Map<String, dynamic> _kpis = {};

  bool _isLoading = false;
  String? _error;

  BodegaProvider(this.apiService);

  List<ArticuloModel> get catalogo => _catalogo;
  List<PrestamoModel> get prestamos => _prestamos;
  List<PuertaModel> get puertas => _puertas;
  List<SeguimientoModel> get seguimiento => _seguimiento;
  List<MovimientoModel> get movimientos => _movimientos;
  List<Map<String, dynamic>> get compras => _compras;
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
        apiService.getMovimientos(),
        apiService.getCompras(),
      ]);

      _catalogo = futures[0] as List<ArticuloModel>;
      _prestamos = futures[1] as List<PrestamoModel>;
      _puertas = futures[2] as List<PuertaModel>;
      _seguimiento = futures[3] as List<SeguimientoModel>;
      final dash = futures[4] as Map<String, dynamic>;
      _kpis = dash['kpis'] as Map<String, dynamic>? ?? {};
      _movimientos = futures[5] as List<MovimientoModel>;
      _compras = futures[6] as List<Map<String, dynamic>>;

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  // Catálogo CRUD
  Future<void> createArticulo(Map<String, dynamic> articulo) async {
    await apiService.createArticulo(articulo);
    await fetchAll();
  }

  Future<void> updateArticulo(String sku, Map<String, dynamic> changes) async {
    await apiService.updateArticulo(sku, changes);
    await fetchAll();
  }

  Future<String> getNextSku(String prefijo) async {
    return await apiService.getNextSku(prefijo);
  }

  // Movimientos CRUD
  Future<void> registrarSalida(MovimientoModel mov) async {
    await apiService.registrarSalida(mov);
    await fetchAll();
  }

  Future<void> updateMovimiento(int rowNumber, Map<String, dynamic> changes) async {
    await apiService.updateMovimiento(rowNumber, changes);
    await fetchAll();
  }

  Future<void> clearMovimiento(int rowNumber) async {
    await apiService.clearMovimiento(rowNumber);
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

  // Compras CRUD
  Future<void> createCompra(Map<String, dynamic> compra) async {
    await apiService.createCompra(compra);
    await fetchAll();
  }

  Future<void> updateCompra(int rowNumber, Map<String, dynamic> changes) async {
    await apiService.updateCompra(rowNumber, changes);
    await fetchAll();
  }

  Future<void> clearCompra(int rowNumber) async {
    await apiService.clearCompra(rowNumber);
    await fetchAll();
  }

  // Préstamos CRUD
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

  // Puertas CRUD
  Future<void> createPuerta(Map<String, dynamic> puerta) async {
    await apiService.createPuerta(puerta);
    await fetchAll();
  }

  Future<void> updatePuerta(String skuPuerta, Map<String, dynamic> changes) async {
    await apiService.updatePuerta(skuPuerta, changes);
    await fetchAll();
  }

  // Seguimiento Conteo Manual CRUD
  Future<void> upsertSeguimiento(SeguimientoModel item) async {
    await apiService.upsertSeguimiento(item);
    await fetchAll();
  }

  // Insumos Instaladores (Multi-Insumo Batch R-32)
  Future<Map<String, dynamic>> registrarInsumosInstaladoresBatch(
    Map<String, dynamic> cabecera,
    List<Map<String, dynamic>> lineas,
  ) async {
    final res = await apiService.createInsumosInstaladoresBatch(cabecera, lineas);
    await fetchAll();
    return res;
  }

  // Cotizaciones v4.1
  Future<List<Map<String, dynamic>>> getCotizaciones({String? estado, String? proveedor}) async {
    return await apiService.getCotizaciones(estado: estado, proveedor: proveedor);
  }

  Future<Map<String, dynamic>> crearCotizacion(
    Map<String, dynamic> cabecera,
    List<Map<String, dynamic>> lineas,
  ) async {
    final res = await apiService.createCotizacion(cabecera, lineas);
    await fetchAll();
    return res;
  }

  Future<void> setEstadoCotizacion(String cotId, String estado) async {
    await apiService.setEstadoCotizacion(cotId, estado);
    await fetchAll();
  }
}
