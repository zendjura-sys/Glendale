import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'api.dart';
import 'play_billing.dart';
import 'i18n.dart';
import 'state.dart';
import 'theme.dart';
import 'voice_room.dart';
import 'widgets.dart';

// «Телефон» — як на сайті (pages/phone/index.tsx): свій внутрішній номер, набирач, дзвінок і повідомлення
// за номером, подарунки й передача номера друзям, приватність і останні дзвінки. Усе через міст /site/phone.
// Купити гарний номер можна лише через Google Play Billing (play_billing.dart): ціна — за рівнем номера
// з Google Play, сервер бронює номер на час оплати й сам перевіряє покупку.

const phoneTiers = ['regular', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];

Map<String, String> tierLabels() => {
      'regular': tr('Звичайний'),
      'bronze': tr('Бронзовий'),
      'silver': tr('Срібний'),
      'gold': tr('Золотий'),
      'platinum': tr('Платиновий'),
      'diamond': tr('Діамантовий'),
    };

const _tierIcons = {
  'regular': LucideIcons.phone,
  'bronze': LucideIcons.award,
  'silver': LucideIcons.medal,
  'gold': LucideIcons.trophy,
  'platinum': LucideIcons.crown,
  'diamond': LucideIcons.gem,
};

/// Колір рівня — як `.phone-tier--*` на сайті (у світлій темі темніший, щоб читався на білому).
Color tierColor(String? tier) {
  final light = palette.isLight;
  return switch (tier) {
    'bronze' => light ? Color(0xFFA35A1F) : Color(0xFFD9955C),
    'silver' => light ? Color(0xFF5B6B80) : Color(0xFFCFD8E3),
    'gold' => light ? Color(0xFFA67C00) : Color(0xFFF4C64E),
    'platinum' => light ? Color(0xFF1F7F96) : Color(0xFFA9E4F2),
    'diamond' => light ? Color(0xFF6D4AE0) : Color(0xFFC4B5FD),
    _ => ink.withValues(alpha: 0.85),
  };
}

/// Номер у кольорі свого рівня зі значком (бронза, срібло, золото, платина, діамант).
class PhoneBadge extends StatelessWidget {
  const PhoneBadge({required this.phone, this.size = 15, this.showLabel = false, super.key});
  final Map<String, dynamic> phone;
  final double size;
  final bool showLabel;

