import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'api.dart';
import 'theme.dart';

class Stage extends StatelessWidget {
  const Stage({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(color: voidColor),
      child: Stack(
        children: [
          const Positioned(left: -80, top: -40, child: _Glow(color: indigo, size: 280)),
          const Positioned(right: -60, top: 20, child: _Glow(color: pink, size: 220, alpha: 0.18)),
          child,
        ],
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  const _Glow({required this.color, required this.size, this.alpha = 0.28});
  final Color color;
  final double size;
  final double alpha;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(colors: [color.withValues(alpha: alpha), Colors.transparent]),
      ),
    );
  }
}

class LogoMark extends StatelessWidget {
  const LogoMark({this.size = 42, super.key});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(size * 0.3), gradient: brand),
      padding: EdgeInsets.all(size * 0.045),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFF0B0F22),
          borderRadius: BorderRadius.circular(size * 0.28),
        ),
        child: CustomPaint(painter: _PlayPainter()),
      ),
    );
  }
}

class _PlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width * 0.34, size.height * 0.26)
      ..lineTo(size.width * 0.34, size.height * 0.74)
      ..lineTo(size.width * 0.74, size.height * 0.5)
      ..close();
    final paint = Paint()
      ..shader = const LinearGradient(colors: [Color(0xFF6FA2FF), Color(0xFF8B6BFF), pink]).createShader(Offset.zero & size);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class Wordmark extends StatelessWidget {
  const Wordmark({super.key});

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        LogoMark(size: 36),
        SizedBox(width: 10),
        Text('Game', style: TextStyle(fontFamily: 'Unbounded', fontWeight: FontWeight.w700, fontSize: 22, color: Colors.white)),
        Text('Con', style: TextStyle(fontFamily: 'Unbounded', fontWeight: FontWeight.w700, fontSize: 22, color: pink)),
      ],
    );
  }
}

class Glass extends StatelessWidget {
  const Glass({required this.child, this.padding = const EdgeInsets.all(14), super.key});
  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.045),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: child,
    );
  }
}

class Avatar extends StatelessWidget {
  const Avatar({required this.name, this.url, this.size = 44, this.online = false, super.key});
  final String? url;
  final String name;
  final double size;
  final bool online;

  @override
  Widget build(BuildContext context) {
    final photo = absolute(url);
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        children: [
          ClipOval(
            child: photo == null
                ? Container(
                    color: indigo,
                    alignment: Alignment.center,
                    child: Text(name.isEmpty ? '?' : name[0].toUpperCase(), style: unbounded.copyWith(fontSize: size * 0.38)),
                  )
                : CachedNetworkImage(imageUrl: photo, fit: BoxFit.cover, width: size, height: size),
          ),
          if (online)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: size * 0.28,
                height: size * 0.28,
                decoration: BoxDecoration(
                  color: const Color(0xFF34D399),
                  shape: BoxShape.circle,
                  border: Border.all(color: voidColor, width: 2),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({required this.label, required this.onPressed, super.key});
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onPressed == null ? 0.5 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(16),
          child: Ink(
            height: 52,
            decoration: BoxDecoration(gradient: brand, borderRadius: BorderRadius.circular(16)),
            child: Center(child: Text(label, style: const TextStyle(fontFamily: 'Onest', fontWeight: FontWeight.w600, fontSize: 16, color: Colors.white))),
          ),
        ),
      ),
    );
  }
}

class GcField extends StatelessWidget {
  const GcField({required this.controller, required this.label, this.obscure = false, this.onSubmit, super.key});
  final TextEditingController controller;
  final String label;
  final bool obscure;
  final VoidCallback? onSubmit;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      onSubmitted: (_) => onSubmit?.call(),
      style: onest,
      cursorColor: cyan,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: onest.copyWith(color: muted),
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.03),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.12))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: indigo)),
      ),
    );
  }
}

class ChipRow extends StatelessWidget {
  const ChipRow({required this.options, required this.selected, required this.onSelect, super.key});
  final List<(String, String)> options;
  final String selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final option in options) ...[
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(option.$2, style: onest.copyWith(fontSize: 13)),
                selected: selected == option.$1,
                onSelected: (_) => onSelect(option.$1),
                selectedColor: indigo.withValues(alpha: 0.45),
                backgroundColor: Colors.white.withValues(alpha: 0.04),
                side: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
                labelStyle: TextStyle(color: selected == option.$1 ? Colors.white : muted),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class Remote extends StatefulWidget {
  const Remote({required this.load, required this.builder, this.watch, super.key});
  final Future<Map<String, dynamic>> Function() load;
  final Widget Function(Map<String, dynamic> data, Future<void> Function() reload) builder;
  final Object? watch;

  @override
  State<Remote> createState() => _RemoteState();
}

class _RemoteState extends State<Remote> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.load();
  }

  @override
  void didUpdateWidget(Remote oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.watch != widget.watch) _future = widget.load();
  }

  Future<void> _reload() async {
    setState(() => _future = widget.load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator(color: indigo));
        }
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('${snapshot.error}', textAlign: TextAlign.center, style: onest),
                  TextButton(onPressed: _reload, child: const Text('Спробувати знову', style: TextStyle(color: cyan))),
                ],
              ),
            ),
          );
        }
        return widget.builder(snapshot.data ?? {}, _reload);
      },
    );
  }
}

