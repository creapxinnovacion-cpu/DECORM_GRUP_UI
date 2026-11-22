import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/articulo_model.dart';
import '../models/movimiento_model.dart';
import '../models/prestamo_model.dart';
import '../models/puerta_model.dart';
import '../models/seguimiento_model.dart';

class ApiService {
  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  Future<Map<String, dynamic>> _call(String action, [Map<String, dynamic>? params]) async {
    final payload = {
      'action': action,
      'token': _token ?? '',
      'requestId': 'req_${DateTime.now().millisecondsSinceEpoch}',
      'params': params ?? {},
    };

    try {
      final response = await http.post(
        Uri.parse(ApiConfig.baseUrl),
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: jsonEncode(payload),
      ).timeout(ApiConfig.timeout);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body);
        if (decoded['ok'] == true) {
          return decoded['data'] is Map<String, dynamic>
              ? decoded['data'] as Map<String, dynamic>
              : {'result': decoded['data']};
        } else {
          throw Exception(decoded['error']?['message'] ?? 'Error del servidor');
        }
      } else {
        throw Exception('Error HTTP: ${response.statusCode}');
      }
    } catch (e) {
      final uri = Uri.parse(ApiConfig.baseUrl).replace(queryParameters: {
        'action': action,
        if (_token != null && _token!.isNotEmpty) 'token': _token,
        if (params != null && params.isNotEmpty) 'params': jsonEncode(params),
      });

      final getResp = await http.get(uri).timeout(ApiConfig.timeout);
      final decoded = jsonDecode(getResp.body);
      if (decoded['ok'] == true) {
        return decoded['data'] is Map<String, dynamic>
            ? decoded['data'] as Map<String, dynamic>
            : {'result': decoded['data']};
      } else {
        throw Exception(decoded['error']?['message'] ?? 'Error en la petición');
      }
    }
  }

  // Auth Login
  Future<Map<String, dynamic>> login(String username, String pin) async {
    final res = await _call('auth.login', {'username': username, 'pin': pin});
    _token = res['token']?.toString();
    return res;
  }

  // Catálogo CRUD
  Future<List<ArticuloModel>> getCatalogo({int pageSize = 150}) async {
    final res = await _call('catalogo.list', {'pageSize': pageSize});
    final rows = res['rows'] as List<dynamic>? ?? [];
    return rows.map((e) => ArticuloModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> createArticulo(Map<String, dynamic> articulo) async {
    await _call('catalogo.create', articulo);
  }

  Future<void> updateArticulo(String sku, Map<String, dynamic> changes) async {
    await _call('catalogo.update', {'sku': sku, 'changes': changes});
  }

  Future<String> getNextSku(String prefijo) async {
    final res = await _call('catalogo.nextSku', {'prefijo': prefijo});
    return res['formatted']?.toString() ?? '$prefijo-100';
  }

  // Compras CRUD
  Future<List<Map<String, dynamic>>> getCompras({int pageSize = 100}) async {
    final res = await _call('compras.list', {'pageSize': pageSize});
    final rows = res['rows'] as List<dynamic>? ?? [];
    return rows.map((e) => e as Map<String, dynamic>).toList();
  }

  Future<void> createCompra(Map<String, dynamic> compra) async {
    await _call('compras.create', compra);
  }

  Future<void> updateCompra(int rowNumber, Map<String, dynamic> changes) async {
    await _call('compras.update', {'rowNumber': rowNumber, 'changes': changes});
  }

  Future<void> clearCompra(int rowNumber) async {
    await _call('compras.clear', {'rowNumber': rowNumber});
  }

  // Movimientos CRUD
  Future<List<MovimientoModel>> getMovimientos({int pageSize = 100}) async {
    final res = await _call('movimientos.list', {'pageSize': pageSize});
    final rows = res['rows'] as List<dynamic>? ?? [];
    return rows.map((e) => MovimientoModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> registrarSalida(MovimientoModel mov) async {
    await _call('movimientos.create', mov.toJson());
  }

  Future<void> updateMovimiento(int rowNumber, Map<String, dynamic> changes) async {
    await _call('movimientos.update', {'rowNumber': rowNumber, 'changes': changes});
  }

  Future<void> clearMovimiento(int rowNumber) async {
    await _call('movimientos.clear', {'rowNumber': rowNumber});
  }

  Future<void> entregarAPuerta({
    required String skuPuerta,
    required String sku,
    required num cantidad,
    required String entregadoA,
    String? observaciones,
  }) async {
    await _call('movimientos.entregarAPuerta', {
      'sku_puerta': skuPuerta,
      'sku': sku,
      'cantidad': cantidad,
      'entregado_a': entregadoA,
      'observaciones': observaciones ?? '',
    });
  }

  // Préstamos CRUD
  Future<List<PrestamoModel>> getPrestamos() async {
    final res = await _call('prestamos.list', {'pageSize': 50});
    final rows = res['rows'] as List<dynamic>? ?? [];
    return rows.map((e) => PrestamoModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> crearPrestamo(Map<String, dynamic> prestamo) async {
    await _call('prestamos.create', prestamo);
  }

  Future<void> devolverPrestamo({
    required int rowNumber,
    required num cantDevuelta,
    required String personaDevuelve,
    String? observaciones,
  }) async {
    await _call('prestamos.devolver', {
      'rowNumber': rowNumber,
      'cantDevuelta': cantDevuelta,
      'personaDevuelve': personaDevuelve,
      'observaciones': observaciones ?? '',
    });
  }

  // Puertas CRUD
  Future<List<PuertaModel>> getPuertas() async {
    final res = await _call('puertas.list', {'pageSize': 50});
    final rows = res['rows'] as List<dynamic>? ?? [];
    return rows.map((e) => PuertaModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> createPuerta(Map<String, dynamic> puerta) async {
    await _call('puertas.create', puerta);
  }

  Future<void> updatePuerta(String skuPuerta, Map<String, dynamic> changes) async {
    await _call('puertas.update', {'sku_puerta': skuPuerta, 'changes': changes});
  }

  // Seguimiento Conteo Manual CRUD
  Future<List<SeguimientoModel>> getSeguimiento() async {
    final res = await _call('seguimiento.list', {'pageSize': 50});
    final rows = res['rows'] as List<dynamic>? ?? [];
    return rows.map((e) => SeguimientoModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> upsertSeguimiento(SeguimientoModel item) async {
    await _call('seguimiento.upsert', item.toJson());
  }

  // Dashboard summary
  Future<Map<String, dynamic>> getDashboard() async {
    return await _call('dashboard.get', {'tolerancia': 0});
  }

  // Insumos Instaladores (Multi-insumo Batch & Descuento Atómico R-32)
  Future<List<Map<String, dynamic>>> getInsumosInstaladores({int pageSize = 100}) async {
    final res = await _call('instaladores.list', {'pageSize': pageSize});
    final rows = res['rows'] as List<dynamic>? ?? [];
    return rows.map((e) => e as Map<String, dynamic>).toList();
  }

  Future<Map<String, dynamic>> createInsumosInstaladoresBatch(
    Map<String, dynamic> cabecera,
    List<Map<String, dynamic>> lineas,
  ) async {
    return await _call('instaladores.createBatch', {
      'cabecera': cabecera,
      'lineas': lineas,
    });
  }

  // Cotizaciones v4.1 (CRUD & Cambio de Estado)
  Future<List<Map<String, dynamic>>> getCotizaciones({String? estado, String? proveedor}) async {
    final res = await _call('cotizaciones.list', {
      if (estado != null) 'estado': estado,
      if (proveedor != null) 'proveedor': proveedor,
    });
    final rows = res['rows'] as List<dynamic>? ?? [];
    return rows.map((e) => e as Map<String, dynamic>).toList();
  }

  Future<Map<String, dynamic>> createCotizacion(
    Map<String, dynamic> cabecera,
    List<Map<String, dynamic>> lineas,
  ) async {
    return await _call('cotizaciones.create', {
      'cabecera': cabecera,
      'lineas': lineas,
    });
  }

  Future<void> setEstadoCotizacion(String cotId, String estado) async {
    await _call('cotizaciones.setEstado', {
      'cot_id': cotId,
      'estado': estado,
    });
  }
}