  @override
  Widget build(BuildContext context) {
    final tier = text(phone['tier']) ?? 'regular';
    final color = tierColor(tier);
    final label = tierLabels()[tier] ?? '';
    final number = Text(
      text(phone['number']) ?? '',
      style: body(size, color: color, weight: FontWeight.w700).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
    );
    return Tooltip(
      message: tier == 'regular' ? '' : label,
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 6,
        runSpacing: 4,
        children: [
          Icon(_tierIcons[tier] ?? LucideIcons.phone, size: size + 2, color: color),
          // Діамант — м'який перелив кольорів, як на сайті.
          if (tier == 'diamond')
            ShaderMask(
              blendMode: BlendMode.srcIn,
              shaderCallback: (rect) => const LinearGradient(colors: [Color(0xFFA5F3FC), Color(0xFFC4B5FD), Color(0xFFF0ABFC)]).createShader(rect),
              child: number,
            )
          else
            number,
          if (showLabel && tier != 'regular')
            Container(
              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(20)),
              child: Text(label, style: body(11, color: color, weight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }
}

class PhoneScreen extends StatelessWidget {
  const PhoneScreen({this.dial, this.preview, super.key});
  final String? dial;

  /// Готові дані замість запиту (знімки екрана в тестах).
  final Map<String, dynamic>? preview;

  @override
  Widget build(BuildContext context) {
    final api = AppScope.of(context).session.api;
    if (preview != null) return _content(preview!, () async {});
    return Remote(load: () => api.get(Api.site('/phone')), builder: _content);
  }

  Widget _content(Map<String, dynamic> data, Future<void> Function() reload) {
    return ScreenScroll(
      onRefresh: reload,
      children: [
        PageTitle(tr('Телефон'), subtitle: tr('Свій номер, дзвінки й повідомлення за номером')),
        _Dialer(initial: dial, premium: text((data['codes'] as Map?)?['premium']) ?? '777'),
        SizedBox(height: 12),
        _MyNumber(data: data, reload: reload),
        _BuyNumber(data: data, reload: reload),
        _Offers(data: data, reload: reload),
        SizedBox(height: 12),
        _Privacy(data: data, reload: reload),
        SizedBox(height: 12),
        _History(items: maps(data['history'])),
      ],
    );
  }
}

// ───────────────────────── Набирач ─────────────────────────

/// «+777 (05) 123-45-67» з «+», «(05) 123-45-67» без нього (код мережі можна не набирати).
String prettyNumber(String raw) {
  final d = raw.replaceAll(RegExp(r'\D'), '');
  final withCode = raw.startsWith('+');
  if (withCode && d.length <= 3) return '+$d';
  final code = withCode ? d.substring(0, 3) : '';
  final rest = withCode ? d.substring(3) : d;
  if (rest.isEmpty) return '+$code';
  final op = rest.substring(0, math.min(2, rest.length));
  final n = rest.length > 2 ? rest.substring(2, math.min(9, rest.length)) : '';
  final parts = [
    if (n.isNotEmpty) n.substring(0, math.min(3, n.length)),
    if (n.length > 3) n.substring(3, math.min(5, n.length)),
    if (n.length > 5) n.substring(5, math.min(7, n.length)),
  ];
  final local = '($op${op.length == 2 ? ')' : ''}${parts.isEmpty ? '' : ' ${parts.join('-')}'}';
  return code.isEmpty ? local : '+$code $local';
}

class _Dialer extends StatefulWidget {
  const _Dialer({required this.initial, required this.premium});
  final String? initial;
  final String premium;

  @override
  State<_Dialer> createState() => _DialerState();
}

class _DialerState extends State<_Dialer> {
  late String dialed = (widget.initial ?? '').replaceAll(RegExp(r'[^\d+]'), '');
  Map<String, dynamic>? lookup;
  String? busy;
  Timer? _debounce;

  static const _keys = [
    ('1', ''), ('2', 'ABC'), ('3', 'DEF'), //
    ('4', 'GHI'), ('5', 'JKL'), ('6', 'MNO'),
    ('7', 'PQRS'), ('8', 'TUV'), ('9', 'WXYZ'),
    ('+', ''), ('0', ''), ('#', ''),
  ];

  String get digits => dialed.replaceAll(RegExp(r'\D'), '');

  @override
  void initState() {
    super.initState();
    if (dialed.isNotEmpty) WidgetsBinding.instance.addPostFrameCallback((_) => _changed());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _changed() {
    _debounce?.cancel();
    setState(() => lookup = null);
    if (digits.length < 9) return;
    final number = dialed;
    _debounce = Timer(Duration(milliseconds: 250), () async {
      try {
        final data = await AppScope.read(context).session.api.get(Api.site('/phone/lookup?number=${Uri.encodeQueryComponent(number)}'));
        if (mounted && number == dialed) setState(() => lookup = data);
      } catch (_) {}
    });
  }

  void _press(String key) {
    if (key == '#') return;
    if (key == '+') {
      if (!dialed.contains('+')) dialed = '+$dialed';
    } else if (digits.length < 12) {
      dialed += key;
    }
    _changed();
  }

  void _erase() {
    if (dialed.isEmpty) return;
    dialed = dialed.substring(0, dialed.length - 1);
    _changed();
  }

  Future<void> _contact(String action) async {
    final session = AppScope.read(context).session;
    setState(() => busy = action);
    try {
      final data = await session.api.post(Api.site('/phone/dial'), {'number': dialed});
      final conversation = data['conversation'] as Map? ?? {};
      final id = intOf(conversation['id']);
      if (!mounted) return;
      if (action == 'message') {
        context.push('/messages/$id');
      } else if (data['can_call'] == true) {
        await VoiceCall.instance.call(session.api, id, text(conversation['title']) ?? tr('Дзвінок'), onError: (e) {
          if (mounted) toast(context, e);
        });
      } else {
        toast(context, tr('Цьому абоненту зараз не можна подзвонити.'), kind: ToastKind.error);
      }
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final found = lookup?['found'] == true;
    final user = found ? Map<String, dynamic>.from(lookup!['user'] as Map) : null;
    return Glass(
      padding: EdgeInsets.fromLTRB(16, 18, 16, 18),
      child: Column(children: [
        Row(children: [
          SizedBox(width: 40),
          Expanded(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                dialed.isEmpty ? '+${widget.premium} (05) 123-45-67' : prettyNumber(dialed),
                maxLines: 1,
                style: body(27, color: dialed.isEmpty ? ink.withValues(alpha: 0.25) : ink, weight: FontWeight.w600).copyWith(fontFeatures: const [FontFeature.tabularFigures()], letterSpacing: -0.3),
              ),
            ),
          ),
          SizedBox(
            width: 40,
            child: dialed.isEmpty
                ? null
                : GestureDetector(
                    onLongPress: () {
                      dialed = '';
                      _changed();
                    },
                    child: IconButton(tooltip: tr('Стерти'), onPressed: _erase, icon: Icon(LucideIcons.delete, color: muted)),
                  ),
          ),
        ]),
        SizedBox(height: 8),
        // Чий номер — оновлюється, поки людина набирає.
        AnimatedSwitcher(
          duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : Duration(milliseconds: 200),
          child: SizedBox(
            key: ValueKey('${lookup?['found']}${user?['id']}${lookup?['message']}'),
            height: 52,
            child: Center(
              child: user != null
                  ? Material(
                      color: fg.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(16),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () => context.push('/u/${user['username']}'),
                        child: Padding(
                          padding: EdgeInsets.fromLTRB(6, 6, 12, 6),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? '', size: 36),
                            SizedBox(width: 10),
                            Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                              Text(text(user['name']) ?? '', style: body(13.5, weight: FontWeight.w600)),
                              PhoneBadge(phone: Map<String, dynamic>.from(lookup!['phone'] as Map), size: 12.5),
                            ]),
                          ]),
                        ),
                      ),
                    )
                  : Text(
                      lookup != null ? (text(lookup!['message']) ?? '') : tr('Наберіть номер — покажемо, чий він. Код мережі можна не вводити.'),
                      textAlign: TextAlign.center,
                      style: body(lookup != null ? 13.5 : 12, color: lookup != null ? muted : faint),
                    ),
            ),
          ),
        ),
        SizedBox(height: 10),
        ConstrainedBox(
          constraints: BoxConstraints(maxWidth: 320),
          child: GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.35,
            children: [
              for (final (key, letters) in _keys)
                Material(
                  color: fg.withValues(alpha: key == '#' ? 0.025 : 0.05),
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: key == '#' ? null : () => _press(key),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(key, style: body(24, color: key == '#' ? faint : ink, weight: FontWeight.w500).copyWith(height: 1.1)),
                      SizedBox(height: 12, child: Text(letters, style: body(9, color: faint).copyWith(letterSpacing: 1.8))),
                    ]),
                  ),
                ),
            ],
          ),
        ),
        SizedBox(height: 14),
        ConstrainedBox(
          constraints: BoxConstraints(maxWidth: 320),
          child: Row(children: [
            Expanded(
              child: _DialButton(
                icon: LucideIcons.messageCircle,
                label: tr('Написати'),
                busy: busy == 'message',
                color: fg.withValues(alpha: 0.08),
                foreground: ink,
                onTap: !found || busy != null ? null : () => _contact('message'),
              ),
            ),
            SizedBox(width: 10),
            Expanded(
              child: _DialButton(
                icon: LucideIcons.phone,
                label: tr('Подзвонити'),
                busy: busy == 'call',
                color: Color(0xFF10B981),
                foreground: Colors.white,
                onTap: !found || busy != null ? null : () => _contact('call'),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _DialButton extends StatelessWidget {
  const _DialButton({required this.icon, required this.label, required this.busy, required this.color, required this.foreground, required this.onTap});
  final IconData icon;
  final String label;
  final bool busy;
  final Color color;
  final Color foreground;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onTap == null && !busy ? 0.4 : 1,
      child: Material(
        color: color,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: SizedBox(
            height: 54,
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              busy ? SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: foreground)) : Icon(icon, size: 19, color: foreground),
              SizedBox(width: 8),
              Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, color: foreground, weight: FontWeight.w600))),
            ]),
          ),
        ),
      ),
    );
  }
}

