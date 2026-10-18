import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

Map<String, String> characterStatuses() => {'active': tr('Грає'), 'retired': tr('На паузі'), 'dead': tr('Загинув')};

Color _statusColor(String? status) => switch (status) {
      'dead' => danger,
      'retired' => muted,
      _ => green,
    };

/// Рядок персонажа: портрет, ім’я, сервер або гравець, сім’я.
class CharacterRow extends StatelessWidget {
  const CharacterRow({required this.character, this.showPlayer = false, super.key});
  final Map<String, dynamic> character;
  final bool showPlayer;

  @override
  Widget build(BuildContext context) {
    final family = mapOf(character['family']);
    final subtitle = [
      showPlayer ? text(mapOf(character['player'])['name']) : text(mapOf(character['server'])['name']),
      if (family.isNotEmpty) '[${family['tag']}]',
      text(character['occupation']),
    ].whereType<String>().join(' · ');
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => context.push('/characters/${character['id']}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
        child: Row(children: [
          Avatar(url: text(character['portrait_url']), name: text(character['name']) ?? '?', size: 46, square: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(text(character['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14.5, weight: FontWeight.w600))),
                if (character['is_main'] == true) ...[const SizedBox(width: 4), const Icon(LucideIcons.star, size: 14, color: gold)],
              ]),
              if (subtitle.isNotEmpty) Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: muted)),
            ]),
          ),
          if (character['status'] != 'active') Pill(label: characterStatuses()[character['status']] ?? '', color: _statusColor(text(character['status']))),
        ]),
      ),
    );
  }
}

/// Блок «Персонажі RP» у профілі та на сторінці сервера.
class CharactersPanel extends StatelessWidget {
  const CharactersPanel({required this.characters, this.title, this.createPath, this.showPlayer = false, this.empty, super.key});
  final List<Map<String, dynamic>> characters;
  final String? title;
  final String? createPath;
  final bool showPlayer;
  final String? empty;

  @override
  Widget build(BuildContext context) {
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CardTitle(title ?? tr('Персонажі RP'), icon: LucideIcons.drama, trailing: createPath == null ? null : tr('+ Новий'), onTrailing: createPath == null ? null : () => context.push(createPath!)),
        const SizedBox(height: 6),
        if (characters.isEmpty)
          Text(empty ?? tr('Створіть персонажа: ім’я, біографія, сім’я й історія на сервері.'), style: body(13, color: muted))
        else
          for (final character in characters) CharacterRow(character: character, showPlayer: showPlayer),
      ]),
    );
  }
}