class UserTile extends StatelessWidget {
  const UserTile({required this.user, this.trailing, super.key});
  final Map<String, dynamic> user;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final name = text(user['name']) ?? 'GameCon';
    return InkWell(
      onTap: () {
        final username = text(user['username']);
        if (username != null) context.push('/u/$username');
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Avatar(url: text(user['avatar_url']), name: name, online: user['is_online'] == true),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: onest.copyWith(fontWeight: FontWeight.w600)),
                  Text(
                    text(user['status']) ?? text(user['city']) ?? '@${text(user['username']) ?? ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: onest.copyWith(color: muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            ?trailing,
          ],
        ),
      ),
    );
  }
}

class PostCard extends StatelessWidget {
  const PostCard({required this.post, required this.onLike, required this.onComment, super.key});
  final Map<String, dynamic> post;
  final VoidCallback onLike;
  final VoidCallback onComment;

  @override
  Widget build(BuildContext context) {
    final author = post['author'] is Map ? Map<String, dynamic>.from(post['author'] as Map) : <String, dynamic>{};
    final images = maps(post['attachments']).map((a) => absolute(a['url'])).whereType<String>().toList();
    final music = post['music'] is Map ? Map<String, dynamic>.from(post['music'] as Map) : null;
    final name = text(author['name']) ?? 'GameCon';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Glass(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: () {
                final username = text(author['username']);
                if (username != null) context.push('/u/$username');
              },
              child: Row(
                children: [
                  Avatar(url: text(author['avatar_url']), name: name, size: 40, online: author['is_online'] == true),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: onest.copyWith(fontWeight: FontWeight.w600)),
                      Text('@${text(author['username']) ?? ''}', style: onest.copyWith(color: muted, fontSize: 12)),
                    ],
                  ),
                ],
              ),
            ),
            if (text(post['body']) != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(text(post['body'])!, style: onest)),
            if (images.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: CachedNetworkImage(imageUrl: images.first, height: 220, width: double.infinity, fit: BoxFit.cover),
                ),
              ),
            if (music != null && text(music['title']) != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('${text(music['artist']) ?? ''} — ${text(music['title'])}', style: onest.copyWith(color: cyan, fontSize: 13)),
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                IconButton(
                  onPressed: onLike,
                  icon: Icon(post['liked'] == true ? Icons.favorite : Icons.favorite_border, color: post['liked'] == true ? pink : muted, size: 20),
                ),
                Text('${post['likes_count'] ?? 0}', style: onest.copyWith(color: muted, fontSize: 13)),
                TextButton(onPressed: onComment, child: Text('${post['comments_count'] ?? 0} коментарів', style: onest.copyWith(color: muted, fontSize: 13))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class ScreenScroll extends StatelessWidget {
  const ScreenScroll({required this.children, this.onRefresh, super.key});
  final List<Widget> children;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final list = ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: children,
    );
    if (onRefresh == null) return list;
    return RefreshIndicator(color: indigo, onRefresh: onRefresh!, child: list);
  }
}

Future<void> openComments(BuildContext context, Api api, int postId) {
  final body = TextEditingController();
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: deep,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (sheet) {
      return Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(sheet).bottom),
        child: SizedBox(
          height: MediaQuery.sizeOf(sheet).height * 0.7,
          child: Remote(
            load: () => api.get('/api/v1/posts/$postId/comments'),
            builder: (data, reload) {
              final comments = maps(data['comments']);
              return Column(
                children: [
                  const Padding(padding: EdgeInsets.all(16), child: Text('Коментарі', style: TextStyle(fontFamily: 'Unbounded', color: ink, fontSize: 18))),
                  Expanded(
                    child: ListView(
                      children: [
                        if (comments.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('Ще немає коментарів', style: TextStyle(color: muted, fontFamily: 'Onest'))),
                        for (final comment in comments)
                          ListTile(
                            title: Text(text((comment['user'] is Map ? comment['user']['name'] : null)) ?? 'Гравець', style: onest.copyWith(fontWeight: FontWeight.w600)),
                            subtitle: Text(text(comment['body']) ?? '', style: onest),
                          ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: Row(
                      children: [
                        Expanded(child: GcField(controller: body, label: 'Коментар')),
                        IconButton(
                          onPressed: () async {
                            final value = body.text.trim();
                            if (value.isEmpty) return;
                            try {
                              await api.post('/api/v1/posts/$postId/comments', {'body': value});
                              body.clear();
                              await reload();
                            } catch (e) {
                              if (sheet.mounted) ScaffoldMessenger.of(sheet).showSnackBar(SnackBar(content: Text('$e')));
                            }
                          },
                          icon: const Icon(Icons.send_rounded, color: cyan),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      );
    },
  );
}

String pageTitleFrom(String path) {
  return switch (path) {
    '/feed' => 'Новини',
    '/messages' => 'Чати',
    '/friends' => 'Друзі',
    '/people' => 'Люди',
    '/profile' => 'Сторінка',
    '/communities' => 'Спільноти',
    '/photos' => 'Фото',
    '/music' => 'Музика',
    '/cinema' => 'Кіно',
    '/families' => 'Сім’ї',
    '/servers' => 'Сервери',
    '/notifications' => 'Сповіщення',
    '/settings' => 'Налаштування',
    _ => 'GameCon',
  };
}