// ───────────────────────── Мій номер ─────────────────────────

String _date(String? iso) {
  final dt = iso == null ? null : DateTime.tryParse(iso)?.toLocal();
  if (dt == null) return '';
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(dt.day)}.${two(dt.month)}, ${two(dt.hour)}:${two(dt.minute)}';
}

class _MyNumber extends StatefulWidget {
  const _MyNumber({required this.data, required this.reload});
  final Map<String, dynamic> data;
  final Future<void> Function() reload;

  @override
  State<_MyNumber> createState() => _MyNumberState();
}

class _MyNumberState extends State<_MyNumber> {
  bool rolling = false;
  String? scramble;
  Map<String, dynamic>? result;
  Timer? _timer;
  final _random = math.Random();

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _digits(int n) => List.generate(n, (_) => _random.nextInt(10)).join();

  /// «Барабан»: цифри перебираються, поки сервер обирає номер.
  Future<void> _roll() async {
    final session = AppScope.read(context).session;
    final code = text((widget.data['codes'] as Map?)?['random']) ?? '555';
    final reduce = MediaQuery.disableAnimationsOf(context);
    setState(() {
      rolling = true;
      result = null;
    });
    if (!reduce) {
      _timer = Timer.periodic(Duration(milliseconds: 70), (_) {
        if (mounted) setState(() => scramble = '+$code (${_digits(2)}) ${_digits(3)}-${_digits(2)}-${_digits(2)}');
      });
    }
    final started = DateTime.now();
    try {
      final data = await session.api.post(Api.site('/phone/random'));
      final wait = Duration(milliseconds: 1300) - DateTime.now().difference(started);
      if (!reduce && wait > Duration.zero) await Future<void>.delayed(wait);
      final phone = Map<String, dynamic>.from(data['phone'] as Map);
      if (!mounted) return;
      setState(() => result = phone);
      final tier = text(phone['tier']) ?? 'regular';
      if (tier != 'regular') toast(context, tr('Пощастило! {tier} номер безкоштовно.', {'tier': tierLabels()[tier]}));
      await widget.reload();
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      _timer?.cancel();
      if (mounted) {
        setState(() {
          scramble = null;
          rolling = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final phone = data['phone'] is Map ? Map<String, dynamic>.from(data['phone'] as Map) : null;
    final purchased = phone?['kind'] == 'purchased';
    final next = text(data['nextRandomAt']);
    final locked = next != null && (DateTime.tryParse(next)?.isAfter(DateTime.now()) ?? false);
    final chances = data['chances'] is Map ? Map<String, dynamic>.from(data['chances'] as Map) : const <String, dynamic>{};
    final code = text((data['codes'] as Map?)?['random']) ?? '555';
    final shown = result ?? phone;

    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(tr('Мій номер'), style: body(16, weight: FontWeight.w600)),
        SizedBox(height: 4),
        Text(
          phone == null
              ? tr('У вас ще немає номера — отримайте випадковий безкоштовно.')
              : purchased
                  ? tr('Куплений')
                  : tr('Випадковий, безкоштовний'),
          style: body(13, color: muted),
        ),
        SizedBox(height: 14),
        Container(
          constraints: BoxConstraints(minHeight: 84),
          alignment: Alignment.center,
          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 16),
          decoration: BoxDecoration(color: fg.withValues(alpha: 0.035), borderRadius: BorderRadius.circular(16)),
          child: scramble != null
              ? FittedBox(fit: BoxFit.scaleDown, child: Text(scramble!, style: body(24, color: ink.withValues(alpha: 0.7), weight: FontWeight.w600).copyWith(fontFeatures: const [FontFeature.tabularFigures()])))
              : shown != null
                  ? Column(mainAxisSize: MainAxisSize.min, children: [
                      PhoneBadge(phone: shown, size: 22, showLabel: true),
                      if (result != null) ...[
                        SizedBox(height: 6),
                        Text(
                          result!['tier'] == 'regular' ? tr('Ваш новий номер') : tr('{tier} номер — пощастило!', {'tier': tierLabels()[result!['tier']]}),
                          style: body(12, color: muted),
                        ),
                      ],
                    ])
                  : Text(tr('Натисніть кнопку — і номер ваш'), style: body(13.5, color: faint)),
        ),
        if (!purchased) ...[
          SizedBox(height: 12),
          Text(tr('Безкоштовно, мережа +{code}. Є шанс одразу отримати рідкісний!', {'code': code}), style: body(12.5, color: muted)),
          SizedBox(height: 8),
          Wrap(spacing: 14, runSpacing: 4, children: [
            for (final tier in phoneTiers.skip(1))
              Text.rich(TextSpan(children: [
                TextSpan(text: tierLabels()[tier], style: TextStyle(color: tierColor(tier))),
                TextSpan(text: ' ${_percent(chances[tier])}', style: TextStyle(color: faint)),
              ]), style: body(12)),
          ]),
          SizedBox(height: 14),
          SecondaryAction(
            icon: rolling ? null : LucideIcons.sparkles,
            busy: rolling,
            label: phone == null ? tr('Отримати номер') : tr('Змінити безкоштовно'),
            onTap: rolling || locked ? null : _roll,
          ),
          SizedBox(height: 8),
          Text(
            locked
                ? tr('Наступна безкоштовна зміна — {date}', {'date': _date(next)})
                : tr('Змінювати випадковий номер можна безкоштовно раз на {n} дн.', {'n': '${data['cooldownDays'] ?? 7}'}),
            textAlign: TextAlign.center,
            style: body(12, color: faint),
          ),
        ] else ...[
          SizedBox(height: 10),
          Text(tr('У вас куплений номер — змінити його можна лише на інший куплений.'), style: body(12, color: faint)),
          if (!maps(data['outgoing']).any((o) => o['kind'] == 'transfer')) ...[
            SizedBox(height: 12),
            SecondaryAction(
              icon: LucideIcons.send,
              label: tr('Передати номер другові'),
              onTap: () async {
                final friend = await pickFriend(context, maps(data['friends']), title: tr('Кому передати номер?'));
                if (friend == null || !context.mounted) return;
                final ok = await confirm(context, tr('Передати номер {name}?', {'name': friend['first_name'] ?? friend['name']}),
                    text: tr('Номер перейде, щойно друг прийме. Ваш номер звільниться.'), action: tr('Передати'));
                if (!ok || !context.mounted) return;
                if (await attempt(context, () => AppScope.read(context).session.api.post(Api.site('/phone/transfer'), {'user_id': friend['id']}))) {
                  await widget.reload();
                }
              },
            ),
          ],
        ],
      ]),
    );
  }