class CharacterScreen extends StatelessWidget {
  const CharacterScreen({required this.id, super.key});
  final String id;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    return Remote(
      load: () => api.get(Api.site('/characters/$id')),
      builder: (data, reload) {
        final c = mapOf(data['character']);
        final server = mapOf(c['server']);
        final family = mapOf(c['family']);
        final player = mapOf(c['player']);
        final photos = (c['photos'] as List? ?? const []).whereType<String>().toList();
        final canEdit = data['can_edit'] == true;
        Future<void> addPhoto() async {
          final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 88, maxWidth: 1920);
          if (picked == null || !context.mounted) return;
          final file = await http.MultipartFile.fromPath('photo', picked.path, filename: picked.name);
          if (!context.mounted) return;
          if (await attempt(context, () => api.upload(Api.site('/characters/$id/photos'), {}, [file]), success: tr('Фото додано.'))) await reload();
        }

        return ScreenScroll(
          onRefresh: reload,
          children: [
            Row(children: [
              RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.canPop() ? context.pop() : context.go('/')),
              const SizedBox(width: 8),
              Expanded(child: Text(text(player['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: muted))),
            ]),
            const SizedBox(height: 10),
            Glass(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: SizedBox(
                      width: 170,
                      height: 212,
                      child: text(c['portrait_url']) != null
                          ? Image.network(text(c['portrait_url'])!, fit: BoxFit.cover)
                          : ColoredBox(
                              color: indigo.withValues(alpha: 0.2),
                              child: Center(child: Text((text(c['name']) ?? '?').characters.first.toUpperCase(), style: display(56, color: const Color(0xFFC4B5FD)))),
                            ),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(text(c['name']) ?? '', style: display(24)),
                const SizedBox(height: 8),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  if (c['is_main'] == true) Pill(label: tr('Головний'), icon: LucideIcons.star, color: gold),
                  Pill(label: characterStatuses()[c['status']] ?? '', color: _statusColor(text(c['status']))),
                  if (c['age'] != null) Pill(label: '${c['age']} ${plural(intOf(c['age']), tr('рік'), tr('роки'), tr('років'))}', icon: LucideIcons.cake),
                  if (text(c['occupation']) != null) Pill(label: text(c['occupation'])!, icon: LucideIcons.briefcase),
                ]),
                const SizedBox(height: 12),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  GhostButton(label: text(server['name']) ?? '', icon: LucideIcons.server, compact: true, expand: false, onPressed: () => context.push('/servers/${server['slug']}')),
                  if (family.isNotEmpty) GhostButton(label: '[${family['tag']}] ${family['name']}', icon: LucideIcons.crown, compact: true, expand: false, onPressed: () => context.push('/families/${family['slug']}')),
                ]),
                if (text(c['bio']) != null) ...[
                  const SizedBox(height: 12),
                  Text(text(c['bio'])!, style: body(14, color: soft).copyWith(height: 1.5)),
                ],
                if (canEdit) ...[
                  const SizedBox(height: 14),
                  Row(children: [
                    Expanded(child: PrimaryButton(label: tr('Редагувати'), icon: LucideIcons.pencil, compact: true, onPressed: () async {
                      final saved = await context.push<bool>('/characters/$id/edit');
                      if (saved == true) await reload();
                    })),
                    const SizedBox(width: 8),
                    Expanded(child: GhostButton(label: tr('Видалити'), icon: LucideIcons.trash2, compact: true, color: danger, onPressed: () async {
                      final ok = await confirm(context, tr('Видалити персонажа разом з фото?'));
                      if (!ok || !context.mounted) return;
                      if (await attempt(context, () => api.delete(Api.site('/characters/$id')), success: tr('Персонажа видалено.')) && context.mounted) context.pop();
                    })),
                  ]),
                ],
              ]),
            ),
            if (text(c['story']) != null) ...[
              const SizedBox(height: 12),
              Glass(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  CardTitle(tr('Історія'), icon: LucideIcons.bookOpen),
                  const SizedBox(height: 10),
                  Text(text(c['story'])!, style: body(14.5, color: soft).copyWith(height: 1.55)),
                ]),
              ),
            ],
            if (photos.isNotEmpty || canEdit) ...[
              const SizedBox(height: 12),
              Glass(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  CardTitle(
                    tr('Фото'),
                    icon: LucideIcons.images,
                    trailing: canEdit && photos.length < intOf(data['photo_limit']) ? tr('+ Додати') : null,
                    onTrailing: canEdit && photos.length < intOf(data['photo_limit']) ? addPhoto : null,
                  ),
                  const SizedBox(height: 10),
                  if (photos.isEmpty)
                    Text(tr('Скриншоти з гри: персонаж, авто, дім — до 6 фото.'), style: body(13, color: muted))
                  else
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      childAspectRatio: 16 / 9,
                      children: [
                        for (var i = 0; i < photos.length; i++)
                          GestureDetector(
                            onLongPress: canEdit
                                ? () async {
                                    final ok = await confirm(context, tr('Прибрати фото?'));
                                    if (ok && context.mounted && await attempt(context, () => api.delete(Api.site('/characters/$id/photos/$i')))) await reload();
                                  }
                                : null,
                            child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(photos[i], fit: BoxFit.cover)),
                          ),
                      ],
                    ),
                ]),
              ),
            ],
            if (maps(data['others']).isNotEmpty) ...[
              const SizedBox(height: 12),
              CharactersPanel(characters: maps(data['others']), title: tr('Інші персонажі гравця')),
            ],
          ],
        );
      },
    );
  }
}

/// Створення й редагування персонажа (без id — новий).
class CharacterEditScreen extends StatefulWidget {
  const CharacterEditScreen({this.id, this.server, super.key});
  final String? id;
  final String? server;

  @override
  State<CharacterEditScreen> createState() => _CharacterEditScreenState();
}

