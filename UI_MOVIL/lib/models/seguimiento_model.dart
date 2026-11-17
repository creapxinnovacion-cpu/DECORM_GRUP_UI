class SeguimientoModel {
  final String idArticulo;
  final String nombreArticulo;
  final String tipo;
  final num stock;
  final num stockMinimo;
  final String? estado;
  final String? notas;

  SeguimientoModel({
    required this.idArticulo,
    required this.nombreArticulo,
    required this.tipo,
    required this.stock,
    required this.stockMinimo,
    this.estado,
    this.notas,
  });

  factory SeguimientoModel.fromJson(Map<String, dynamic> json) {
    return SeguimientoModel(
      idArticulo: json['id_articulo']?.toString() ?? '',
      nombreArticulo: json['nombre_articulo']?.toString() ?? '',
      tipo: json['tipo']?.toString() ?? 'Consumible',
      stock: num.tryParse(json['stock']?.toString() ?? '0') ?? 0,
      stockMinimo: num.tryParse(json['stock_minimo']?.toString() ?? '0') ?? 0,
      estado: json['estado']?.toString(),
      notas: json['notas']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id_articulo': idArticulo,
        'nombre_articulo': nombreArticulo,
        'tipo': tipo,
        'stock': stock,
        'stock_minimo': stockMinimo,
        'estado': estado ?? 'Normal',
        'notas': notas ?? '',
      };
}