  String _percent(dynamic value) {
    final v = value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
    final s = v >= 1 ? v.toStringAsFixed(v.truncateToDouble() == v ? 0 : 1) : v.toString();
    return '${s.replaceAll('.', ',')} %';
  }
}

/// Тиха кнопка на всю ширину (як кнопки «Змінити безкоштовно» на сайті).
class SecondaryAction extends StatelessWidget {
  const SecondaryAction({required this.label, required this.onTap, this.icon, this.busy = false, super.key});
  final String label;
  final IconData? icon;
  final bool busy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onTap == null && !busy ? 0.5 : 1,
      child: Material(
        color: fg.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: SizedBox(
            height: 48,
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              if (busy) SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2)) else if (icon != null) Icon(icon, size: 17, color: ink),
              SizedBox(width: 8),
              Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, weight: FontWeight.w600))),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Вибір друга зі списку (для подарунка чи передачі номера).
Future<Map<String, dynamic>?> pickFriend(BuildContext context, List<Map<String, dynamic>> friends, {required String title}) {
  return showGcSheet<Map<String, dynamic>>(
    context,
    title: title,
    builder: (sheet) => friends.isEmpty
        ? Padding(
            padding: EdgeInsets.all(20),
            child: EmptyState(icon: LucideIcons.usersRound, title: tr('Поки немає друзів'), text: tr('Додайте друзів — і зможете дарувати їм номери.'), boxed: false),
          )
        : Column(children: [
            for (final friend in friends)
              ListTile(
                leading: Avatar(url: text(friend['avatar_url']), name: text(friend['name']) ?? '', size: 40),
                title: Text(text(friend['name']) ?? '', style: body(14.5, weight: FontWeight.w600)),
                subtitle: Text('@${friend['username'] ?? ''}', style: body(12, color: muted)),
                onTap: () => Navigator.pop(sheet, friend),
              ),
          ]),
  );
}

