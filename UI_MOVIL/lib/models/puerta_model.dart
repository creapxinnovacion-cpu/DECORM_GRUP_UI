class PuertaModel {
  final String skuPuerta;
  final String cliente;
  final String modelo;
  final String taller;
  final String diaEntrega;
  final num unidades;
  final String estado;
  final String? medidas;
  final String? color;

  PuertaModel({
    required this.skuPuerta,
    required this.cliente,
    required this.modelo,
    required this.taller,
    required this.diaEntrega,
    required this.unidades,
    required this.estado,
    this.medidas,
    this.color,
  });

  factory PuertaModel.fromJson(Map<String, dynamic> json) {
    return PuertaModel(
      skuPuerta: json['sku_puerta']?.toString() ?? '',
      cliente: json['cliente']?.toString() ?? '',
      modelo: json['modelo']?.toString() ?? '',
      taller: json['taller']?.toString() ?? '',
      diaEntrega: json['dia_entrega']?.toString() ?? '',
      unidades: num.tryParse(json['unidades']?.toString() ?? '1') ?? 1,
      estado: json['estado']?.toString() ?? 'En Proceso',
      medidas: json['medidas']?.toString(),
      color: json['color']?.toString(),
    );
  }
}
