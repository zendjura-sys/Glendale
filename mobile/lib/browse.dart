import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'api.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

class CommunitiesScreen extends StatefulWidget {
  const CommunitiesScreen({required this.session, super.key});
  final Session session;

  @override
  State<CommunitiesScreen> createState() => _CommunitiesScreenState();
}

class _CommunitiesScreenState extends State<CommunitiesScreen> {
  final name = TextEditingController();
  String tab = 'discover';

  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      watch: tab,
      load: () => widget.session.api.get('/api/v1/communities?tab=$tab'),
      builder: (data, reload) {
        final rows = Listing.parse(data['communities']).items;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Text('Спільноти', style: unbounded.copyWith(fontSize: 28)),
            const SizedBox(height: 8),
            ChipRow(
              options: const [('mine', 'Мої'), ('managed', 'Керую'), ('discover', 'Усі')],
              selected: text(data['tab']) ?? tab,
              onSelect: (value) => setState(() => tab = value),
            ),
            const SizedBox(height: 12),
            GcField(controller: name, label: 'Назва нової спільноти'),
            const SizedBox(height: 10),
            PrimaryButton(
              label: 'Створити',
              onPressed: () async {
                final title = name.text.trim();
                if (title.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Вкажіть назву спільноти')));
                  return;
                }
                try {
                  await widget.session.api.post('/api/v1/communities', {
                    'name': title,
                    'type': 'group',
                    'category': 'games',
                    'privacy': 'open',
                  });
                  name.clear();
                  setState(() => tab = 'managed');
                  await reload();
                } catch (e) {
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                }
              },
            ),
            if (rows.isEmpty) const Text('У цій вкладці спільнот немає.', style: TextStyle(color: muted, fontFamily: 'Onest')),
            for (final row in rows)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Glass(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      backgroundColor: indigo,
                      child: Text(
                        () {
                          final label = text(row['name']) ?? '?';
                          return (label.isEmpty ? '?' : label[0]).toUpperCase();
                        }(),
                        style: unbounded.copyWith(fontSize: 16),
                      ),
                    ),
                    title: Text(text(row['name']) ?? '', style: onest.copyWith(fontWeight: FontWeight.w600)),
                    subtitle: Text('${text(row['category_label']) ?? ''} · ${row['members_count'] ?? 0}', style: onest.copyWith(color: muted)),
                    onTap: () {
                      final slug = text(row['slug']);
                      if (slug != null) context.push('/communities/$slug');
                    },
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class CommunityScreen extends StatelessWidget {
  const CommunityScreen({required this.session, required this.slug, super.key});
  final Session session;
  final String slug;

  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => session.api.get('/api/v1/communities/$slug'),
      builder: (data, reload) {
        final community = data['community'] is Map ? Map<String, dynamic>.from(data['community'] as Map) : <String, dynamic>{};
        final posts = Listing.parse(data['posts']).items;
        final member = text(community['membership']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            IconButton(onPressed: () => context.go('/communities'), icon: const Icon(Icons.arrow_back_rounded, color: Colors.white)),
            Text(text(community['name']) ?? slug, style: unbounded.copyWith(fontSize: 26)),
            if (text(community['description']) != null) Text(text(community['description'])!, style: onest.copyWith(color: muted)),
            TextButton(
              onPressed: () async {
                try {
                  if (member == null) {
                    await session.api.post('/api/v1/communities/$slug/join');
                  } else {
                    await session.api.delete('/api/v1/communities/$slug/join');
                  }
                  await reload();
                } catch (e) {
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                }
              },
              child: Text(member == null ? 'Вступити' : 'Покинути', style: const TextStyle(color: cyan)),
            ),
            for (final post in posts)
              PostCard(post: post, onLike: () {}, onComment: () {}),
          ],
        );
      },
    );
  }
}

class PhotosScreen extends StatelessWidget {
  const PhotosScreen({required this.session, this.username, super.key});
  final Session session;
  final String? username;

