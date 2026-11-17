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
      // POST with text/plain to avoid CORS / preflight
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
      // Fallback via GET
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

  // Catálogo
  Future<List<ArticuloModel>> getCatalogo({int pageSize = 150}) async {
    final res = await _call('catalogo.list', {'pageSize': pageSize});
    final rows = res['rows'] as List<dynamic>? ?? [];
    return rows.map((e) => ArticuloModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  // Movimientos
  Future<void> registrarSalida(MovimientoModel mov) async {
    await _call('movimientos.create', mov.toJson());
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

  // Préstamos
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

  // Puertas
  Future<List<PuertaModel>> getPuertas() async {
    final res = await _call('puertas.list', {'pageSize': 50});
    final rows = res['rows'] as List<dynamic>? ?? [];
    return rows.map((e) => PuertaModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  // Seguimiento Conteo Manual
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
}
