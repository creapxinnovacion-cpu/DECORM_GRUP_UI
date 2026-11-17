import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/api_service.dart';
import 'providers/auth_provider.dart';
import 'providers/bodega_provider.dart';
import 'config/theme.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final apiService = ApiService();
  final authProvider = AuthProvider(apiService);
  await authProvider.tryAutoLogin();

  runApp(
    MultiProvider(
      providers: [
        Provider<ApiService>.value(value: apiService),
        ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ChangeNotifierProvider<BodegaProvider>(
          create: (_) => BodegaProvider(apiService),
        ),
      ],
      child: const DecormMovilApp(),
    ),
  );
}

class DecormMovilApp extends StatelessWidget {
  const DecormMovilApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        return MaterialApp(
          title: 'DECORM Móvil',
          debugShowCheckedModeBanner: false,
          theme: DecormTheme.darkTheme,
          home: auth.isAuthenticated ? const HomeScreen() : const LoginScreen(),
        );
      },
    );
  }
}
