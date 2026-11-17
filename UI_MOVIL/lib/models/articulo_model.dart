class ArticuloModel {
  final String sku;
  final String descripcion;
  final String categoria;
  final String unidad;
  final num stockInicial;
  final num stockActual;
  final num stockMinimo;
  final num pmp;
  final num valorInventario;
  final String estado;

  ArticuloModel({
    required this.sku,
    required this.descripcion,
    required this.categoria,
    required this.unidad,
    required this.stockInicial,
    required this.stockActual,
    required this.stockMinimo,
    required this.pmp,
    required this.valorInventario,
    required this.estado,
  });

  factory ArticuloModel.fromJson(Map<String, dynamic> json) {
    return ArticuloModel(
      sku: json['sku']?.toString() ?? '',
      descripcion: json['descripcion']?.toString() ?? '',
      categoria: json['categoria']?.toString() ?? '',
      unidad: json['unidad']?.toString() ?? 'Unidad',
      stockInicial: num.tryParse(json['stock_inicial']?.toString() ?? '0') ?? 0,
      stockActual: num.tryParse(json['stock_actual']?.toString() ?? '0') ?? 0,
      stockMinimo: num.tryParse(json['stock_minimo']?.toString() ?? '0') ?? 0,
      pmp: num.tryParse(json['pmp']?.toString() ?? '0') ?? 0,
      valorInventario: num.tryParse(json['valor_inventario']?.toString() ?? '0') ?? 0,
      estado: json['estado']?.toString() ?? 'NORMAL',
    );
  }
}
