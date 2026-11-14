// Кнопка «Увійти через GameCon» у вікні входу й реєстрації Flarum (без збірки — чистий JS).
(function () {
  var extend = flarum.core.compat['common/extend'].extend;
  var LogInButtons = flarum.core.compat['forum/components/LogInButtons'];
  var LogInButton = flarum.core.compat['forum/components/LogInButton'];
  var app = flarum.core.compat['forum/app'];

  app.initializers.add('gamecon-flarum-login', function () {
    extend(LogInButtons.prototype, 'items', function (items) {
      items.add(
        'gamecon',
        m(LogInButton, { className: 'Button LogInButton--gamecon', icon: 'fas fa-gamepad', path: '/auth/gamecon' },
          app.translator.trans('gamecon-login.forum.log_in_with'))
      );
    });
  });
})();
module.exports = {};