class _CharacterEditScreenState extends State<CharacterEditScreen> {
  Map<String, dynamic>? page;
  final name = TextEditingController();
  final age = TextEditingController();
  final occupation = TextEditingController();
  final bio = TextEditingController();
  final story = TextEditingController();
  String server = '';
  String family = '';
  String status = 'active';
  bool main = false;
  XFile? portrait;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    for (final c in [name, age, occupation, bio, story]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final api = AppScope.read(context).session.api;
    final path = widget.id == null ? '/characters/create${widget.server == null ? '' : '?server=${Uri.encodeQueryComponent(widget.server!)}'}' : '/characters/${widget.id}/edit';
    try {
      final data = await api.get(Api.site(path));
      if (!mounted) return;
      final c = mapOf(data['character']);
      setState(() {
        page = data;
        server = text(data['server']) ?? text(maps(data['servers']).firstOrNull?['slug']) ?? '';
        name.text = text(c['name']) ?? '';
        age.text = c['age'] == null ? '' : '${c['age']}';
        occupation.text = text(c['occupation']) ?? '';
        bio.text = text(c['bio']) ?? '';
        story.text = text(c['story']) ?? '';
        status = text(c['status']) ?? 'active';
        main = c['is_main'] == true;
        family = c['family_id'] == null ? '' : '${c['family_id']}';
      });
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _save() async {
    if (name.text.trim().isEmpty) return;
    setState(() => saving = true);
    final api = AppScope.read(context).session.api;
    final fields = {
      'server': server,
      'name': name.text.trim(),
      'age': age.text.trim(),
      'occupation': occupation.text.trim(),
      'bio': bio.text.trim(),
      'story': story.text.trim(),
      'status': status,
      'is_main': main ? '1' : '0',
      'family_id': family,
    };
    final path = Api.site(widget.id == null ? '/characters' : '/characters/${widget.id}');
    try {
      final files = [if (portrait != null) await http.MultipartFile.fromPath('portrait', portrait!.path, filename: portrait!.name)];
      await api.upload(path, fields, files);
      if (!mounted) return;
      toast(context, widget.id == null ? tr('Персонажа створено.') : tr('Персонажа збережено.'));
      context.pop(true);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = page;
    if (data == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    final current = mapOf(data['character']);
    final families = maps(data['families']).where((f) => f['server'] == server).toList();
    return ScreenScroll(
      children: [
        Row(children: [
          RoundIcon(icon: LucideIcons.arrowLeft, onTap: () => context.pop()),
          const SizedBox(width: 8),
          Text(widget.id == null ? tr('Новий персонаж') : tr('Редагувати персонажа'), style: display(18)),
        ]),
        const SizedBox(height: 12),
        Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Center(
              child: GestureDetector(
                onTap: () async {
                  final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 90, maxWidth: 1440);
                  if (picked != null) setState(() => portrait = picked);
                },
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Container(
                    width: 140,
                    height: 175,
                    color: Colors.white.withValues(alpha: 0.05),
                    child: portrait != null
                        ? Image.file(File(portrait!.path), fit: BoxFit.cover)
                        : text(current['portrait_url']) != null
                            ? Image.network(text(current['portrait_url'])!, fit: BoxFit.cover)
                            : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                                const Icon(LucideIcons.imagePlus, color: muted),
                                const SizedBox(height: 6),
                                Text(tr('Портрет персонажа'), textAlign: TextAlign.center, style: body(12, color: muted)),
                              ]),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            GcField(controller: name, label: tr('Ім’я персонажа')),
            const SizedBox(height: 10),
            Row(children: [
              SizedBox(width: 90, child: GcField(controller: age, label: tr('Вік'), keyboard: TextInputType.number)),
              const SizedBox(width: 8),
              Expanded(child: GcField(controller: occupation, label: tr('Заняття'))),
            ]),
            const SizedBox(height: 10),
            GcSelect<String>(
              value: server,
              expand: true,
              items: [for (final s in maps(data['servers'])) ('${s['slug']}', '${s['name']}')],
              onChanged: (value) => setState(() {
                server = value ?? server;
                family = '';
              }),
            ),
            const SizedBox(height: 10),
            GcSelect<String>(
              value: family,
              expand: true,
              items: [('', families.isEmpty ? tr('Ви не в сім’ї на цьому сервері.') : tr('Без сім’ї')), for (final f in families) ('${f['id']}', '[${f['tag']}] ${f['name']}')],
              onChanged: (value) => setState(() => family = value ?? ''),
            ),
            const SizedBox(height: 12),
            Segmented(
              options: [for (final e in characterStatuses().entries) SegmentOption(e.key, e.value)],
              selected: status,
              onSelect: (value) => setState(() => status = value),
            ),
            const SizedBox(height: 4),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: main,
              onChanged: (value) => setState(() => main = value),
              title: Text(tr('Головний персонаж на сервері'), style: body(14)),
            ),
            GcField(controller: bio, label: tr('Коротко про персонажа'), maxLines: 4, minLines: 2),
            const SizedBox(height: 10),
            GcField(controller: story, label: tr('Історія'), maxLines: 12, minLines: 5),
            const SizedBox(height: 14),
            PrimaryButton(label: widget.id == null ? tr('Створити персонажа') : tr('Зберегти'), busy: saving, onPressed: saving ? null : _save),
          ]),
        ),
      ],
    );
  }
}