  @override
  Widget build(BuildContext context) {
    final name = (username != null && username!.isNotEmpty) ? username! : session.username;
    if (name == null || name.isEmpty) {
      return const Center(child: Text('Спочатку відкрийте свою сторінку.', style: TextStyle(color: muted, fontFamily: 'Onest')));
    }
    return Remote(
      load: () => session.api.get('/api/v1/users/$name/photos'),
      builder: (data, reload) {
        final albums = maps(data['albums']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Text('Фото', style: unbounded.copyWith(fontSize: 28)),
            if (albums.isEmpty) const Padding(padding: EdgeInsets.only(top: 16), child: Text('Альбомів немає.', style: TextStyle(color: muted, fontFamily: 'Onest'))),
            for (final album in albums)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Glass(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(text(album['title']) ?? text(album['name']) ?? 'Альбом', style: onest),
                    onTap: () => context.push('/albums/${album['id']}'),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class AlbumScreen extends StatelessWidget {
  const AlbumScreen({required this.session, required this.id, super.key});
  final Session session;
  final int id;

  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => session.api.get('/api/v1/albums/$id'),
      builder: (data, reload) {
        final photos = Listing.parse(data['photos']).items;
        return ScreenScroll(
          onRefresh: reload,
          children: [
            IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_rounded, color: Colors.white)),
            Text(text(data['album'] is Map ? (data['album'] as Map)['title'] : null) ?? 'Альбом', style: unbounded.copyWith(fontSize: 24)),
            for (final photo in photos)
              if (absolute(photo['url']) != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: CachedNetworkImage(imageUrl: absolute(photo['url'])!, height: 240, width: double.infinity, fit: BoxFit.cover),
                  ),
                ),
          ],
        );
      },
    );
  }
}

class MusicScreen extends StatefulWidget {
  const MusicScreen({required this.session, required this.player, super.key});
  final Session session;
  final TrackPlayer player;

  @override
  State<MusicScreen> createState() => _MusicScreenState();
}

class _MusicScreenState extends State<MusicScreen> {
  String tab = 'mine';
  int stamp = 0;

  @override
  void initState() {
    super.initState();
    stamp = widget.session.spotifyStamp;
    widget.session.addListener(_onSession);
  }

  @override
  void dispose() {
    widget.session.removeListener(_onSession);
    super.dispose();
  }

