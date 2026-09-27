import 'package:flutter/material.dart';
import '../api_client.dart';
import '../app_info.dart';
import '../services/push_notifications.dart';
import '../theme.dart';
import 'login_screen.dart';
import 'member_profile_screen.dart';
import '../widgets/island_top_bar.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  Map<String, dynamic>? _me;
  bool _loading = true;
  String? _error;
  bool _loggingOut = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final me = await ApiClient.instance.me();
      if (mounted) setState(() => _me = me);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Не вдалося завантажити профіль.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.obsidian900,
        title: const Text('Вийти з акаунту?',
            style: TextStyle(color: Colors.white)),
        content: const Text('Доведеться увійти знову.',
            style: TextStyle(color: Colors.white54)),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Скасувати')),
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Вийти')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _loggingOut = true);
    await PushNotifications.instance.unregister();
    await ApiClient.instance.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: const IslandAppBar(title: 'Налаштування'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!,
                          style: const TextStyle(color: Colors.white70)),
                      const SizedBox(height: 12),
                      TextButton(
                          onPressed: _load, child: const Text('Повторити')),
                    ],
                  ),
                )
              : ListView(
                  padding: islandInsets(context, const EdgeInsets.all(20)),
                  children: [
                    InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: _me?['id'] == null
                          ? null
                          : () => Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) =>
                                  MemberProfileScreen(userId: _me!['id'] as int, isSelf: true))),
                      child: Container(
                        padding: const EdgeInsets.all(18),
                        decoration: glassPanelDecoration(),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _me?['name'] as String? ?? '',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w500),
                            ),
                            if (_me?['position'] != null) ...[
                              const SizedBox(height: 4),
                              Text(_me!['position'] as String,
                                  style: TextStyle(
                                      color: AppColors.gold300, fontSize: 13)),
                            ],
                            const SizedBox(height: 10),
                            Text(_me?['email'] as String? ?? '',
                                style: const TextStyle(
                                    color: Colors.white38, fontSize: 13)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    _SettingsTile(
                      icon: Icons.logout,
                      label: _loggingOut ? 'Виходимо…' : 'Вийти з акаунту',
                      danger: true,
                      onTap: _loggingOut ? null : _logout,
                    ),
                    const SizedBox(height: 32),
                    Center(
                      child: Text(
                        'Monsory Connect · збірка $currentBuildNumber',
                        style: const TextStyle(
                            color: Colors.white24, fontSize: 12),
                      ),
                    ),
                  ],
                ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool danger;

  const _SettingsTile(
      {required this.icon,
      required this.label,
      required this.onTap,
      this.danger = false});

  @override
  Widget build(BuildContext context) {
    final color = danger ? const Color(0xFFF87171) : Colors.white;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: glassPanelDecoration(radius: 14),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 14),
            Text(label, style: TextStyle(color: color, fontSize: 15)),
          ],
        ),
      ),
    );
  }
}
