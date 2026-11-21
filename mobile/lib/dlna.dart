import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

import 'api.dart';
import 'state.dart';

// DLNA / UPnP AV: телевізори й колонки в тій самій мережі (Samsung, LG, Sony, Yamaha, Kodi…).
// Пошук — SSDP (multicast 239.255.255.250:1900), керування — SOAP-запити AVTransport.
// Без сторонніх пакетів: лише dart:io.

class DlnaRenderer {
  DlnaRenderer({required this.id, required this.name, required this.model, required this.transport, this.rendering});

  final String id;
  final String name;
  final String model;

  /// Повні адреси керування службами AVTransport і RenderingControl.
  final Uri transport;
  final Uri? rendering;
}

const _av = 'urn:schemas-upnp-org:service:AVTransport:1';
const _rc = 'urn:schemas-upnp-org:service:RenderingControl:1';

String _tag(String xml, String name) {
  final m = RegExp('<(?:[a-zA-Z0-9]+:)?$name[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?$name>').firstMatch(xml);
  return (m?.group(1) ?? '').trim();
}

String _escape(String value) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

String _unescape(String value) =>
    value.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&');

class Dlna {
  /// Знайти рендерери (MediaRenderer) у мережі за [timeout].
  static Future<List<DlnaRenderer>> discover({Duration timeout = const Duration(seconds: 3)}) async {
    final locations = <String>{};
    RawDatagramSocket? socket;
    try {
      socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
      final search = utf8.encode(
        'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: urn:schemas-upnp-org:device:MediaRenderer:1\r\n\r\n',
      );
      socket.listen((event) {
        if (event != RawSocketEvent.read) return;
        final packet = socket?.receive();
        if (packet == null) return;
        final headers = utf8.decode(packet.data, allowMalformed: true);
        final location = RegExp(r'^location:\s*(\S+)', caseSensitive: false, multiLine: true).firstMatch(headers)?.group(1);
        if (location != null) locations.add(location);
      });
      final group = InternetAddress('239.255.255.250');
      socket.send(search, group, 1900);
      await Future<void>.delayed(const Duration(milliseconds: 400));
      socket.send(search, group, 1900);
      await Future<void>.delayed(timeout);
    } catch (_) {
      // Немає Wi-Fi чи multicast заборонено — просто нічого не знайдемо.
    } finally {
      socket?.close();
    }
    final found = await Future.wait(locations.map(_describe));
    final unique = <String, DlnaRenderer>{};
    for (final r in found) {
      if (r != null) unique[r.id] = r;
    }
    return unique.values.toList();
  }

  static Future<DlnaRenderer?> _describe(String location) async {
    try {
      final base = Uri.parse(location);
      final xml = await _get(base);
      if (xml == null) return null;
      final urlBase = _tag(xml, 'URLBase');
      final root = urlBase.isNotEmpty ? Uri.parse(urlBase) : base;
      Uri? control(String type) {
        for (final m in RegExp(r'<service>([\s\S]*?)</service>').allMatches(xml)) {
          final block = m.group(1)!;
          if (_tag(block, 'serviceType').startsWith(type.substring(0, type.length - 1))) {
            final url = _tag(block, 'controlURL');
            return url.isEmpty ? null : root.resolve(url);
          }
        }
        return null;
      }

      final transport = control(_av);
      if (transport == null) return null;
      return DlnaRenderer(
        id: _tag(xml, 'UDN').isNotEmpty ? _tag(xml, 'UDN') : location,
        name: _unescape(_tag(xml, 'friendlyName')).isNotEmpty ? _unescape(_tag(xml, 'friendlyName')) : base.host,
        model: _unescape(_tag(xml, 'modelName')),
        transport: transport,
        rendering: control(_rc),
      );
    } catch (_) {
      return null;
    }
  }

  static Future<String?> _get(Uri url) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 3);
    try {
      final req = await client.getUrl(url);
      final res = await req.close().timeout(const Duration(seconds: 4));
      if (res.statusCode != 200) return null;
      return await res.transform(utf8.decoder).join().timeout(const Duration(seconds: 4));
    } finally {
      client.close(force: true);
    }
  }

  /// SOAP-виклик служби; повертає тіло відповіді або null.
  static Future<String?> soap(Uri url, String service, String action, Map<String, String> args) async {
    final body = StringBuffer('<?xml version="1.0" encoding="utf-8"?>'
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
        '<s:Body><u:$action xmlns:u="$service">');
    args.forEach((k, v) => body.write('<$k>${_escape(v)}</$k>'));
    body.write('</u:$action></s:Body></s:Envelope>');
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 3);
    try {
      final req = await client.postUrl(url);
      req.headers.set('Content-Type', 'text/xml; charset="utf-8"');
      req.headers.set('SOAPAction', '"$service#$action"');
      req.add(utf8.encode(body.toString()));
      final res = await req.close().timeout(const Duration(seconds: 5));
      final text = await res.transform(utf8.decoder).join();
      return res.statusCode == 200 ? text : null;
    } catch (_) {
      return null;
    } finally {
      client.close(force: true);
    }
  }
}

String _clock(Duration d) {
  final s = d.inSeconds;
  return '${s ~/ 3600}:${(s % 3600 ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';
}

Duration _parseClock(String value) {
  final parts = value.split(':').map((p) => int.tryParse(p.split('.').first) ?? 0).toList();
  if (parts.length != 3) return Duration.zero;
  return Duration(hours: parts[0], minutes: parts[1], seconds: parts[2]);
}