  void _onSession() {
    if (widget.session.spotifyStamp != stamp && mounted) {
      setState(() => stamp = widget.session.spotifyStamp);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      watch: '$tab:$stamp',
      load: () => widget.session.api.get('/api/v1/music?tab=$tab&page=1'),
      builder: (data, reload) {
        final tracks = Listing.parse(data['tracks']).items;
        final spotify = data['spotify'] is Map ? Map<String, dynamic>.from(data['spotify'] as Map) : <String, dynamic>{};
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Text('Музика', style: unbounded.copyWith(fontSize: 28)),
            const SizedBox(height: 8),
            ChipRow(
              options: const [('mine', 'Моє'), ('discover', 'Цікаве'), ('playlists', 'Плейлисти')],
              selected: tab,
              onSelect: (value) => setState(() => tab = value),
            ),
            if (spotify['configured'] == true && spotify['account'] == null) ...[
              const SizedBox(height: 14),
              GhostButton(
                label: 'Під’єднати Spotify',
                icon: Icons.library_music_outlined,
                onPressed: () async {
                  try {
                    final json = await widget.session.api.post('/api/v1/music/spotify/connect');
                    final url = text(json['url']);
                    if (url != null) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
                  } catch (e) {
                    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                  }
                },
              ),
            ],
            if (spotify['account'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Glass(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(
                    children: [
                      const Icon(Icons.library_music_outlined, color: cyan, size: 18),
                      const SizedBox(width: 8),
                      Expanded(child: Text(text(spotify['account'] is Map ? (spotify['account'] as Map)['display_name'] : null) ?? 'Spotify підключено', style: onest.copyWith(fontWeight: FontWeight.w600))),
                    ],
                  ),
                ),
              ),
            if (tracks.isEmpty) const Padding(padding: EdgeInsets.only(top: 16), child: Text('Треків немає.', style: TextStyle(color: muted, fontFamily: 'Onest'))),
            for (final track in tracks)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Glass(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const CircleAvatar(backgroundColor: indigo, child: Icon(Icons.music_note_rounded, color: Colors.white, size: 18)),
                    title: Text(text(track['title']) ?? '', style: onest.copyWith(fontWeight: FontWeight.w600)),
                    subtitle: Text(text(track['artist']) ?? '', style: onest.copyWith(color: muted)),
                    trailing: IconButton(
                      onPressed: () async {
                        final url = absolute(track['url']);
                        if (url == null) return;
                        await widget.player.play(url, text(track['title']) ?? '', text(track['artist']) ?? '');
                        final id = track['id'];
                        if (id != null) {
                          await widget.session.api.post('/api/v1/music/now-playing', {'track_id': id});
                        }
                      },
                      icon: const Icon(Icons.play_circle_fill_rounded, color: cyan),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class CinemaScreen extends StatefulWidget {
  const CinemaScreen({required this.session, super.key});
  final Session session;

  @override
  State<CinemaScreen> createState() => _CinemaScreenState();
}

class _CinemaScreenState extends State<CinemaScreen> {
  final query = TextEditingController();
  final slides = PageController(viewportFraction: 0.9);
  String q = '';

  @override
  void dispose() {
    query.dispose();
    slides.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      watch: q,
      load: () => widget.session.api.get('/api/v1/cinema?q=${Uri.encodeQueryComponent(q)}&page=1'),
      builder: (data, reload) {
        final movies = Listing.parse(data['movies']).items;
        final featured = movies.take(5).toList();
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Text('Кіно', style: unbounded.copyWith(fontSize: 28)),
            const SizedBox(height: 12),
            GcField(controller: query, label: 'Пошук фільму', onSubmit: () => setState(() => q = query.text.trim())),
            if (movies.isEmpty) const Padding(padding: EdgeInsets.only(top: 16), child: Text('Нічого не знайдено.', style: TextStyle(color: muted, fontFamily: 'Onest'))),
            if (featured.isNotEmpty) ...[
              const SectionLabel('Зараз у ефірі'),
              SizedBox(
                height: 210,
                child: PageView.builder(
                  controller: slides,
                  itemCount: featured.length,
                  itemBuilder: (context, index) {
                    final movie = featured[index];
                    return Padding(
                      padding: const EdgeInsets.only(right: 10),
                      child: FeatureBanner(
                        title: text(movie['title']) ?? '',
                        subtitle: '${text(movie['type_label']) ?? ''} · ${movie['year'] ?? ''}',
                        image: text(movie['poster']),
                        onTap: () => _openMovie(context, movie),
                      ),
                    );
                  },
                ),
              ),
            ],
            if (movies.isNotEmpty) const SectionLabel('Каталог'),
            for (var i = 0; i < movies.length; i += 3)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (var column = 0; column < 3; column++)
                      Expanded(
                        child: i + column < movies.length
                            ? PosterTile(
                                title: text(movies[i + column]['title']) ?? '',
                                subtitle: '${movies[i + column]['year'] ?? ''}',
                                image: text(movies[i + column]['poster']),
                                onTap: () => _openMovie(context, movies[i + column]),
                              )
                            : const SizedBox(),
                      ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }

  void _openMovie(BuildContext context, Map<String, dynamic> movie) {
    final slug = text(movie['slug']);
    if (slug != null) context.push('/cinema/$slug');
  }
}

class MovieScreen extends StatefulWidget {
  const MovieScreen({required this.session, required this.slug, super.key});
  final Session session;
  final String slug;

  @override
  State<MovieScreen> createState() => _MovieScreenState();
}

class _MovieScreenState extends State<MovieScreen> {
  String? link;
  WebViewController? player;

  void _open(String raw) {
    final url = _playerUrl(raw);
    if (url == null) return;
    setState(() {
      link = url;
      player = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFF000000))
        ..setUserAgent('Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36')
        ..loadRequest(Uri.https('gamecon.online', '/play/embed', {'src': url}));
    });
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => widget.session.api.get('/api/v1/cinema/${widget.slug}'),
      builder: (data, reload) {
        final movie = data['movie'] is Map ? Map<String, dynamic>.from(data['movie'] as Map) : <String, dynamic>{};
        final players = maps(data['players']);
        final statuses = data['statuses'] is Map ? Map<String, dynamic>.from(data['statuses'] as Map) : <String, dynamic>{};
        final poster = text(movie['poster']) ?? text(movie['backdrop']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: AspectRatio(
                aspectRatio: player != null ? 16 / 9 : 16 / 10,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (player != null)
                      WebViewWidget(controller: player!)
                    else if (absolute(poster) != null)
                      CachedNetworkImage(imageUrl: absolute(poster)!, fit: BoxFit.cover)
                    else
                      const DecoratedBox(decoration: BoxDecoration(gradient: brand)),
                    if (player == null)
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Color(0x6605070F), Colors.transparent, Color(0xF005070F)],
                            stops: [0, 0.45, 1],
                          ),
                        ),
                      ),
                    Positioned(
                      left: 4,
                      top: 4,
                      child: IconButton(
                        onPressed: () => context.go('/cinema'),
                        icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                      ),
                    ),
                    if (player == null && players.isNotEmpty)
                      Center(
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () {
                              final raw = text(players.first['link']);
                              if (raw != null) _open(raw);
                            },
                            customBorder: const CircleBorder(),
                            child: Ink(
                              width: 64,
                              height: 64,
                              decoration: const BoxDecoration(shape: BoxShape.circle, gradient: brand),
                              child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 38),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(text(movie['title']) ?? widget.slug, style: unbounded.copyWith(fontSize: 24)),
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('${text(movie['type_label']) ?? ''} · ${movie['year'] ?? ''}', style: onest.copyWith(color: muted)),
            ),
            if (text(movie['description']) != null)
              Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text(text(movie['description'])!, style: onest.copyWith(height: 1.4))),
            if (players.isNotEmpty) const SectionLabel('Озвучення'),
            for (final source in players)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Glass(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      Icons.play_circle_fill_rounded,
                      color: link == _playerUrl('${source['link']}') ? cyan : muted,
                    ),
                    title: Text(text(source['provider_label']) ?? 'Плеєр', style: onest.copyWith(fontWeight: FontWeight.w600)),
                    subtitle: text(source['translation']) == null ? null : Text(text(source['translation'])!, style: onest.copyWith(color: muted, fontSize: 12)),
                    onTap: () {
                      final raw = text(source['link']);
                      if (raw != null) _open(raw);
                    },
                  ),
                ),
              ),
            if (statuses.isNotEmpty) const SectionLabel('Мій список'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final entry in statuses.entries)
                  ActionChip(
                    label: Text('${entry.value}', style: onest.copyWith(color: gold, fontSize: 12)),
                    backgroundColor: card,
                    side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                    onPressed: () async {
                      await widget.session.api.post('/api/v1/cinema/${widget.slug}/status', {'status': entry.key});
                      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${entry.value}')));
                    },
                  ),
              ],
            ),
          ],
        );
      },
    );
  }
}

