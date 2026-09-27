import { q, now } from './db.js';
import { isOnline, send } from './realtime.js';
import { levelOf, isStaff } from './auth.js';

const ONLINE_WINDOW = 5 * 60 * 1000;

export function userShort(u) {
  if (!u) return null;
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    avatar: u.avatar,
    online: isOnline(u.id) || now() - u.last_seen < ONLINE_WINDOW,
    lastSeen: u.last_seen,
    verified: !!u.verified,
  };
}

export function userFull(u) {
  return {
    ...userShort(u),
    cover: u.cover,
    status: u.status,
    bio: u.bio,
    city: u.city,
    birthday: u.birthday,
    createdAt: u.created_at,
  };
}

/** The signed-in user's own profile, with level and permissions for the UI. */
export function meFull(u) {
  const l = levelOf(u);
  return {
    ...userFull(u),
    email: u.email,
    level: { id: l.id, title: l.title, type: l.type },
    permissions: {
      post: !!l.can_post,
      comment: !!l.can_comment,
      message: !!l.can_message,
      createGroups: !!l.can_create_groups,
      upload: !!l.can_upload,
    },
  };
}

const staffCache = new Map();
/** Whether a user is staff (moderator or admin). Cached briefly per request burst. */
export function isStaffUser(id) {
  const hit = staffCache.get(id);
  if (hit && hit.at > Date.now() - 2000) return hit.value;
  const u = getUser(id);
  const value = !!u && isStaff(levelOf(u));
  staffCache.set(id, { value, at: Date.now() });
  return value;
}

export function groupShort(g, meId) {
  if (!g) return null;
  const membersCount = q('SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?').get(g.id).c;
  const member = meId ? q('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(g.id, meId) : null;
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    avatar: g.avatar,
    cover: g.cover,
    ownerId: g.owner_id,
    membersCount,
    isMember: !!member,
    isAdmin: member?.role === 'admin',
    createdAt: g.created_at,
  };
}

export const getUser = (id) => q('SELECT * FROM users WHERE id = ?').get(id);
export const getGroup = (id) => q('SELECT * FROM groups WHERE id = ?').get(id);

export function areFriends(a, b) {
  return !!q('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?').get(a, b);
}

export function friendshipStatus(meId, otherId) {
  if (meId === otherId) return 'self';
  if (areFriends(meId, otherId)) return 'friends';
  if (q('SELECT 1 FROM friend_requests WHERE from_id = ? AND to_id = ?').get(meId, otherId)) return 'outgoing';
  if (q('SELECT 1 FROM friend_requests WHERE from_id = ? AND to_id = ?').get(otherId, meId)) return 'incoming';
  return 'none';
}

export function isGroupAdmin(groupId, userId) {
  return q("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND role = 'admin'").get(groupId, userId) != null;
}

export function trackJson(t, meId) {
  if (!t) return null;
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    duration: Math.round(t.duration),
    url: t.file,
    cover: t.cover,
    plays: t.plays,
    createdAt: t.created_at,
    ownerId: t.owner_id,
    added: meId ? !!q('SELECT 1 FROM user_tracks WHERE user_id = ? AND track_id = ?').get(meId, t.id) : false,
  };
}

export const getTrack = (id) => (id ? q('SELECT * FROM tracks WHERE id = ?').get(id) : null);

/** Parses an open.spotify.com link into an embeddable reference. */
export function spotifyRef(value) {
  const m = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{10,40})/.exec(value || '');
  return m ? { type: m[1], id: m[2] } : null;
}

/** Turns raw post rows into API objects (author, counters, repost source). */
export function hydratePosts(rows, meId, depth = 0) {
  return rows.map((p) => {
    const likes = q('SELECT COUNT(*) AS c FROM likes WHERE post_id = ?').get(p.id).c;
    const liked = !!q('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(p.id, meId);
    const comments = q('SELECT COUNT(*) AS c FROM comments WHERE post_id = ?').get(p.id).c;
    const reposts = q('SELECT COUNT(*) AS c FROM posts WHERE repost_of = ?').get(p.id).c;
    const reposted = !!q('SELECT 1 FROM posts WHERE repost_of = ? AND author_id = ?').get(p.id, meId);
    const author = userShort(getUser(p.author_id));
    const group = p.owner_type === 'group' ? groupShort(getGroup(p.owner_id), meId) : null;
    const wallOwner = p.owner_type === 'user' && p.owner_id !== p.author_id ? userShort(getUser(p.owner_id)) : null;

    let repost = null;
    if (p.repost_of && depth < 1) {
      const src = q('SELECT * FROM posts WHERE id = ?').get(p.repost_of);
      if (src) [repost] = hydratePosts([src], meId, depth + 1);
    }

    let canDelete = p.author_id === meId;
    if (!canDelete && p.owner_type === 'user') canDelete = p.owner_id === meId;
    if (!canDelete && p.owner_type === 'group') canDelete = isGroupAdmin(p.owner_id, meId);
    if (!canDelete) canDelete = isStaffUser(meId);

    return {
      id: p.id,
      text: p.text,
      image: p.image,
      createdAt: p.created_at,
      ownerType: p.owner_type,
      ownerId: p.owner_id,
      fromGroup: !!p.from_group,
      author,
      group,
      wallOwner,
      repost,
      audio: trackJson(getTrack(p.audio_id), meId),
      spotify: spotifyRef(p.spotify || p.text),
      likes,
      liked,
      comments,
      reposts,
      reposted,
      canDelete,
    };
  });
}

export function hydrateComment(c) {
  return { id: c.id, postId: c.post_id, text: c.text, createdAt: c.created_at, author: userShort(getUser(c.author_id)) };
}

export function hydrateMessage(m) {
  return {
    id: m.id,
    fromId: m.from_id,
    toId: m.to_id,
    text: m.text,
    image: m.image,
    audio: trackJson(getTrack(m.audio_id)),
    spotify: spotifyRef(m.text),
    isRead: !!m.is_read,
    createdAt: m.created_at,
  };
}

export function hydrateNotification(n) {
  let post = null;
  if (n.post_id) {
    const p = q('SELECT id, text, image FROM posts WHERE id = ?').get(n.post_id);
    if (p) post = { id: p.id, text: p.text.slice(0, 120), image: p.image };
  }
  return {
    id: n.id,
    type: n.type,
    text: n.text,
    isRead: !!n.is_read,
    createdAt: n.created_at,
    actor: userShort(getUser(n.actor_id)),
    post,
  };
}

export function notify(userId, actorId, type, { postId = null, text = '' } = {}) {
  if (userId === actorId) return;
  const r = q(
    'INSERT INTO notifications (user_id, actor_id, type, post_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(userId, actorId, type, postId, text, now());
  const row = q('SELECT * FROM notifications WHERE id = ?').get(Number(r.lastInsertRowid));
  send(userId, 'notification', hydrateNotification(row));
}

export function counters(userId) {
  return {
    messages: q('SELECT COUNT(DISTINCT from_id) AS c FROM messages WHERE to_id = ? AND is_read = 0').get(userId).c,
    friends: q('SELECT COUNT(*) AS c FROM friend_requests WHERE to_id = ?').get(userId).c,
    notifications: q('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0').get(userId).c,
  };
}

export function pushCounters(userId) {
  send(userId, 'counters', counters(userId));
}
