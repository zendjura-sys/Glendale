// Налаштування розширення: Client ID, Secret, адреса GameCon.
(function () {
  var app = flarum.core.compat['admin/app'];
  app.initializers.add('gamecon-flarum-login', function () {
    app.extensionData
      .for('gamecon-flarum-login')
      .registerSetting({ setting: 'gamecon-login.client_id', type: 'text', label: 'Client ID',
        help: app.translator.trans('gamecon-login.admin.redirect', { url: app.forum.attribute('baseUrl') + '/auth/gamecon' }) })
      .registerSetting({ setting: 'gamecon-login.client_secret', type: 'password', label: 'Client Secret' })
      .registerSetting({ setting: 'gamecon-login.base_url', type: 'url', label: app.translator.trans('gamecon-login.admin.base'), placeholder: 'https://gamecon.online' });
  });
})();
module.exports = {};