String? _playerUrl(String raw) {
  final iframe = RegExp('src=["\']([^"\']+)').firstMatch(raw);
  final value = iframe?.group(1) ?? raw;
  return absolute(value);
}

class FamiliesScreen extends StatefulWidget {
  const FamiliesScreen({required this.session, super.key});
  final Session session;

  @override
  State<FamiliesScreen> createState() => _FamiliesScreenState();
}

class _FamiliesScreenState extends State<FamiliesScreen> {
  final query = TextEditingController();
  String q = '';

  @override
  Widget build(BuildContext context) {
    return Remote(
      watch: q,
      load: () => widget.session.api.get('/api/v1/families?q=${Uri.encodeQueryComponent(q)}'),
      builder: (data, reload) {
        final mine = maps(data['mine']);
        final catalog = maps(data['families'] is Map ? (data['families'] as Map)['data'] : data['catalog']);
        final listed = catalog.isNotEmpty ? catalog : Listing.parse(data['families']).items;
        final seen = <String>{};
        bool fresh(Map<String, dynamic> row) {
          final key = text(row['slug']) ?? '${text(row['name'])}|${text(row['tag'])}';
          if (seen.contains(key)) return false;
          seen.add(key);
          return true;
        }
        final mineRows = mine.where(fresh).toList();
        final rest = listed.where(fresh).toList();
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Text('Сім’ї', style: unbounded.copyWith(fontSize: 28)),
            const SizedBox(height: 8),
            GcField(controller: query, label: 'Пошук', onSubmit: () => setState(() => q = query.text.trim())),
            if (mineRows.isNotEmpty) const SectionLabel('Мої'),
            for (final row in mineRows) _familyTile(context, row),
            if (rest.isNotEmpty) const SectionLabel('Усі'),
            for (final row in rest) _familyTile(context, row),
            if (mineRows.isEmpty && rest.isEmpty) const Padding(padding: EdgeInsets.only(top: 16), child: Text('Сімей не знайдено.', style: TextStyle(color: muted, fontFamily: 'Onest'))),
          ],
        );
      },
    );
  }

  Widget _familyTile(BuildContext context, Map<String, dynamic> row) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Glass(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: ListTile(
          contentPadding: EdgeInsets.zero,
          leading: CircleAvatar(
            backgroundColor: indigo,
            child: Text(
              () {
                final label = text(row['tag']) ?? text(row['name']) ?? '?';
                return (label.isEmpty ? '?' : label[0]).toUpperCase();
              }(),
              style: unbounded.copyWith(fontSize: 14),
            ),
          ),
          title: Text(text(row['name']) ?? '', style: onest.copyWith(fontWeight: FontWeight.w600)),
          subtitle: Text(text(row['tag']) ?? '', style: onest.copyWith(color: muted)),
          trailing: const Icon(Icons.chevron_right_rounded, color: muted),
          onTap: () {
            final slug = text(row['slug']);
            if (slug != null) context.push('/families/$slug');
          },
        ),
      ),
    );
  }
}

