import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'downloads.dart';
import 'i18n.dart';
import 'music_ui.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

// Екрани й значки «Завантаженого»: розділ у Медіатеці, офлайн-режим музики, кнопки
// «Завантажити» в шапках альбому й плейлиста, значок на рядках пісень.

/// Слухає [Downloads] і показує тост, коли завантаження не вдалося (немає місця тощо).
class DownloadAlerts extends StatefulWidget {
  const DownloadAlerts({required this.child, super.key});
  final Widget child;

  @override
  State<DownloadAlerts> createState() => _DownloadAlertsState();
}

class _DownloadAlertsState extends State<DownloadAlerts> {
  Downloads? _downloads;

  @override
  void initState() {
    super.initState();
    _downloads = Downloads.instance?..addListener(_check);
  }

  void _check() {
    final message = _downloads?.takeError();
    if (message != null && mounted) toast(context, message, kind: ToastKind.error);
  }

  @override
  void dispose() {
    _downloads?.removeListener(_check);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Що слухати рядку пісні: плеєр, завантаження й зв’язок.
Listenable musicRowListenable(TrackPlayer player) => Listenable.merge([player, ?Downloads.instance, Api.online]);

/// Значок на рядку: прогрес, «на телефоні» чи помилка завантаження.
class DownloadBadge extends StatelessWidget {
  const DownloadBadge(this.track, {super.key});
  final Map<String, dynamic> track;

  @override
  Widget build(BuildContext context) {
    final downloads = Downloads.instance;
    if (downloads == null || !downloadable(track)) return const SizedBox.shrink();
    final id = track['id'];
    final task = downloads.task(id);
    Widget pad(Widget child) => Padding(padding: const EdgeInsets.only(left: 6), child: child);
    if (task != null) {
      if (task.error != null) return pad(Tooltip(message: task.error!, child: const Icon(LucideIcons.circleAlert, size: 14, color: dangerSoft)));
      return pad(SizedBox(
        width: 14,
        height: 14,
        child: CircularProgressIndicator(strokeWidth: 2, value: task.running ? task.progress : null, color: accent, backgroundColor: faint.withValues(alpha: 0.3)),
      ));
    }
    if (downloads.has(id)) return pad(Semantics(label: tr('Завантажено на пристрій'), child: Icon(LucideIcons.circleArrowDown, size: 14, color: accent)));
    return const SizedBox.shrink();
  }
}

/// Без інтернету рядки, яких немає на телефоні, тьмяніють.
bool dimmedOffline(Map<String, dynamic> track) {
  final downloads = Downloads.instance;
  if (downloads == null || !downloads.offline) return false;
  return !(downloadable(track) && downloads.has(track['id']));
}

/// Пункт меню треку «Завантажити на пристрій» / «Видалити з пристрою» / «Скасувати завантаження».
(String, IconData)? downloadMenuItem(Map<String, dynamic> track) {
  final downloads = Downloads.instance;
  if (downloads == null || !downloadable(track)) return null;
  if (downloads.has(track['id'])) return (tr('Видалити з пристрою'), LucideIcons.circleX);
  if (downloads.task(track['id']) != null) return (tr('Скасувати завантаження'), LucideIcons.x);
  return (tr('Завантажити на пристрій'), LucideIcons.arrowDownToLine);
}

/// Дія пункту [downloadMenuItem].
Future<void> toggleDownload(BuildContext context, Map<String, dynamic> track) async {
  final downloads = Downloads.instance;
  if (downloads == null) return;
  final id = intOf(track['id']);
  if (downloads.has(id)) {
    await downloads.removeTrack(id);
    if (context.mounted) toast(context, tr('Видалено з пристрою.'));
  } else if (downloads.task(id) != null) {
    downloads.cancel(id);
  } else {
    await downloads.download(track);
    if (context.mounted) toast(context, tr('Завантаження почалося.'), kind: ToastKind.info);
  }
}

/// Кнопка в шапці альбому чи плейлиста: завантажити все / прогрес / «Завантажено» (дотик — видалити).
class CollectionDownloadButton extends StatelessWidget {
  const CollectionDownloadButton({required this.collectionKey, required this.kind, required this.title, required this.tracks, this.subtitle, this.coverUrl, this.path, super.key});
  final String collectionKey;
  final String kind;
  final String title;
  final String? subtitle;
  final String? coverUrl;
  final String? path;
  final List<Map<String, dynamic>> tracks;

  @override
  Widget build(BuildContext context) {
    final downloads = Downloads.instance;
    if (downloads == null || !tracks.any(downloadable)) return const SizedBox.shrink();
    return ListenableBuilder(
      listenable: downloads,
      builder: (context, _) {
        final saved = downloads.collection(collectionKey) != null;
        final (done, total) = downloads.progressOf(collectionKey);
        final complete = saved && total > 0 && done >= total;
        final label = !saved ? tr('Завантажити') : (complete ? tr('Завантажено') : tr('Завантаження {done} з {total}', {'done': done, 'total': total}));
        return GhostButton(
          label: label,
          compact: true,
          expand: false,
          icon: complete ? LucideIcons.circleArrowDown : LucideIcons.arrowDownToLine,
          iconColor: saved ? accent : null,
          onPressed: () async {
            if (saved) {
              if (!await confirm(context, tr('Видалити «{title}» з пристрою?', {'title': title}), text: tr('Пісні можна буде завантажити знову.'), action: tr('Видалити'), danger: true)) return;
              await downloads.removeCollection(collectionKey);
              return;
            }
            await downloads.downloadCollection(key: collectionKey, kind: kind, title: title, subtitle: subtitle, coverUrl: coverUrl, path: path, cards: tracks);
            if (context.mounted) toast(context, tr('Завантаження почалося.'), kind: ToastKind.info);
          },
        );
      },
    );
  }
}

/// Назва колекції в «Завантаженому» (у «Улюбленого» — перекладена).
String collectionTitle(DownloadCollection c) => c.kind == 'favorites' ? tr('Улюблене') : c.title;

// ───────────────────────── «Завантажене» ─────────────────────────

/// Сторінка «Завантажене» (Медіатека → Завантажене) і вміст розділу музики без інтернету.
class DownloadsScreen extends StatelessWidget {
  const DownloadsScreen({this.offline = false, super.key});

  /// Розділ музики без інтернету: без кнопки «назад» і з поясненням зверху.
  final bool offline;

  @override
  Widget build(BuildContext context) {
    final downloads = Downloads.instance;
    if (downloads == null) return const SizedBox.shrink();
    return DownloadAlerts(
      child: PlaySource(
        from: PlayFrom(tr('Завантажене'), '/music/downloads'),
        child: ListenableBuilder(
          listenable: Listenable.merge([downloads, Api.online]),
          builder: (context, _) => _DownloadsList(downloads: downloads, offline: offline),
        ),
      ),
    );
  }
}

class _DownloadsList extends StatelessWidget {
  const _DownloadsList({required this.downloads, required this.offline});
  final Downloads downloads;
  final bool offline;

  @override
  Widget build(BuildContext context) {
    final songs = downloads.tracks;
    final cards = [for (final t in songs) t.card];
    final collections = downloads.collections.where((c) => downloads.tracksOf(c.key).isNotEmpty || downloads.progressOf(c.key).$2 > 0).toList();
    final pending = downloads.tasks;
    return MusicList(
      onRefresh: offline ? () => _ping(context) : null,
      children: [
        LargeTitle(tr('Завантажене'), back: !offline, subtitle: songs.isEmpty ? null : '${songs.length} ${plural(songs.length, 'пісня', 'пісні', 'пісень')} · ${bytesLabel(downloads.totalBytes)}'),
        if (offline)
          Padding(
            padding: const EdgeInsets.fromLTRB(gutter, 8, gutter, 4),
            child: Glass(
              child: Row(children: [
                Icon(LucideIcons.wifiOff, size: 20, color: accent),
                const SizedBox(width: 12),
                Expanded(child: Text(tr('Немає інтернету. Грає музика, завантажена на пристрій.'), style: body(13.5, color: soft))),
                TextButton(onPressed: () => _ping(context), child: Text(tr('Оновити'))),
              ]),
            ),
          ),
        if (cards.isNotEmpty) PlayShuffle(tracks: cards),
        if (pending.isNotEmpty) ...[
          SectionHeader(tr('Завантажується')),
          for (final t in pending) _TaskRow(task: t, downloads: downloads),
        ],
        if (collections.isNotEmpty) ...[
          SectionHeader(tr('Альбоми й плейлисти')),
          for (final c in collections) _CollectionRow(collection: c, downloads: downloads),
        ],
        if (songs.isNotEmpty) ...[
          SectionHeader(tr('Пісні')),
          for (var i = 0; i < cards.length; i++) SongRow(key: ValueKey('dl-${songs[i].id}'), tracks: cards, index: i),
        ],
        if (songs.isEmpty && pending.isEmpty)
          MusicEmpty(
            icon: LucideIcons.arrowDownToLine,
            title: tr('Нічого не завантажено'),
            text: tr('Завантажуйте пісні, альбоми й плейлисти через «⋯» або кнопку «Завантажити», щоб слухати без інтернету.'),
          ),
        if (!offline) _DownloadSettings(downloads: downloads),
        if (songs.isNotEmpty || pending.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(gutter, 18, gutter, 0),
            child: GhostButton(
              label: tr('Видалити все'),
              icon: LucideIcons.trash2,
              color: dangerSoft,
              onPressed: () async {
                if (!await confirm(context, tr('Видалити всю завантажену музику?'), text: tr('Файли зникнуть з телефона; у медіатеці все лишиться.'), action: tr('Видалити'), danger: true)) return;
                await downloads.clearAll();
                if (context.mounted) toast(context, tr('Завантажене видалено.'));
              },
            ),
          ),
      ],
    );
  }

  /// Перевірити зв’язок: будь-який успішний запит повертає звичайний розділ музики.
  Future<void> _ping(BuildContext context) async {
    try {
      await AppScope.read(context).session.api.get('/api/v1/me');
    } catch (_) {
      if (context.mounted) toast(context, tr('Досі немає зв’язку з GameCon.'), kind: ToastKind.info);
    }
  }
}

class _TaskRow extends StatelessWidget {
  const _TaskRow({required this.task, required this.downloads});
  final DownloadTask task;
  final Downloads downloads;

  @override
  Widget build(BuildContext context) {
    final failed = task.error != null;
    final status = failed
        ? task.error!
        : (!task.running ? tr('У черзі') : (task.total == null ? bytesLabel(task.received) : '${bytesLabel(task.received)} / ${bytesLabel(task.total!)}'));
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: gutter, vertical: 5),
      child: Row(children: [
        SizedBox(width: 44, child: Artwork(url: text(task.card['cover_url']), seed: trackKey(task.card), radius: 6)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(task.card['title']) ?? tr('Без назви'), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w500)),
            const SizedBox(height: 4),
            if (!failed) LinearProgressIndicator(value: task.running ? task.progress : null, minHeight: 3, color: accent, backgroundColor: faint.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(2)),
            const SizedBox(height: 3),
            Text(status, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(12, color: failed ? dangerSoft : muted)),
          ]),
        ),
        if (failed) IconButton(tooltip: tr('Спробувати знову'), onPressed: () => downloads.retry(task.id), icon: Icon(LucideIcons.rotateCw, size: 18, color: muted)),
        IconButton(tooltip: tr('Скасувати'), onPressed: () => downloads.cancel(task.id), icon: Icon(LucideIcons.x, size: 18, color: muted)),
      ]),
    );
  }
}

