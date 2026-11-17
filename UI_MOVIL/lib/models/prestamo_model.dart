class PrestamoModel {
  final int? rowNumber;
  final String? idPrestamo;
  final String fechaSalida;
  final String persona;
  final String skuEquipo;
  final String? descripcionEquipo;
  final num cantPrestada;
  final num cantDevuelta;
  final String tallerProyecto;
  final String? estadoPrestamo;
  final String? observaciones;

  PrestamoModel({
    this.rowNumber,
    this.idPrestamo,
    required this.fechaSalida,
    required this.persona,
    required this.skuEquipo,
    this.descripcionEquipo,
    required this.cantPrestada,
    required this.cantDevuelta,
    required this.tallerProyecto,
    this.estadoPrestamo,
    this.observaciones,
  });

  factory PrestamoModel.fromJson(Map<String, dynamic> json) {
    return PrestamoModel(
      rowNumber: json['_rowNumber'] is int ? json['_rowNumber'] : null,
      idPrestamo: json['id_prestamo']?.toString(),
      fechaSalida: json['fecha_salida']?.toString() ?? '',
      persona: json['persona']?.toString() ?? '',
      skuEquipo: json['sku_equipo']?.toString() ?? '',
      descripcionEquipo: json['descripcion_equipo']?.toString(),
      cantPrestada: num.tryParse(json['cant_prestada']?.toString() ?? '0') ?? 0,
      cantDevuelta: num.tryParse(json['cant_devuelta']?.toString() ?? '0') ?? 0,
      tallerProyecto: json['taller_proyecto']?.toString() ?? '',
      estadoPrestamo: json['estado_prestamo']?.toString(),
      observaciones: json['observaciones']?.toString(),
    );
  }
}