class FamilyScreen extends StatefulWidget {
  const FamilyScreen({required this.session, required this.slug, super.key});
  final Session session;
  final String slug;

  @override
  State<FamilyScreen> createState() => _FamilyScreenState();
}

class _FamilyScreenState extends State<FamilyScreen> {
  final nick = TextEditingController();
  final staticId = TextEditingController();
  String section = 'overview';

  @override
  Widget build(BuildContext context) {
    final path = section == 'overview' ? '/api/v1/families/${widget.slug}' : '/api/v1/families/${widget.slug}/$section';
    return Remote(
      watch: section,
      load: () => widget.session.api.get(path),
      builder: (data, reload) {
        final family = data['family'] is Map ? Map<String, dynamic>.from(data['family'] as Map) : <String, dynamic>{};
        return ScreenScroll(
          onRefresh: reload,
          children: [
            IconButton(onPressed: () => context.go('/families'), icon: const Icon(Icons.arrow_back_rounded, color: Colors.white)),
            Text(text(family['name']) ?? widget.slug, style: unbounded.copyWith(fontSize: 24)),
            ChipRow(
              options: const [('overview', 'Огляд'), ('members', 'Учасники'), ('bank', 'Банк'), ('warehouse', 'Склад'), ('events', 'Події'), ('reports', 'Звіти')],
              selected: section,
              onSelect: (value) => setState(() => section = value),
            ),
            const SizedBox(height: 8),
            if (section == 'overview' && data['member'] == null) ...[
              GcField(controller: nick, label: 'RP-нік'),
              const SizedBox(height: 8),
              GcField(controller: staticId, label: 'Static ID'),
              const SizedBox(height: 10),
              PrimaryButton(
                label: 'Подати заявку',
                onPressed: () async {
                  try {
                    await widget.session.api.post('/api/v1/families/${widget.slug}/apply', {
                      'rp_nickname': nick.text.trim(),
                      'static_id': staticId.text.trim(),
                    });
                    await reload();
                  } catch (e) {
                    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                  }
                },
              ),
            ],
            if (text(family['description']) != null) Text(text(family['description'])!, style: onest),
            for (final row in maps(data['members'])) Text('${text(row['display']) ?? text(row['name']) ?? ''} · ${text(row['rank_title']) ?? ''}', style: onest),
            for (final row in maps(data['transactions'])) Text('${row['amount'] ?? ''} · ${text(row['comment']) ?? text(row['type']) ?? ''}', style: onest),
            for (final row in maps(data['items'])) Text(text(row['name']) ?? '', style: onest),
            for (final row in maps(data['events'])) Text(text(row['title']) ?? '', style: onest),
            for (final row in maps(data['reports'])) Text('${text(row['type_label']) ?? ''} · ${text(row['status']) ?? ''}', style: onest),
            if (data['chat_id'] != null) ...[
              const SizedBox(height: 12),
              GhostButton(label: 'Чат сім’ї', icon: Icons.chat_bubble_outline_rounded, onPressed: () => context.push('/messages/${data['chat_id']}')),
            ],
          ],
        );
      },
    );
  }
}

