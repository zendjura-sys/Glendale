'use strict';

define('admin/plugins/sso-gamecon', ['settings', 'alerts'], function (Settings, alerts) {
  var ACP = {};
  ACP.init = function () {
    Settings.load('sso-gamecon', $('.sso-gamecon-settings'));
    $('#save').on('click', function () {
      Settings.save('sso-gamecon', $('.sso-gamecon-settings'), function () {
        alerts.alert({ type: 'success', alert_id: 'sso-gamecon-saved', title: 'Збережено', message: 'Перезапустіть NodeBB, щоб застосувати.', clickfn: function () { socket.emit('admin.restart'); } });
      });
    });
  };
  return ACP;
});
