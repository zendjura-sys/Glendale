<!doctype html>
<html lang="{{ $lang }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>GameCon Overlay</title>
{{-- Повністю прозоре полотно: гра видна крізь сторінку, клікабельні лише скляні віджети. --}}
<style>html,body{margin:0;height:100%;background:transparent!important;overflow:hidden}</style>
</head>
<body>
<script src="{{ url('/sdk/v1/gamecon-sdk.js') }}?lang={{ $lang }}"></script>
<script>
GameConSDK.init(@json($opts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG));
</script>
</body>
</html>