class ServersScreen extends StatefulWidget {
  const ServersScreen({required this.session, super.key});
  final Session session;

  @override
  State<ServersScreen> createState() => _ServersScreenState();
}

class _ServersScreenState extends State<ServersScreen> {
  final name = TextEditingController();

  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => widget.session.api.get('/api/v1/servers'),
      builder: (data, reload) {
        final servers = maps(data['servers']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Text('Сервери GTA', style: unbounded.copyWith(fontSize: 28)),
            const SizedBox(height: 8),
            GcField(controller: name, label: 'Запропонувати сервер'),
            const SizedBox(height: 10),
            PrimaryButton(
              label: 'Надіслати',
              onPressed: () async {
                final title = name.text.trim();
                if (title.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Вкажіть назву сервера')));
                  return;
                }
                try {
                  await widget.session.api.post('/api/v1/servers', {'name': title, 'platform': 'pc'});
                  name.clear();
                  await reload();
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Заявку надіслано')));
                } catch (e) {
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                }
              },
            ),
            const SizedBox(height: 8),
            for (final server in servers)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Glass(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.sports_esports_rounded, color: cyan),
                    title: Text(text(server['name']) ?? '', style: onest.copyWith(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                      server['players_online'] == null ? 'Онлайн невідомий' : '${server['players_online']} онлайн',
                      style: onest.copyWith(color: muted),
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded, color: muted),
                    onTap: () {
                      final slug = text(server['slug']);
                      if (slug != null) context.push('/servers/$slug');
                    },
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class ServerScreen extends StatelessWidget {
  const ServerScreen({required this.session, required this.slug, super.key});
  final Session session;
  final String slug;

  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => session.api.get('/api/v1/servers/$slug'),
      builder: (data, _) {
        final server = data['server'] is Map ? Map<String, dynamic>.from(data['server'] as Map) : <String, dynamic>{};
        return ScreenScroll(
          children: [
            IconButton(onPressed: () => context.go('/servers'), icon: const Icon(Icons.arrow_back_rounded, color: Colors.white)),
            Text(text(server['name']) ?? slug, style: unbounded.copyWith(fontSize: 24)),
            if (text(server['description']) != null) Text(text(server['description'])!, style: onest),
            for (final family in maps(data['families']))
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(text(family['name']) ?? '', style: onest),
                onTap: () {
                  final familySlug = text(family['slug']);
                  if (familySlug != null) context.push('/families/$familySlug');
                },
              ),
          ],
        );
      },
    );
  }
}

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({required this.session, super.key});
  final Session session;