/// Трансляція плеєра на DLNA-пристрій. Плеєр у застосунку йде далі беззвучно (черга, перемотування,
/// «наступний»), а телевізор чи колонка отримує той самий трек і команди.
class DlnaCast extends ChangeNotifier {
  DlnaCast._();
  static final instance = DlnaCast._();

  TrackPlayer? _player;
  DlnaRenderer? renderer;

  /// `loading`, `playing`, `paused`, `error`.
  String status = 'idle';
  String? _key;
  bool _playing = false;
  bool _seenPlaying = false;
  Timer? _poll;
  Duration _lastPosition = Duration.zero;

  bool get active => renderer != null;

  /// Гучність телевізора чи колонки, 0–1.
  double volume = 0.5;

  void previewVolume(double value) {
    volume = value.clamp(0.0, 1.0);
    notifyListeners();
  }

  Future<void> start(DlnaRenderer target, TrackPlayer player) async {
    await stop();
    renderer = target;
    _player = player;
    status = 'loading';
    notifyListeners();
    player.castMuted = true;
    player.addListener(_sync);
    player.onSeek = (to) => unawaited(seek(to));
    _key = null;
    await _sync();
    if (target.rendering != null) {
      final res = await Dlna.soap(target.rendering!, _rc, 'GetVolume', {'InstanceID': '0', 'Channel': 'Master'});
      final level = int.tryParse(res == null ? '' : _tag(res, 'CurrentVolume'));
      if (level != null) previewVolume(level / 100);
    }
    _poll = Timer.periodic(const Duration(seconds: 2), (_) => _check());
  }

  Future<void> stop() async {
    _poll?.cancel();
    _poll = null;
    final target = renderer;
    final player = _player;
    renderer = null;
    _player = null;
    status = 'idle';
    _key = null;
    if (player != null) {
      player.removeListener(_sync);
      player.onSeek = null;
      // Звук повертається на телефон із того самого місця.
      if (_lastPosition > Duration.zero && player.current != null && !player.current!.live) {
        unawaited(player.seek(_lastPosition));
      }
      player.castMuted = false;
    }
    notifyListeners();
    if (target != null) await Dlna.soap(target.transport, _av, 'Stop', {'InstanceID': '0'});
  }

  Future<void> setVolume(double value) async {
    volume = value.clamp(0.0, 1.0);
    notifyListeners();
    final target = renderer;
    if (target?.rendering == null) return;
    await Dlna.soap(target!.rendering!, _rc, 'SetVolume', {'InstanceID': '0', 'Channel': 'Master', 'DesiredVolume': '${(value * 100).round()}'});
  }

  Future<void> _sync() async {
    final target = renderer;
    final player = _player;
    if (target == null || player == null) return;
    final track = player.current;
    if (track == null) return;
    if (track.key != _key) {
      _key = track.key;
      _seenPlaying = false;
      status = 'loading';
      notifyListeners();
      final url = absolute(track.url) ?? track.url;
      final mime = switch (url.split('?').first.split('.').last.toLowerCase()) {
        'flac' => 'audio/flac',
        'm4a' || 'aac' || 'mp4' => 'audio/mp4',
        'ogg' || 'oga' || 'opus' => 'audio/ogg',
        'wav' => 'audio/wav',
        _ => 'audio/mpeg',
      };
      final cover = absolute(track.cover);
      final meta = '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" '
          'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"><item id="0" parentID="-1" restricted="1">'
          '<dc:title>${_escape(track.title)}</dc:title><upnp:artist>${_escape(track.artist)}</upnp:artist>'
          '${cover != null ? '<upnp:albumArtURI>${_escape(cover)}</upnp:albumArtURI>' : ''}'
          '<upnp:class>object.item.audioItem.musicTrack</upnp:class>'
          '<res protocolInfo="http-get:*:$mime:*">${_escape(url)}</res></item></DIDL-Lite>';
      final ok = await Dlna.soap(target.transport, _av, 'SetAVTransportURI', {'InstanceID': '0', 'CurrentURI': url, 'CurrentURIMetaData': meta});
      if (ok == null) {
        status = 'error';
        notifyListeners();
        return;
      }
      _playing = false;
    }
    if (player.playing != _playing) {
      _playing = player.playing;
      await Dlna.soap(target.transport, _av, _playing ? 'Play' : 'Pause', {'InstanceID': '0', if (_playing) 'Speed': '1'});
      status = _playing ? 'playing' : 'paused';
      notifyListeners();
    }
  }

  /// Перемотування з плеєра застосунку.
  Future<void> seek(Duration to) async {
    final target = renderer;
    if (target == null) return;
    await Dlna.soap(target.transport, _av, 'Seek', {'InstanceID': '0', 'Unit': 'REL_TIME', 'Target': _clock(to)});
  }

  Future<void> _check() async {
    final target = renderer;
    final player = _player;
    if (target == null || player == null) return;
    final info = await Dlna.soap(target.transport, _av, 'GetTransportInfo', {'InstanceID': '0'});
    if (info == null) return;
    final state = _tag(info, 'CurrentTransportState');
    final pos = await Dlna.soap(target.transport, _av, 'GetPositionInfo', {'InstanceID': '0'});
    if (pos != null) _lastPosition = _parseClock(_tag(pos, 'RelTime'));
    if (state == 'PLAYING') _seenPlaying = true;
    // Зупинили на самому телевізорі (не кінець треку) — трансляцію завершено.
    final left = player.duration - player.position;
    if (state == 'STOPPED' && _seenPlaying && _playing && left > const Duration(seconds: 6)) {
      await player.pause();
      await stop();
    }
  }
}
