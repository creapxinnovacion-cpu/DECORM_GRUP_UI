import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/bodega_provider.dart';
import '../config/theme.dart';
import 'login_screen.dart';
import 'salidas_screen.dart';
import 'entrega_puerta_screen.dart';
import 'puertas_screen.dart';
import 'compras_screen.dart';
import 'prestamos_screen.dart';
import 'conteo_fisico_screen.dart';
import 'consulta_catalogo_screen.dart';
import 'instaladores_screen.dart';
import 'cotizaciones_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<BodegaProvider>(context, listen: false).fetchAll();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final bodega = Provider.of<BodegaProvider>(context);

    final user = auth.user;
    final totalSkus = bodega.catalogo.length;
    final prestamosPendientes = bodega.prestamos
        .where((p) => p.cantDevuelta < p.cantPrestada)
        .length;
    final puertasActivas = bodega.puertas.length;
    final totalCompras = bodega.compras.length;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: DecormTheme.primaryAmber,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'DECORM',
                style: TextStyle(
                  color: Color(0xFF0F172A),
                  fontWeight: FontWeight.w900,
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Text('Bodega & Talleres'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: DecormTheme.primaryAmber),
            onPressed: bodega.isLoading ? null : () => bodega.fetchAll(),
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: DecormTheme.statusDanger),
            onPressed: () async {
              await auth.logout();
              if (context.mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
          ),
        ],
      ),
      body: bodega.isLoading && bodega.catalogo.isEmpty
          ? const Center(
              child: CircularProgressIndicator(color: DecormTheme.primaryAmber),
            )
          : RefreshIndicator(
              color: DecormTheme.primaryAmber,
              backgroundColor: DecormTheme.cardDark,
              onRefresh: () => bodega.fetchAll(),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Welcome Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            DecormTheme.cardDark,
                            DecormTheme.cardDark.withOpacity(0.8),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: DecormTheme.cardBorder),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 22,
                            backgroundColor:
                                DecormTheme.primaryAmber.withOpacity(0.2),
                            child: const Icon(
                              Icons.person,
                              color: DecormTheme.primaryAmber,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  user?.nombre.isNotEmpty == true
                                      ? user!.nombre
                                      : (user?.username ?? 'Operario'),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Rol: ${(user?.role ?? 'bodega').toUpperCase()} · ${(user?.taller ?? 'General')}',
                                  style: const TextStyle(
                                    color: DecormTheme.primaryAmber,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Quick Stats Row
                    Row(
                      children: [
                        Expanded(
                          child: _buildMetricCard(
                            title: 'Catálogo',
                            value: totalSkus > 0 ? '$totalSkus' : '128',
                            icon: Icons.inventory_2_outlined,
                            color: DecormTheme.primaryAmber,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildMetricCard(
                            title: 'Préstamos',
                            value: '$prestamosPendientes',
                            icon: Icons.build_outlined,
                            color: DecormTheme.statusWarning,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildMetricCard(
                            title: 'Puertas',
                            value: '$puertasActivas',
                            icon: Icons.meeting_room_outlined,
                            color: DecormTheme.statusInfo,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildMetricCard(
                            title: 'Compras',
                            value: '$totalCompras',
                            icon: Icons.shopping_cart_outlined,
                            color: DecormTheme.statusSuccess,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    const Text(
                      'MÓDULOS OPERATIVOS (CRUD COMPLETO)',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1,
                        color: DecormTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Action 1: Salida a Taller & Historial CRUD
                    _buildActionTile(
                      icon: Icons.local_shipping_outlined,
                      title: 'Salidas de Insumos & Historial',
                      subtitle: 'Registrar, editar y anular salidas a taller',
                      badgeText: 'Salidas CRUD',
                      badgeColor: DecormTheme.primaryAmber,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const SalidasScreen()),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Action 2: Entregar Insumo a Puerta
                    _buildActionTile(
                      icon: Icons.door_sliding_outlined,
                      title: 'Entregar Insumo a Puerta',
                      subtitle: 'Vincular consumo directo a código de puerta',
                      badgeText: 'Despacho',
                      badgeColor: DecormTheme.statusInfo,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const EntregaPuertaScreen()),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Action 3: Agenda de Puertas CRUD
                    _buildActionTile(
                      icon: Icons.meeting_room_outlined,
                      title: 'Agenda de Puertas en Producción',
                      subtitle: 'Crear, editar estado (Pendiente/Proceso/Terminada)',
                      badgeText: '$puertasActivas puertas',
                      badgeColor: DecormTheme.statusInfo,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const PuertasScreen()),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Action 4: Gestión de Compras CRUD
                    _buildActionTile(
                      icon: Icons.shopping_cart_outlined,
                      title: 'Gestión de Compras (DTE)',
                      subtitle: 'Registrar, editar y anular compras con IVA',
                      badgeText: 'Compras CRUD',
                      badgeColor: DecormTheme.statusSuccess,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const ComprasScreen()),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Action 5: Préstamos de Equipos CRUD
                    _buildActionTile(
                      icon: Icons.home_repair_service_outlined,
                      title: 'Préstamos de Herramientas (EQU)',
                      subtitle: 'Control de salida y retorno de herramientas',
                      badgeText: '$prestamosPendientes pend.',
                      badgeColor: prestamosPendientes > 0
                          ? DecormTheme.statusDanger
                          : DecormTheme.statusSuccess,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const PrestamosScreen()),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Action 6: Conteo Físico
                    _buildActionTile(
                      icon: Icons.checklist_outlined,
                      title: 'Toma de Inventario Físico',
                      subtitle: 'Conteo en anaquel (INS-0xx) para conciliación',
                      badgeText: 'Conteo',
                      badgeColor: DecormTheme.statusWarning,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const ConteoFisicoScreen()),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Action 7: Catálogo Maestro CRUD
                    _buildActionTile(
                      icon: Icons.inventory_2_outlined,
                      title: 'Catálogo Maestro & Stock',
                      subtitle: 'Crear SKU, conteo físico a mano, existencias',
                      badgeText: 'Catálogo CRUD',
                      badgeColor: DecormTheme.primaryAmber,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const ConsultaCatalogoScreen()),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Action 8: Insumos a Instaladores (Multi-Insumo)
                    _buildActionTile(
                      icon: Icons.handyman_outlined,
                      title: 'Despacho Insumos Instaladores',
                      subtitle: 'Multi-insumo rápido: lijas, thinner, discos, cerraduras',
                      badgeText: 'v4.1 Multi',
                      badgeColor: DecormTheme.statusWarning,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const InstaladoresScreen()),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Action 9: Cotizaciones y Precios Proveedor
                    _buildActionTile(
                      icon: Icons.request_quote_outlined,
                      title: 'Cotizaciones Proveedores',
                      subtitle: 'Crear cotizaciones, comparar precios y aprobar',
                      badgeText: 'v4.1 Cotiz.',
                      badgeColor: DecormTheme.statusInfo,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const CotizacionesScreen()),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: BoxDecoration(
        color: DecormTheme.cardDark,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: DecormTheme.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: const TextStyle(
              fontSize: 9,
              color: DecormTheme.textSecondary,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required String badgeText,
    required Color badgeColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: DecormTheme.cardDark,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: DecormTheme.cardBorder),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: badgeColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: badgeColor, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: DecormTheme.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: badgeColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                badgeText,
                style: TextStyle(
                  color: badgeColor,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.chevron_right,
              color: DecormTheme.textSecondary,
              size: 18,
            ),
          ],
        ),
      ),
    );
  }
}