  @override
  Widget build(BuildContext context) {
    return Remote(
      load: () => session.api.get('/api/v1/notifications'),
      builder: (data, reload) {
        final rows = maps(data['notifications']);
        return ScreenScroll(
          onRefresh: reload,
          children: [
            Text('Сповіщення', style: unbounded.copyWith(fontSize: 28)),
            const SizedBox(height: 8),
            GhostButton(
              label: 'Прочитати всі',
              icon: Icons.done_all_rounded,
              onPressed: () async {
                await session.api.post('/api/v1/notifications/read');
                await reload();
              },
            ),
            if (rows.isEmpty) const Text('Немає сповіщень.', style: TextStyle(color: muted, fontFamily: 'Onest')),
            for (final row in rows)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(text(row['text']) ?? '', style: onest.copyWith(color: row['read'] == true ? muted : ink)),
              ),
          ],
        );
      },
    );
  }
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({required this.session, super.key});
  final Session session;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final status = TextEditingController(text: text(widget.session.me?['status']) ?? '');
  late final city = TextEditingController(text: text(widget.session.me?['city']) ?? '');
  late final about = TextEditingController(text: text(widget.session.me?['about']) ?? '');
  final current = TextEditingController();
  final next = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final me = widget.session.me ?? {};
    return ScreenScroll(
      children: [
        Text('Налаштування', style: unbounded.copyWith(fontSize: 28)),
        Text(text(me['email']) ?? '', style: onest.copyWith(color: muted)),
        const SizedBox(height: 8),
        GcField(controller: status, label: 'Статус'),
        const SizedBox(height: 8),
        GcField(controller: city, label: 'Місто'),
        const SizedBox(height: 8),
        GcField(controller: about, label: 'Про себе'),
        const SizedBox(height: 8),
        PrimaryButton(
          label: 'Зберегти',
          onPressed: () async {
            try {
              final json = await widget.session.api.patch('/api/v1/me', {
                'status': status.text.trim(),
                'city': city.text.trim(),
                'about': about.text.trim(),
              });
              final user = json['user'];
              if (user is Map) widget.session.me = Map<String, dynamic>.from(user);
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Збережено')));
            } catch (e) {
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
            }
          },
        ),
        const SizedBox(height: 16),
        GcField(controller: current, label: 'Поточний пароль', obscure: true),
        const SizedBox(height: 8),
        GcField(controller: next, label: 'Новий пароль', obscure: true),
        const SizedBox(height: 10),
        GhostButton(
          label: 'Змінити пароль',
          icon: Icons.lock_outline_rounded,
          onPressed: () async {
            try {
              await widget.session.api.put('/api/v1/me/password', {
                'current_password': current.text,
                'password': next.text,
                'password_confirmation': next.text,
              });
              current.clear();
              next.clear();
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Пароль змінено')));
            } catch (e) {
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
            }
          },
        ),
        const SizedBox(height: 14),
        Text('Google: ${me['google'] == true ? 'під’єднано' : 'ні'} · Discord: ${text(me['discord_username']) ?? 'ні'}', style: onest.copyWith(color: muted)),
      ],
    );
  }
}