// ───────────────────────── Купити гарний номер ─────────────────────────

/// «Купити гарний номер»: код оператора й 7 цифр або «Підібрати» за рівнем; ціна рівня — з Google Play.
/// Показується лише в збірці з Google Play, коли продаж номерів увімкнено в адмінці.
class _BuyNumber extends StatefulWidget {
  const _BuyNumber({required this.data, required this.reload});
  final Map<String, dynamic> data;
  final Future<void> Function() reload;

  @override
  State<_BuyNumber> createState() => _BuyNumberState();
}

class _BuyNumberState extends State<_BuyNumber> {
  final operator = TextEditingController();
  final digits = TextEditingController();
  Map<String, dynamic>? check;
  List<Map<String, dynamic>> ideas = [];
  String? ideasTier;
  bool loadingIdeas = false;
  Map<String, dynamic>? giftTo;
  Timer? _debounce;
  PlayBilling? _billing;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _billing = AppScope.read(context).session.subscription.billing..addListener(_onBilling);
      _billing!.loadPhones();
    });
  }

  @override
  void dispose() {
    _billing?.removeListener(_onBilling);
    _debounce?.cancel();
    operator.dispose();
    digits.dispose();
    super.dispose();
  }

  /// Покупку підтверджено — тост і свіжі дані екрана.
  void _onBilling() {
    final message = _billing?.phoneMessage;
    if (message == null || !mounted) return;
    _billing!.phoneMessage = null;
    toast(context, message);
    setState(() {
      check = null;
      giftTo = null;
      operator.clear();
      digits.clear();
    });
    widget.reload();
  }

  void _changed() {
    _debounce?.cancel();
    setState(() => check = null);
    final op = operator.text, d = digits.text;
    if (op.length != 2 || d.length != 7) return;
    _debounce = Timer(Duration(milliseconds: 250), () async {
      try {
        final data = await AppScope.read(context).session.api.get(Api.site('/phone/check?operator=$op&digits=$d'));
        if (mounted && op == operator.text && d == digits.text) setState(() => check = data);
      } catch (e) {
        if (mounted) toast(context, e);
      }
    });
  }

  /// Лише цифри й не довше за потрібне (код оператора — 2, номер — 7).
  void _clamp(TextEditingController field, int max) {
    final clean = field.text.replaceAll(RegExp(r'\D'), '');
    final value = clean.length > max ? clean.substring(0, max) : clean;
    if (value != field.text) field.value = TextEditingValue(text: value, selection: TextSelection.collapsed(offset: value.length));
    _changed();
  }

  Future<void> _suggest(String tier) async {
    setState(() {
      ideasTier = tier;
      loadingIdeas = true;
    });
    final op = operator.text.length == 2 ? '&operator=${operator.text}' : '';
    try {
      final data = await AppScope.read(context).session.api.get(Api.site('/phone/suggest?tier=$tier$op'));
      if (mounted) setState(() => ideas = maps(data['numbers']));
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => loadingIdeas = false);
    }
  }

  void _pick(Map<String, dynamic> idea) {
    operator.text = '${idea['operator']}';
    digits.text = '${idea['digits']}';
    _changed();
  }

  @override
  Widget build(BuildContext context) {
    final billing = AppScope.of(context).session.subscription.billing;
    return ListenableBuilder(
      listenable: billing,
      builder: (context, _) {
        if (!PlayBilling.supported || !billing.phonesAvailable) return SizedBox.shrink();
        final premium = text((widget.data['codes'] as Map?)?['premium']) ?? '777';
        final tier = text(check?['tier']);
        final price = tier == null ? null : billing.phonePrices[tier]?.price;
        final available = check?['available'] == true;
        final labels = tierLabels();
        return Padding(
          padding: EdgeInsets.only(top: 12),
          child: Glass(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(tr('Купити гарний номер'), style: body(16, weight: FontWeight.w600)),
              SizedBox(height: 4),
              Text(tr('Мережа +{code}: свій код оператора й цифри. Ціна — за рівнем номера.', {'code': premium}), style: body(13, color: muted)),
              SizedBox(height: 14),
              Row(children: [
                Text('+$premium', style: body(18, color: muted, weight: FontWeight.w600)),
                SizedBox(width: 8),
                SizedBox(
                  width: 64,
                  child: GcField(controller: operator, label: '05', keyboard: TextInputType.number, onChanged: (_) => _clamp(operator, 2)),
                ),
                SizedBox(width: 8),
                Expanded(child: GcField(controller: digits, label: '7777777', keyboard: TextInputType.number, onChanged: (_) => _clamp(digits, 7))),
              ]),
              SizedBox(height: 10),
              // Перевірка номера: рівень, вільний чи ні, ціна з Google Play.
              AnimatedSwitcher(
                duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : Duration(milliseconds: 200),
                child: check == null
                    ? Text(tr('Введіть код оператора й 7 цифр — або підберіть готовий нижче.'), key: ValueKey('hint'), style: body(12, color: faint))
                    : Row(key: ValueKey('${check!['number']}'), children: [
                        Expanded(child: PhoneBadge(phone: check!, size: 15, showLabel: true)),
                        Text(available ? (price ?? '') : (text(check!['reason']) ?? ''), style: body(13.5, color: available ? ink : dangerSoft, weight: FontWeight.w600)),
                      ]),
              ),
              SizedBox(height: 14),
              Text(tr('Підібрати'), style: body(12.5, color: muted, weight: FontWeight.w600)),
              SizedBox(height: 6),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(children: [
                  for (final t in phoneTiers.skip(1))
                    if (billing.phonePrices.containsKey(t))
                      Padding(
                        padding: EdgeInsets.only(right: 8),
                        child: SelectPill(label: labels[t]!, selected: ideasTier == t, onTap: () => _suggest(t)),
                      ),
                ]),
              ),
              if (loadingIdeas)
                Padding(padding: EdgeInsets.all(12), child: Center(child: SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))))
              else if (ideas.isNotEmpty)
                Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Wrap(spacing: 8, runSpacing: 8, children: [
                    for (final idea in ideas)
                      Material(
                        color: fg.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => _pick(idea),
                          child: Padding(padding: EdgeInsets.symmetric(horizontal: 10, vertical: 8), child: PhoneBadge(phone: idea, size: 13)),
                        ),
                      ),
                  ]),
                ),
              SizedBox(height: 12),
              SwitchListTile(
                value: giftTo != null,
                contentPadding: EdgeInsets.zero,
                title: Text(giftTo == null ? tr('Подарувати другові') : tr('У подарунок: {name}', {'name': giftTo!['name']}), style: body(14, weight: FontWeight.w500)),
                onChanged: (on) async {
                  if (!on) return setState(() => giftTo = null);
                  final friend = await pickFriend(context, maps(widget.data['friends']), title: tr('Кому подарувати номер?'));
                  if (friend != null && mounted) setState(() => giftTo = friend);
                },
              ),
              if (billing.error != null) Padding(padding: EdgeInsets.only(bottom: 8), child: Text(billing.error!, style: body(13, color: dangerSoft))),
              PrimaryButton(
                label: price == null || !available ? tr('Купити номер') : tr('Купити за {price}', {'price': price}),
                icon: LucideIcons.shoppingBag,
                busy: billing.busy,
                onPressed: !available || price == null || billing.busy
                    ? null
                    : () => billing.buyPhone(operator: operator.text, digits: digits.text, giftTo: giftTo == null ? null : intOf(giftTo!['id'])),
              ),
              SizedBox(height: 8),
              Text(tr('Оплата через Google Play. Номер одразу ваш на сайті й у застосунку; попередній звільниться.'), style: body(11.5, color: faint)),
            ]),
          ),
        );
      },
    );
  }
}

