import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../config/theme.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController(text: 'cristian');
  final _pinController = TextEditingController(text: '123456');
  bool _obscurePin = true;

  void _submit() async {
    final username = _usernameController.text.trim();
    final pin = _pinController.text.trim();
    if (username.isEmpty || pin.isEmpty) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.login(username, pin);

    if (success && mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Logo & Header
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: DecormTheme.primaryAmber,
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: DecormTheme.primaryAmber.withOpacity(0.3),
                        blurRadius: 18,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Text(
                      'GD',
                      style: TextStyle(
                        color: Color(0xFF0F172A),
                        fontWeight: FontWeight.w900,
                        fontSize: 28,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'GRUPO DECORM',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'App Móvil de Bodega y Talleres · v2.0',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: DecormTheme.textSecondary,
                  ),
                ),
                const SizedBox(height: 36),

                // Error message
                if (auth.errorMessage != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: DecormTheme.statusDanger.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: DecormTheme.statusDanger.withOpacity(0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline,
                            color: DecormTheme.statusDanger, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            auth.errorMessage!,
                            style: const TextStyle(
                              color: DecormTheme.statusDanger,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Username field
                TextField(
                  controller: _usernameController,
                  decoration: const InputDecoration(
                    labelText: 'Usuario',
                    prefixIcon: Icon(Icons.person_outline,
                        color: DecormTheme.textSecondary),
                  ),
                ),
                const SizedBox(height: 16),

                // PIN field
                TextField(
                  controller: _pinController,
                  keyboardType: TextInputType.number,
                  obscureText: _obscurePin,
                  decoration: InputDecoration(
                    labelText: 'PIN de Acceso',
                    prefixIcon: const Icon(Icons.lock_outline,
                        color: DecormTheme.textSecondary),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePin ? Icons.visibility_off : Icons.visibility,
                        color: DecormTheme.textSecondary,
                      ),
                      onPressed: () =>
                          setState(() => _obscurePin = !_obscurePin),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Submit Button
                ElevatedButton(
                  onPressed: auth.isLoading ? null : _submit,
                  child: auth.isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Color(0xFF0F172A),
                          ),
                        )
                      : const Text(
                          'INGRESAR A BODEGA',
                          style: TextStyle(letterSpacing: 0.5),
                        ),
                ),

                const SizedBox(height: 32),

                // Quick Demo user
                Center(
                  child: TextButton.icon(
                    onPressed: () {
                      _usernameController.text = 'cristian';
                      _pinController.text = '123456';
                    },
                    icon: const Icon(Icons.flash_on,
                        color: DecormTheme.primaryAmber, size: 16),
                    label: const Text(
                      'Usar credenciales cristian (Admin)',
                      style: TextStyle(
                          color: DecormTheme.primaryAmber, fontSize: 12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
