import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService apiService;
  UserModel? _user;
  bool _isLoading = false;
  String? _errorMessage;

  AuthProvider(this.apiService);

  UserModel? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> tryAutoLogin() async {
    final prefs = await SharedPreferences.getInstance();
    if (!prefs.containsKey('user_data')) return;

    final extractedUserData =
        jsonDecode(prefs.getString('user_data')!) as Map<String, dynamic>;
    final token = prefs.getString('auth_token');

    _user = UserModel.fromJson(extractedUserData);
    apiService.setToken(token);
    notifyListeners();
  }

  Future<bool> login(String username, String pin) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await apiService.login(username, pin);
      final userData = res['user'] as Map<String, dynamic>;
      final token = res['token'] as String;

      _user = UserModel.fromJson(userData);
      apiService.setToken(token);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_data', jsonEncode(userData));
      await prefs.setString('auth_token', token);

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _user = null;
    apiService.setToken(null);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user_data');
    await prefs.remove('auth_token');
    notifyListeners();
  }
}