// ───────────────────────── Подарунки й передача ─────────────────────────

class _Offers extends StatelessWidget {
  const _Offers({required this.data, required this.reload});
  final Map<String, dynamic> data;
  final Future<void> Function() reload;

  @override
  Widget build(BuildContext context) {
    final incoming = maps(data['incoming']);
    final outgoing = maps(data['outgoing']);
    final gifts = maps(data['gifts']);
    final api = AppScope.of(context).session.api;
    final mine = data['phone'] is Map ? data['phone'] as Map : null;
    if (incoming.isEmpty && outgoing.isEmpty && gifts.isEmpty) return SizedBox.shrink();

    Future<void> act(Future<dynamic> Function() call) async {
      if (await attempt(context, call)) await reload();
    }

    String who(Map<String, dynamic> offer, String key) => text((offer[key] as Map?)?['first_name']) ?? text((offer[key] as Map?)?['name']) ?? '';

    return Padding(
      padding: EdgeInsets.only(top: 12),
      child: Column(children: [
        if (incoming.isNotEmpty)
          Glass(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(tr('Вам пропонують номер'), style: body(16, weight: FontWeight.w600)),
              for (final offer in incoming) ...[
                SizedBox(height: 12),
                Row(children: [
                  Avatar(url: text((offer['from'] as Map?)?['avatar_url']), name: who(offer, 'from'), size: 40),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(offer['kind'] == 'gift' ? tr('{name} дарує вам номер', {'name': who(offer, 'from')}) : tr('{name} передає вам свій номер', {'name': who(offer, 'from')}), style: body(13.5, weight: FontWeight.w600)),
                      SizedBox(height: 2),
                      PhoneBadge(phone: Map<String, dynamic>.from(offer['phone'] as Map), size: 14),
                      if (mine != null) Text(tr('Ваш номер {n} звільниться.', {'n': mine['number']}), style: body(11.5, color: faint)),
                    ]),
                  ),
                ]),
                SizedBox(height: 10),
                Row(children: [
                  Expanded(child: SecondaryAction(label: tr('Відмовитися'), onTap: () => act(() => api.post(Api.site('/phone/offers/${offer['id']}/decline'))))),
                  SizedBox(width: 10),
                  Expanded(child: PrimaryButton(label: tr('Прийняти'), onPressed: () => act(() => api.post(Api.site('/phone/offers/${offer['id']}/accept'))))),
                ]),
              ],
            ]),
          ),
        if (outgoing.isNotEmpty || gifts.isNotEmpty) ...[
          if (incoming.isNotEmpty) SizedBox(height: 12),
          Glass(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(tr('Подарунки й передачі'), style: body(16, weight: FontWeight.w600)),
              for (final offer in outgoing) ...[
                SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      PhoneBadge(phone: Map<String, dynamic>.from(offer['phone'] as Map), size: 14),
                      Text(tr('Чекає, поки {name} прийме', {'name': who(offer, 'to')}), style: body(12, color: muted)),
                    ]),
                  ),
                  TextButton(onPressed: () => act(() => api.delete(Api.site('/phone/offers/${offer['id']}'))), child: Text(tr('Скасувати'), style: body(13, color: dangerSoft))),
                ]),
              ],
              for (final gift in gifts) ...[
                SizedBox(height: 12),
                PhoneBadge(phone: gift, size: 14),
                Text(tr('Подарунок не прийняли — подаруйте іншому другові або залиште собі.'), style: body(12, color: muted)),
                SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: SecondaryAction(
                      label: tr('Залишити собі'),
                      onTap: () => act(() => api.post(Api.site('/phone/gifts/${gift['id']}/claim'))),
                    ),
                  ),
                  SizedBox(width: 10),
                  Expanded(
                    child: PrimaryButton(
                      label: tr('Подарувати'),
                      onPressed: () async {
                        final friend = await pickFriend(context, maps(data['friends']), title: tr('Кому подарувати номер?'));
                        if (friend != null) await act(() => api.post(Api.site('/phone/gifts/${gift['id']}/give'), {'user_id': friend['id']}));
                      },
                    ),
                  ),
                ]),
              ],
            ]),
          ),
        ],
      ]),
    );
  }
}

