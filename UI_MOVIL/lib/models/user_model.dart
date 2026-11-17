class UserModel {
  final String username;
  final String nombre;
  final String role;
  final String taller;
  final int? exp;

  UserModel({
    required this.username,
    required this.nombre,
    required this.role,
    required this.taller,
    this.exp,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      username: json['username']?.toString() ?? '',
      nombre: json['nombre']?.toString() ?? '',
      role: json['role']?.toString() ?? 'bodega',
      taller: json['taller']?.toString() ?? 'Todos',
      exp: json['exp'] is int ? json['exp'] : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'username': username,
        'nombre': nombre,
        'role': role,
        'taller': taller,
        'exp': exp,
      };
}
