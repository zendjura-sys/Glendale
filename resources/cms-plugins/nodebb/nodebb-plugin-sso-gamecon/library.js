'use strict';

// NodeBB: «Увійти через GameCon» — passport-oauth2 з PKCE і state.
const passport = require.main.require('passport');
const OAuth2Strategy = require('passport-oauth2');
const nconf = require.main.require('nconf');
const winston = require.main.require('winston');
const db = require.main.require('./src/database');
const user = require.main.require('./src/user');
const meta = require.main.require('./src/meta');
const routeHelpers = require.main.require('./src/routes/helpers');

const plugin = {};

plugin.init = async ({ router }) => {
  routeHelpers.setupAdminPageRoute(router, '/admin/plugins/sso-gamecon', async (req, res) => {
    res.render('admin/plugins/sso-gamecon', { title: 'GameCon', callbackURL: `${nconf.get('url')}/auth/gamecon/callback` });
  });
};

plugin.getStrategy = async (strategies) => {
  const settings = await meta.settings.get('sso-gamecon');
  if (!settings.id || !settings.secret) {
    return strategies;
  }
  const base = (settings.base || 'https://gamecon.online').replace(/\/$/, '');
  const strategy = new OAuth2Strategy({
    authorizationURL: `${base}/oauth/authorize`,
    tokenURL: `${base}/oauth/token`,
    clientID: settings.id,
    clientSecret: settings.secret,
    callbackURL: `${nconf.get('url')}/auth/gamecon/callback`,
    scope: ['profile', 'email'],
    scopeSeparator: ' ',
    state: true,
    pkce: true,
    passReqToCallback: true,
  }, async (req, accessToken, refreshToken, params, profile, done) => {
    try {
      const response = await fetch(`${base}/api/developer/v1/userinfo`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
      const me = await response.json();
      if (!me || !me.sub) {
        throw new Error('GameCon не повернув профіль.');
      }
      const uid = await plugin.login(me, req.uid);
      done(null, { uid });
    } catch (err) {
      winston.error(`[sso-gamecon] ${err.message}`);
      done(err);
    }
  });
  passport.use('gamecon', strategy);
  strategies.push({
    name: 'gamecon',
    url: '/auth/gamecon',
    callbackURL: '/auth/gamecon/callback',
    icon: 'fa-gamepad',
    icons: { normal: 'fa fa-gamepad', square: 'fa fa-gamepad', svg: '' },
    labels: { login: 'Увійти через GameCon', register: 'Зареєструватися через GameCon' },
    color: '#4f46e5',
    scope: 'profile email',
  });
  return strategies;
};

/** Зв’язати з наявним (за GameCon ID чи підтвердженою поштою) або створити. */
plugin.login = async (me, currentUid) => {
  const gameconId = String(me.sub);
  let uid = await db.getObjectField('gamecon:uid', gameconId);
  if (uid) {
    return uid;
  }
  if (currentUid) {
    uid = currentUid;
  } else if (me.email && me.email_verified) {
    uid = await user.getUidByEmail(me.email);
  }
  if (!uid) {
    const username = String(me.preferred_username || `gamer${gameconId}`).replace(/[^\w\-]/g, '').slice(0, 24) || `gamer${gameconId}`;
    uid = await user.create({ username, email: me.email && me.email_verified ? me.email : undefined, fullname: me.name || undefined });
    if (me.email && me.email_verified) {
      await user.email.confirmByUid(uid).catch(() => {});
    }
    if (me.picture) {
      await user.setUserFields(uid, { uploadedpicture: me.picture, picture: me.picture });
    }
  }
  await user.setUserField(uid, 'gamecon_id', gameconId);
  await db.setObjectField('gamecon:uid', gameconId, uid);
  return uid;
};

plugin.getAssociation = async (data) => {
  const gameconId = await user.getUserField(data.uid, 'gamecon_id');
  data.associations.push({
    associated: !!gameconId,
    url: gameconId ? `${(await meta.settings.get('sso-gamecon')).base || 'https://gamecon.online'}/u/` : undefined,
    deauthUrl: undefined,
    name: 'GameCon',
    icon: 'fa-gamepad',
  });
  return data;
};

plugin.addMenuItem = async (header) => {
  header.authentication.push({ route: '/plugins/sso-gamecon', icon: 'fa-gamepad', name: 'GameCon' });
  return header;
};

plugin.deleteUserData = async ({ uid }) => {
  const gameconId = await user.getUserField(uid, 'gamecon_id');
  if (gameconId) {
    await db.deleteObjectField('gamecon:uid', gameconId);
  }
};

module.exports = plugin;