// ───────────────────────── Приватність ─────────────────────────

class _Privacy extends StatelessWidget {
  const _Privacy({required this.data, required this.reload});
  final Map<String, dynamic> data;
  final Future<void> Function() reload;

  @override
  Widget build(BuildContext context) {
    final privacy = text(data['privacy']) ?? 'everyone';
    final visible = data['visible'] != false;
    Future<void> save(String p, bool v) async {
      if (await attempt(context, () => AppScope.read(context).session.api.put(Api.site('/phone/settings'), {'privacy': p, 'visible': v}))) await reload();
    }

    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Хто може дзвонити й писати за номером'), icon: LucideIcons.shieldCheck, caps: false),
        Segmented(
          options: [SegmentOption('everyone', tr('Усі')), SegmentOption('friends', tr('Друзі')), SegmentOption('nobody', tr('Ніхто'))],
          selected: privacy,
          onSelect: (value) => save(value, visible),
        ),
        SizedBox(height: 6),
        SwitchListTile(
          value: visible,
          contentPadding: EdgeInsets.zero,
          title: Text(tr('Показувати номер у профілі'), style: body(14.5, weight: FontWeight.w500)),
          onChanged: (value) => save(privacy, value),
        ),
      ]),
    );
  }
}

// ───────────────────────── Останні дзвінки ─────────────────────────