class _CollectionRow extends StatelessWidget {
  const _CollectionRow({required this.collection, required this.downloads});
  final DownloadCollection collection;
  final Downloads downloads;

  @override
  Widget build(BuildContext context) {
    final (done, total) = downloads.progressOf(collection.key);
    final bytes = downloads.tracksOf(collection.key).fold(0, (sum, t) => sum + t.bytes);
    final icon = switch (collection.kind) { 'playlist' => LucideIcons.listMusic, 'favorites' => LucideIcons.star, _ => LucideIcons.disc3 };
    final cover = collection.coverUrl ?? text(downloads.tracksOf(collection.key).firstOrNull?.card['cover_url']);
    return InkWell(
      onTap: () => context.push('/music/downloads/collection?${Uri(queryParameters: {'key': collection.key}).query}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: gutter, vertical: 5),
        child: Row(children: [
          SizedBox(width: 56, child: Artwork(url: cover, seed: collection.key, radius: 8, icon: icon)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(collectionTitle(collection), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w500)),
              Text(
                [?collection.subtitle, done < total ? tr('{done} з {total}', {'done': done, 'total': total}) : '$total ${plural(total, 'пісня', 'пісні', 'пісень')}', bytesLabel(bytes)].join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: body(12.5, color: muted),
              ),
            ]),
          ),
          IconButton(
            tooltip: tr('Видалити з пристрою'),
            onPressed: () async {
              if (!await confirm(context, tr('Видалити «{title}» з пристрою?', {'title': collectionTitle(collection)}), action: tr('Видалити'), danger: true)) return;
              if (collection.kind == 'favorites') downloads.autoFavorites = false;
              await downloads.removeCollection(collection.key);
            },
            icon: Icon(LucideIcons.trash2, size: 18, color: muted),
          ),
        ]),
      ),
    );
  }
}

