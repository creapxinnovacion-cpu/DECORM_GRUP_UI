class MovimientoModel {
  final String? id;
  final String fecha;
  final String tipo;
  final String sku;
  final String? descripcion;
  final num cantidad;
  final String tallerDestino;
  final String? entregadoA;
  final String? observaciones;

  MovimientoModel({
    this.id,
    required this.fecha,
    required this.tipo,
    required this.sku,
    this.descripcion,
    required this.cantidad,
    required this.tallerDestino,
    this.entregadoA,
    this.observaciones,
  });

  factory MovimientoModel.fromJson(Map<String, dynamic> json) {
    return MovimientoModel(
      id: json['id']?.toString(),
      fecha: json['fecha']?.toString() ?? '',
      tipo: json['tipo']?.toString() ?? 'Salida',
      sku: json['sku']?.toString() ?? '',
      descripcion: json['descripcion']?.toString(),
      cantidad: num.tryParse(json['cantidad']?.toString() ?? '0') ?? 0,
      tallerDestino: json['taller_destino']?.toString() ?? '',
      entregadoA: json['entregado_a']?.toString(),
      observaciones: json['observaciones']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'fecha': fecha,
        'tipo': tipo,
        'sku': sku,
        'cantidad': cantidad,
        'taller_destino': tallerDestino,
        'entregado_a': entregadoA,
        'observaciones': observaciones,
      };
}