class _History extends StatelessWidget {
  const _History({required this.items});
  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) {
    return Glass(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CardTitle(tr('Останні дзвінки'), icon: LucideIcons.phone, caps: false),
        if (items.isEmpty)
          EmptyState(icon: LucideIcons.phoneMissed, title: tr('Дзвінків ще не було'), text: tr('Наберіть номер друга або подзвоніть із чату.'), boxed: false)
        else
          for (final call in items)
            Builder(builder: (context) {
              final user = Map<String, dynamic>.from(call['user'] as Map? ?? {});
              final direction = text(call['direction']);
              final seconds = call['seconds'] is num ? (call['seconds'] as num).toInt() : null;
              final icon = switch (direction) {
                'out' => LucideIcons.phoneOutgoing,
                'in' => LucideIcons.phoneIncoming,
                _ => LucideIcons.phoneMissed,
              };
              return Padding(
                padding: EdgeInsets.symmetric(vertical: 6),
                child: Row(children: [
                  GestureDetector(onTap: () => context.push('/u/${user['username']}'), child: Avatar(url: text(user['avatar_url']), name: text(user['name']) ?? '', size: 42)),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(text(user['name']) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: direction == 'missed' ? dangerSoft : ink, weight: FontWeight.w600)),
                      Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 6, children: [
                        Icon(icon, size: 13, color: muted),
                        Text(_date(text(call['at'])) + (seconds == null ? '' : ' · ${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}'), style: body(12, color: muted)),
                        if (call['phone'] is Map) PhoneBadge(phone: Map<String, dynamic>.from(call['phone'] as Map), size: 12),
                      ]),
                    ]),
                  ),
                  IconButton(
                    tooltip: tr('Подзвонити'),
                    onPressed: () => VoiceCall.instance.call(AppScope.read(context).session.api, intOf(call['conversation_id']), text(user['name']) ?? tr('Дзвінок'), onError: (e) {
                      if (context.mounted) toast(context, e);
                    }),
                    icon: Icon(LucideIcons.phone, size: 18, color: Color(0xFF10B981)),
                  ),
                ]),
              );
            }),
      ]),
    );
  }
}