/// Налаштування завантажень: якість і автозавантаження улюбленого.
class _DownloadSettings extends StatelessWidget {
  const _DownloadSettings({required this.downloads});
  final Downloads downloads;

  @override
  Widget build(BuildContext context) {
    Widget choice(String value, String title, String hint) => RadioListTile<String>(
          value: value,
          // ignore: deprecated_member_use
          groupValue: downloads.quality,
          activeColor: primary,
          contentPadding: const EdgeInsets.symmetric(horizontal: gutter - 4),
          title: Text(title, style: body(15)),
          subtitle: Text(hint, style: body(12.5, color: muted)),
          // ignore: deprecated_member_use
          onChanged: (v) => downloads.quality = v ?? 'stream',
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionHeader(tr('Налаштування завантажень'), subtitle: tr('Зайнято на телефоні: {size}', {'size': bytesLabel(downloads.totalBytes)})),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: gutter),
        child: Row(children: [
          Icon(LucideIcons.star, size: 20, color: accent),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr('Автозавантаження улюбленого'), style: body(15)),
              Text(tr('Пісні із зірочкою самі з’являються на телефоні'), style: body(12.5, color: muted)),
            ]),
          ),
          GcSwitch(value: downloads.autoFavorites, onChanged: (on) => downloads.autoFavorites = on),
        ]),
      ),
      Padding(padding: const EdgeInsets.fromLTRB(gutter, 16, gutter, 0), child: Text(tr('Якість завантаження'), style: body(13, color: muted))),
      choice('stream', tr('Як у потоці'), tr('Та сама копія, що грає онлайн: менше місця')),
      choice('original', tr('Оригінал'), tr('Файл, який завантажив автор (без втрат, якщо є)')),
      Padding(
        padding: const EdgeInsets.fromLTRB(gutter, 4, gutter, 0),
        child: Text(tr('Нова якість діє для наступних завантажень.'), style: body(12, color: faint)),
      ),
    ]);
  }
}

/// Завантажений альбом чи плейлист — грає без інтернету.
class DownloadedCollectionScreen extends StatelessWidget {
  const DownloadedCollectionScreen({required this.collectionKey, super.key});
  final String collectionKey;

  @override
  Widget build(BuildContext context) {
    final downloads = Downloads.instance;
    if (downloads == null) return const SizedBox.shrink();
    return ListenableBuilder(
      listenable: Listenable.merge([downloads, Api.online]),
      builder: (context, _) {
        final c = downloads.collection(collectionKey);
        final songs = downloads.tracksOf(collectionKey);
        final cards = [for (final t in songs) t.card];
        if (c == null) {
          return MusicList(children: [
            const LargeTitle('', back: true),
            MusicEmpty(icon: LucideIcons.arrowDownToLine, title: tr('Більше не завантажено')),
          ]);
        }
        final cover = c.coverUrl ?? text(songs.firstOrNull?.card['cover_url']);
        return PlaySource(
          from: PlayFrom(collectionTitle(c), '/music/downloads'),
          child: MusicList(children: [
            LargeTitle('', back: true, actions: [
              if (c.path != null && !downloads.offline) RoundIcon(icon: LucideIcons.externalLink, tooltip: tr('Відкрити сторінку'), onTap: () => context.push(c.path!)),
            ]),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: math.max(48, (MediaQuery.sizeOf(context).width - 320) / 2)),
              child: Artwork(url: cover, seed: c.key, radius: 12, icon: c.kind == 'playlist' ? LucideIcons.listMusic : LucideIcons.disc3),
            ),
            const SizedBox(height: 14),
            Text(collectionTitle(c), textAlign: TextAlign.center, style: display(22)),
            if (c.subtitle != null) Text(c.subtitle!, textAlign: TextAlign.center, style: body(16, color: accent)),
            PlayShuffle(tracks: cards),
            for (var i = 0; i < cards.length; i++) SongRow(key: ValueKey('dlc-${songs[i].id}'), tracks: cards, index: i),
            Padding(
              padding: const EdgeInsets.fromLTRB(gutter, 18, gutter, 0),
              child: GhostButton(
                label: tr('Видалити з пристрою'),
                icon: LucideIcons.trash2,
                color: dangerSoft,
                onPressed: () async {
                  if (c.kind == 'favorites') downloads.autoFavorites = false;
                  await downloads.removeCollection(c.key);
                  if (context.mounted) context.pop();
                },
              ),
            ),
          ]),
        );
      },
    );
  }
}
