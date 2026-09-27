import { tr } from '../lib/i18n';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Crown,
  Image as ImageIcon,
  Info,
  LogOut,
  MessageCircle,
  Music,
  Pencil,
  Search,
  Shield,
  SquarePen,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { api, form } from '../lib/api';
import { useMe } from '../lib/auth';
import { isTyping, useRealtime, type ChatMessagesCache, type MessagesCache } from '../lib/realtime';
import type { Chat, ChatMessage, Dialog, Message, Profile, Track, UserShort } from '../lib/types';
import { formatDay, formatShort, formatTime, fullName, lastSeenText, plural } from '../lib/utils';
import { AutoTextarea, Avatar, Empty, Modal, PhotoViewer, Spinner, pickFile } from '../components/ui';
import { SendButton, TypingDots } from '../components/uiverse';
import { SpotifyEmbed, TrackCover, TrackPicker, TrackRow } from '../components/Music';

// ───────────────────────────── conversation list ─────────────────────────────

type Entry =
  | { kind: 'dialog'; key: string; at: number; d: Dialog }
  | { kind: 'chat'; key: string; at: number; c: Chat };

function ChatAvatar({ chat, size = 48 }: { chat: Pick<Chat, 'id' | 'title' | 'avatar' | 'previewMembers'>; size?: number }) {
  if (chat.avatar) return <Avatar src={chat.avatar} name={chat.title} id={chat.id + 500} size={size} />;
  const m = chat.previewMembers.slice(0, 2);
  if (m.length < 2) return <Avatar src={null} name={chat.title} id={chat.id + 500} size={size} />;
  // Two overlapping member avatars stand for a group.
  return (
    <span className="chat-avatar" style={{ width: size, height: size }}>
      <Avatar src={m[0].avatar} name={fullName(m[0])} id={m[0].id} size={size * 0.66} />
      <Avatar src={m[1].avatar} name={fullName(m[1])} id={m[1].id} size={size * 0.66} />
    </span>
  );
}

function CreateChatModal({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: friends } = useQuery({ queryKey: ['friends', me.id], queryFn: () => api<UserShort[]>(`/users/${me.id}/friends`) });
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const list = (friends ?? []).filter((f) => fullName(f).toLowerCase().includes(q.trim().toLowerCase()));
  const create = async () => {
    try {
      const chat = await api<Chat>('/chats', { body: { title, memberIds: [...picked] } });
      qc.invalidateQueries({ queryKey: ['chats'] });
      onClose();
      navigate(`/im/c/${chat.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal
      title={tr('Новая беседа')}
      onClose={onClose}
      footer={
        <button className="btn" disabled={!title.trim() || !picked.size} onClick={create}>
          {tr('Создать беседу')}{picked.size ? ` · ${picked.size + 1}` : ''}
        </button>
      }
    >
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input className="field" autoFocus placeholder={tr('Название беседы')} maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="field" placeholder={tr('Поиск друзей')} value={q} onChange={(e) => setQ(e.target.value)} />
        <FriendChecklist users={list} picked={picked} setPicked={setPicked} loading={!friends} />
        {error && <div className="error-text">{error}</div>}
      </div>
    </Modal>
  );
}

function FriendChecklist({
  users,
  picked,
  setPicked,
  loading,
  disabled,
}: {
  users: UserShort[];
  picked: Set<number>;
  setPicked: (s: Set<number>) => void;
  loading?: boolean;
  disabled?: Set<number>;
}) {
  if (loading) return <Spinner />;
  if (!users.length) return <Empty icon={<Users size={32} />} title={tr('Нет друзей для добавления')} />;
  return (
    <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
      {users.map((u) => {
        const off = disabled?.has(u.id);
        return (
          <label key={u.id} className="menu-item check" style={{ borderRadius: 12, cursor: off ? 'default' : 'pointer', opacity: off ? 0.5 : 1 }}>
            <input
              type="checkbox"
              disabled={off}
              checked={off || picked.has(u.id)}
              onChange={() => {
                const next = new Set(picked);
                if (next.has(u.id)) next.delete(u.id);
                else next.add(u.id);
                setPicked(next);
              }}
            />
            <Avatar src={u.avatar} name={fullName(u)} id={u.id} size={32} online={u.online} />
            {fullName(u)}
            {off && <span className="meta" style={{ marginLeft: 'auto' }}>{tr('уже в беседе')}</span>}
          </label>
        );
      })}
    </div>
  );
}

function ConversationList({ active }: { active: string | null }) {
  const me = useMe();
  const { typing, chatTyping } = useRealtime();
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const { data: dialogs, isLoading: l1 } = useQuery({ queryKey: ['dialogs'], queryFn: () => api<Dialog[]>('/dialogs') });
  const { data: chats, isLoading: l2 } = useQuery({ queryKey: ['chats'], queryFn: () => api<Chat[]>('/chats') });

  const needle = filter.trim().toLowerCase();
  const entries: Entry[] = [
    ...(dialogs ?? []).map((d) => ({ kind: 'dialog' as const, key: `u${d.peer.id}`, at: d.lastMessage.createdAt, d })),
    ...(chats ?? []).map((c) => ({ kind: 'chat' as const, key: `c${c.id}`, at: c.lastMessage?.createdAt ?? c.createdAt, c })),
  ]
    .filter((e) => !needle || (e.kind === 'dialog' ? fullName(e.d.peer) : e.c.title).toLowerCase().includes(needle))
    .sort((a, b) => b.at - a.at);

  return (
    <div className="im-list">
      <div className="im-list-head" style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--icon)' }} />
          <input className="field" style={{ paddingLeft: 36 }} placeholder={tr('Поиск')} value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <button className="icon-btn" style={{ width: 40, height: 40 }} onClick={() => setCreating(true)} aria-label={tr('Новая беседа')} title={tr('Новая беседа')}>
          <SquarePen size={20} />
        </button>
      </div>
      <div className="im-list-scroll">
        {(l1 || l2) && <Spinner />}
        {!l1 && !l2 && !entries.length && (
          <Empty icon={<MessageCircle size={40} />} title={tr('Нет сообщений')}>
            {tr('Напишите другу или создайте беседу')}
          </Empty>
        )}
        {entries.map((e) => {
          if (e.kind === 'dialog') {
            const { d } = e;
            const m = d.lastMessage;
            const mine = m.fromId === me.id;
            return (
              <Link key={e.key} to={`/im/${d.peer.id}`} className={`dialog${active === e.key ? ' active' : ''}`}>
                <Avatar src={d.peer.avatar} name={fullName(d.peer)} id={d.peer.id} size={48} online={d.peer.online} />
                <div className="body">
                  <div className="top">
                    <span className="name ellipsis">{fullName(d.peer)}</span>
                    <span className="meta">{formatShort(m.createdAt)}</span>
                  </div>
                  <div className="preview">
                    {isTyping(typing, d.peer.id) ? (
                      <span className="text typing ellipsis">
                        {tr('печатает')}
                        <TypingDots />
                      </span>
                    ) : (
                      <span className="text ellipsis">
                        {mine && <span style={{ color: 'var(--text-2)' }}>{tr('Вы:')} </span>}
                        <span style={{ color: mine ? 'var(--text-2)' : 'var(--text)' }}>{previewText(m)}</span>
                      </span>
                    )}
                    {d.unread > 0 && <span className="badge">{d.unread}</span>}
                    {mine && !m.isRead && <span className="unread-dot" title={tr('Не прочитано')} />}
                  </div>
                </div>
              </Link>
            );
          }
          const { c } = e;
          const m = c.lastMessage;
          const typers = Object.entries(chatTyping[c.id] ?? {}).filter(([, ts]) => Date.now() - ts < 5000);
          const mine = m?.fromId === me.id;
          return (
            <Link key={e.key} to={`/im/c/${c.id}`} className={`dialog${active === e.key ? ' active' : ''}`}>
              <ChatAvatar chat={c} />
              <div className="body">
                <div className="top">
                  <span className="name ellipsis">
                    <Users size={13} style={{ verticalAlign: '-1px', marginRight: 4, color: 'var(--text-3)' }} />
                    {c.title}
                  </span>
                  {m && <span className="meta">{formatShort(m.createdAt)}</span>}
                </div>
                <div className="preview">
                  {typers.length ? (
                    <span className="text typing ellipsis">
                      {typers.length === 1 ? tr('печатает') : tr('печатают')}
                      <TypingDots />
                    </span>
                  ) : (
                    <span className="text ellipsis">
                      {m && m.kind === 'text' && (
                        <span style={{ color: 'var(--text-2)' }}>{mine ? tr('Вы') : m.author?.firstName}: </span>
                      )}
                      <span style={{ color: m?.kind === 'system' || mine ? 'var(--text-2)' : 'var(--text)' }}>{m ? previewText(m) : tr('Нет сообщений')}</span>
                    </span>
                  )}
                  {c.unread > 0 && <span className="badge">{c.unread}</span>}
                  {mine && m && c.readUpTo < m.id && <span className="unread-dot" title={tr('Не прочитано')} />}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {creating && <CreateChatModal onClose={() => setCreating(false)} />}
    </div>
  );
}

const systemText = (m: Pick<ChatMessage, 'system' | 'text'>) => (m.system ? tr(m.system.key, m.system.params) : m.text);

const previewText = (m: Pick<Message, 'text' | 'image' | 'audio'> & { system?: ChatMessage['system'] }) =>
  m.system ? systemText(m as ChatMessage) :
  m.text || (m.audio ? `🎵 ${m.audio.artist ? `${m.audio.artist} — ` : ''}${m.audio.title}` : m.image ? tr('🖼 Фотография') : '');

// ───────────────────────────── shared chat pieces ─────────────────────────────

type AnyMessage = (Message | ChatMessage) & { pending?: boolean };

/** Scroll behaviour shared by 1:1 and group chats: stick to bottom, keep position when older pages load. */
function useChatScroll(count: number, loading: boolean) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prevHeight = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current != null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (stick.current) el.scrollTop = el.scrollHeight;
  }, [count, loading]);
  return { scroller, stick, prevHeight };
}

function MessageBody({ m, onImage }: { m: AnyMessage; onImage: (url: string) => void }) {
  return (
    <>
      {m.image && <img src={m.image} alt="" onClick={() => onImage(m.image!)} />}
      {m.audio && (
        <div className="post-audio">
          <TrackRow track={m.audio} list={[m.audio]} index={0} />
        </div>
      )}
      {m.text}
      {m.spotify && <SpotifyEmbed spotify={m.spotify} />}
    </>
  );
}

function Composer({ onSend, onTyping }: { onSend: (p: { text: string; file: File | null; audio: Track | null }) => void; onTyping: () => void }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [audio, setAudio] = useState<Track | null>(null);
  const [picking, setPicking] = useState(false);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const send = () => {
    if (!text.trim() && !file && !audio) return;
    onSend({ text: text.trim(), file, audio });
    setText('');
    setFile(null);
    setAudio(null);
  };
  return (
    <>
      {(preview || audio) && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px 0', flexWrap: 'wrap' }}>
          {preview && (
            <div className="attach-preview" style={{ margin: 0 }}>
              <img src={preview} alt="" />
              <button onClick={() => setFile(null)} aria-label={tr('Убрать фото')}>
                <X size={14} />
              </button>
            </div>
          )}
          {audio && (
            <div className="attach-chip" style={{ margin: 0 }}>
              <TrackCover track={audio} size={34} />
              <div className="track-info">
                <div className="track-title ellipsis">{audio.title}</div>
                <div className="track-artist ellipsis">{audio.artist}</div>
              </div>
              <button className="icon-btn" onClick={() => setAudio(null)} aria-label={tr('Убрать аудиозапись')}>
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      )}
      <div className="im-input">
        <button
          className="icon-btn"
          aria-label={tr('Прикрепить фото')}
          onClick={async () => {
            const [f] = await pickFile();
            if (f) setFile(f);
          }}
        >
          <ImageIcon size={22} />
        </button>
        <button className="icon-btn" aria-label={tr('Прикрепить аудиозапись')} onClick={() => setPicking(true)}>
          <Music size={22} />
        </button>
        <AutoTextarea
          className="autogrow"
          placeholder={tr('Напишите сообщение...')}
          value={text}
          maxLength={4000}
          autoFocus
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) onTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <SendButton onClick={send} disabled={!text.trim() && !file && !audio} />
      </div>
      {picking && (
        <TrackPicker
          onClose={() => setPicking(false)}
          onPick={(t) => {
            setAudio(t);
            setPicking(false);
          }}
        />
      )}
    </>
  );
}

function ChatShell({
  head,
  messages,
  loading,
  hasMore,
  loadOlder,
  renderRow,
  composer,
}: {
  head: ReactNode;
  messages: AnyMessage[];
  loading: boolean;
  hasMore: boolean;
  loadOlder: (prevHeight: (h: number) => void) => Promise<void>;
  renderRow: (m: AnyMessage, i: number) => ReactNode;
  composer: ReactNode;
}) {
  const { scroller, stick, prevHeight } = useChatScroll(messages.length, loading);
  const [older, setOlder] = useState(false);
  const onScroll = async () => {
    const el = scroller.current!;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 200 && hasMore && !older && messages.length) {
      setOlder(true);
      try {
        await loadOlder((h) => (prevHeight.current = h));
      } finally {
        setOlder(false);
      }
    }
  };
  // Sending always jumps back to the newest message.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.pending) stick.current = true;
  }, [messages, stick]);

  return (
    <div className="im-chat">
      <div className="im-chat-head">{head}</div>
      <div className="im-messages" ref={scroller} onScroll={onScroll}>
        {(loading || older) && <Spinner />}
        {!loading && !messages.length && (
          <div className="im-empty">
            <div>
              <MessageCircle size={48} color="var(--icon)" />
              <div style={{ marginTop: 8 }}>{tr('Здесь будет выводиться история переписки')}</div>
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const newDay = i === 0 || formatDay(messages[i - 1].createdAt) !== formatDay(m.createdAt);
          return (
            <Fragment key={m.id}>
              {newDay && <div className="day-sep">{formatDay(m.createdAt)}</div>}
              {renderRow(m, i)}
            </Fragment>
          );
        })}
      </div>
      {composer}
    </div>
  );
}

let tempId = -1;

// ───────────────────────────── 1:1 chat ─────────────────────────────

function PeerChat({ peerId }: { peerId: number }) {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { typing, sendTyping, activePeer } = useRealtime();
  const [viewer, setViewer] = useState<string | null>(null);

  const { data: peer } = useQuery({ queryKey: ['user', peerId], queryFn: () => api<Profile>(`/users/${peerId}`) });
  const dialogs = qc.getQueryData<Dialog[]>(['dialogs']);
  const peerShort = dialogs?.find((d) => d.peer.id === peerId)?.peer ?? peer;
  const { data, isLoading } = useQuery({ queryKey: ['messages', peerId], queryFn: () => api<MessagesCache>(`/messages/${peerId}`) });
  const messages: AnyMessage[] = data?.items ?? [];

  useEffect(() => {
    activePeer.current = peerId;
    return () => {
      activePeer.current = null;
    };
  }, [peerId, activePeer]);

  const unreadIncoming = messages.some((m) => m.fromId === peerId && !(m as Message).isRead);
  useEffect(() => {
    const dialog = dialogs?.find((d) => d.peer.id === peerId);
    if (!unreadIncoming && !dialog?.unread) return;
    api(`/messages/${peerId}/read`, { method: 'POST' }).catch(() => {});
    qc.setQueryData<MessagesCache>(['messages', peerId], (old) =>
      old ? { ...old, items: old.items.map((m) => (m.fromId === peerId ? { ...m, isRead: true } : m)) } : old,
    );
    qc.setQueryData<Dialog[]>(['dialogs'], (old) => old?.map((d) => (d.peer.id === peerId ? { ...d, unread: 0 } : d)));
  }, [unreadIncoming, peerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async ({ text, file, audio }: { text: string; file: File | null; audio: Track | null }) => {
    const id = tempId--;
    const temp = { id, fromId: me.id, toId: peerId, text, image: null, audio, isRead: false, createdAt: Date.now(), pending: true } as Message & { pending: true };
    qc.setQueryData<MessagesCache>(['messages', peerId], (old) => ({ items: [...(old?.items ?? []), temp], hasMore: old?.hasMore ?? false }));
    try {
      const msg = await api<Message>(`/messages/${peerId}`, { body: form({ text, image: file, audioId: audio ? String(audio.id) : undefined }) });
      qc.setQueryData<MessagesCache>(['messages', peerId], (old) => {
        if (!old) return old;
        const items = old.items.filter((m) => m.id !== id);
        return { ...old, items: items.some((m) => m.id === msg.id) ? items : [...items, msg] };
      });
      if (!qc.getQueryData<Dialog[]>(['dialogs'])?.some((d) => d.peer.id === peerId)) qc.invalidateQueries({ queryKey: ['dialogs'] });
    } catch (e) {
      qc.setQueryData<MessagesCache>(['messages', peerId], (old) => (old ? { ...old, items: old.items.filter((m) => m.id !== id) } : old));
      alert((e as Error).message);
    }
  };

  const remove = async (m: AnyMessage) => {
    if (!confirm(tr('Удалить сообщение для всех?'))) return;
    await api(`/messages/item/${m.id}`, { method: 'DELETE' });
    qc.setQueryData<MessagesCache>(['messages', peerId], (old) => (old ? { ...old, items: old.items.filter((x) => x.id !== m.id) } : old));
    qc.invalidateQueries({ queryKey: ['dialogs'] });
  };

  const loadOlder = async (setPrev: (h: number) => void) => {
    const older = await api<MessagesCache>(`/messages/${peerId}?before=${messages[0].id}`);
    setPrev(document.querySelector('.im-messages')?.scrollHeight ?? 0);
    qc.setQueryData<MessagesCache>(['messages', peerId], (old) => (old ? { items: [...older.items, ...old.items], hasMore: older.hasMore } : old));
  };

  const peerTyping = isTyping(typing, peerId);

  return (
    <>
      <ChatShell
        loading={isLoading}
        hasMore={!!data?.hasMore}
        messages={messages}
        loadOlder={loadOlder}
        head={
          <>
            <button className="icon-btn mobile-only" onClick={() => navigate('/im')} aria-label={tr('Назад')}>
              <ArrowLeft size={22} />
            </button>
            {peerShort && (
              <>
                <Link to={`/id/${peerId}`}>
                  <Avatar src={peerShort.avatar} name={fullName(peerShort)} id={peerId} size={40} online={peerShort.online} />
                </Link>
                <div style={{ minWidth: 0 }}>
                  <Link to={`/id/${peerId}`} className="name ellipsis" style={{ display: 'block' }}>
                    {fullName(peerShort)}
                  </Link>
                  <div className={`meta${peerTyping ? ' typing' : ''}`}>
                    {peerTyping ? (
                      <>
                        {tr('печатает')}
                        <TypingDots />
                      </>
                    ) : (
                      lastSeenText(peerShort)
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        }
        renderRow={(m) => {
          const out = m.fromId === me.id;
          const read = (m as Message).isRead;
          return (
            <div className={`bubble-row${out ? ' out' : ''}${m.pending ? ' pending' : ''}`}>
              {out && m.id > 0 && (
                <button className="icon-btn msg-del" onClick={() => remove(m)} aria-label={tr('Удалить')}>
                  <Trash2 size={16} />
                </button>
              )}
              <div className="bubble">
                <MessageBody m={m} onImage={setViewer} />
                <span className="time">
                  {formatTime(m.createdAt)}
                  {out && (read ? <CheckCheck size={14} className="read" /> : <Check size={14} className="unread" />)}
                </span>
              </div>
            </div>
          );
        }}
        composer={<Composer onSend={send} onTyping={() => sendTyping({ peerId })} />}
      />
      {viewer && <PhotoViewer urls={[viewer]} index={0} onClose={() => setViewer(null)} />}
    </>
  );
}

// ───────────────────────────── group chat ─────────────────────────────

function ChatInfoModal({ chat, onClose }: { chat: Chat; onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState(chat.title);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const { data: friends } = useQuery({ queryKey: ['friends', me.id], queryFn: () => api<UserShort[]>(`/users/${me.id}/friends`), enabled: adding });
  const admin = chat.myRole === 'owner' || chat.myRole === 'admin';
  const members = chat.members ?? [];
  const memberIds = new Set(members.map((m) => m.id));

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ['chat', chat.id] });
      qc.invalidateQueries({ queryKey: ['chats'] });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal title={tr('Информация о беседе')} onClose={onClose}>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <ChatAvatar chat={chat} size={64} />
            {admin && (
              <button
                className="icon-btn"
                style={{ position: 'absolute', right: -6, bottom: -6, background: 'var(--card-strong)', boxShadow: 'var(--card-border)' }}
                aria-label={tr('Изменить фото беседы')}
                onClick={async () => {
                  const [f] = await pickFile();
                  if (f) run(() => api(`/chats/${chat.id}/avatar`, { body: form({ image: f }) }));
                }}
              >
                <Camera size={16} />
              </button>
            )}
          </div>
          {admin ? (
            <div style={{ display: 'flex', gap: 8, flex: 1 }}>
              <input className="field" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} aria-label={tr('Название беседы')} />
              <button className="btn secondary" disabled={!title.trim() || title === chat.title} onClick={() => run(() => api(`/chats/${chat.id}`, { method: 'PATCH', body: { title } }))}>
                <Pencil size={16} />
              </button>
            </div>
          ) : (
            <b style={{ fontSize: 16 }}>{chat.title}</b>
          )}
        </div>

        <div className="section-title" style={{ padding: 0, display: 'flex', alignItems: 'center' }}>
          {chat.membersCount} {plural(chat.membersCount, tr('участник|участника|участников'))}
          <button className="more-link" style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }} onClick={() => setAdding((a) => !a)}>
            <UserPlus size={14} style={{ verticalAlign: '-2px' }} /> {tr('Добавить')}
          </button>
        </div>

        {adding && (
          <div className="card" style={{ padding: 8 }}>
            <FriendChecklist users={friends ?? []} loading={!friends} picked={picked} setPicked={setPicked} disabled={memberIds} />
            <button
              className="btn block"
              style={{ marginTop: 8 }}
              disabled={!picked.size}
              onClick={() =>
                run(async () => {
                  await api(`/chats/${chat.id}/members`, { body: { userIds: [...picked] } });
                  setPicked(new Set());
                  setAdding(false);
                })
              }
            >
              {tr('Добавить')} {picked.size || ''}
            </button>
          </div>
        )}

        <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
          {members.map((m) => (
            <div key={m.id} className="row" style={{ padding: '6px 0', borderTop: 'none' }}>
              <Avatar src={m.avatar} name={fullName(m)} id={m.id} size={36} online={m.online} />
              <div className="info">
                <Link to={`/id/${m.id}`} className="name" onClick={onClose}>
                  {fullName(m)}
                </Link>
                <div className="meta">
                  {m.role === 'owner' ? (
                    <>
                      <Crown size={12} style={{ verticalAlign: '-1px' }} /> {tr('Создатель')}
                    </>
                  ) : m.role === 'admin' ? (
                    <>
                      <Shield size={12} style={{ verticalAlign: '-1px' }} /> {tr('Администратор')}
                    </>
                  ) : (
                    lastSeenText(m)
                  )}
                </div>
              </div>
              {chat.myRole === 'owner' && m.role !== 'owner' && (
                <button
                  className="icon-btn"
                  title={m.role === 'admin' ? tr('Снять администратора') : tr('Сделать администратором')}
                  aria-label={m.role === 'admin' ? tr('Снять администратора') : tr('Сделать администратором')}
                  onClick={() => run(() => api(`/chats/${chat.id}/members/${m.id}`, { method: 'PATCH', body: { role: m.role === 'admin' ? 'member' : 'admin' } }))}
                >
                  <Shield size={16} className={m.role === 'admin' ? 'on' : ''} />
                </button>
              )}
              {admin && m.id !== me.id && m.role !== 'owner' && (m.role !== 'admin' || chat.myRole === 'owner') && (
                <button
                  className="icon-btn"
                  title={tr('Исключить')}
                  aria-label={tr('Исключить из беседы')}
                  onClick={() => confirm(tr('Исключить {name}?', { name: fullName(m) })) && run(() => api(`/chats/${chat.id}/members/${m.id}`, { method: 'DELETE' }))}
                >
                  <UserMinus size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {error && <div className="error-text">{error}</div>}
        <button
          className="btn danger"
          onClick={async () => {
            if (!confirm(tr('Выйти из беседы?'))) return;
            await api(`/chats/${chat.id}/members/${me.id}`, { method: 'DELETE' });
            qc.invalidateQueries({ queryKey: ['chats'] });
            onClose();
            navigate('/im');
          }}
        >
          <LogOut size={16} /> {tr('Выйти из беседы')}
        </button>
      </div>
    </Modal>
  );
}

function GroupChat({ chatId }: { chatId: number }) {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { chatTyping, sendTyping, activeChat } = useRealtime();
  const [viewer, setViewer] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const { data: chat, error } = useQuery({ queryKey: ['chat', chatId], queryFn: () => api<Chat>(`/chats/${chatId}`) });
  const { data, isLoading } = useQuery({ queryKey: ['chat-messages', chatId], queryFn: () => api<ChatMessagesCache>(`/chats/${chatId}/messages`) });
  const messages: AnyMessage[] = data?.items ?? [];
  const lastId = messages[messages.length - 1]?.id ?? 0;

  useEffect(() => {
    activeChat.current = chatId;
    return () => {
      activeChat.current = null;
    };
  }, [chatId, activeChat]);

  // Mark as read whenever new messages arrive while the chat is open.
  const markRead = useCallback(() => {
    api(`/chats/${chatId}/read`, { method: 'POST' }).catch(() => {});
    qc.setQueryData<Chat[]>(['chats'], (old) => old?.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)));
  }, [chatId, qc]);
  useEffect(() => {
    if (lastId > 0) markRead();
  }, [lastId, markRead]);

  const send = async ({ text, file, audio }: { text: string; file: File | null; audio: Track | null }) => {
    const id = tempId--;
    const temp: AnyMessage = { id, chatId, fromId: me.id, author: me, kind: 'text', text, system: null, image: null, audio, spotify: null, createdAt: Date.now(), pending: true };
    qc.setQueryData<ChatMessagesCache>(['chat-messages', chatId], (old) => ({ items: [...(old?.items ?? []), temp as ChatMessage], hasMore: old?.hasMore ?? false }));
    try {
      const msg = await api<ChatMessage>(`/chats/${chatId}/messages`, { body: form({ text, image: file, audioId: audio ? String(audio.id) : undefined }) });
      qc.setQueryData<ChatMessagesCache>(['chat-messages', chatId], (old) => {
        if (!old) return old;
        const items = old.items.filter((m) => m.id !== id);
        return { ...old, items: items.some((m) => m.id === msg.id) ? items : [...items, msg] };
      });
    } catch (e) {
      qc.setQueryData<ChatMessagesCache>(['chat-messages', chatId], (old) => (old ? { ...old, items: old.items.filter((m) => m.id !== id) } : old));
      alert((e as Error).message);
    }
  };

  const remove = async (m: AnyMessage) => {
    if (!confirm(tr('Удалить сообщение для всех?'))) return;
    await api(`/chats/${chatId}/messages/${m.id}`, { method: 'DELETE' });
  };

  const loadOlder = async (setPrev: (h: number) => void) => {
    const older = await api<ChatMessagesCache>(`/chats/${chatId}/messages?before=${messages[0].id}`);
    setPrev(document.querySelector('.im-messages')?.scrollHeight ?? 0);
    qc.setQueryData<ChatMessagesCache>(['chat-messages', chatId], (old) => (old ? { items: [...older.items, ...old.items], hasMore: older.hasMore } : old));
  };

  if (error)
    return (
      <div className="im-chat">
        <div className="im-empty">{(error as Error).message}</div>
      </div>
    );

  const typers = Object.entries(chatTyping[chatId] ?? {})
    .filter(([, ts]) => Date.now() - ts < 5000)
    .map(([uid]) => chat?.members?.find((m) => m.id === Number(uid))?.firstName)
    .filter(Boolean);
  const admin = chat?.myRole === 'owner' || chat?.myRole === 'admin';

  return (
    <>
      <ChatShell
        loading={isLoading}
        hasMore={!!data?.hasMore}
        messages={messages}
        loadOlder={loadOlder}
        head={
          <>
            <button className="icon-btn mobile-only" onClick={() => navigate('/im')} aria-label={tr('Назад')}>
              <ArrowLeft size={22} />
            </button>
            {chat && (
              <>
                <button className="more-link" onClick={() => setInfo(true)} aria-label={tr('Информация о беседе')}>
                  <ChatAvatar chat={chat} size={40} />
                </button>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <button className="more-link name ellipsis" style={{ display: 'block', color: 'var(--name)', textAlign: 'left', maxWidth: '100%' }} onClick={() => setInfo(true)}>
                    {chat.title}
                  </button>
                  <div className={`meta${typers.length ? ' typing' : ''}`}>
                    {typers.length ? (
                      <>
                        {typers.join(', ')} {typers.length > 1 ? tr('печатают') : tr('печатает')}
                        <TypingDots />
                      </>
                    ) : (
                      `${chat.membersCount} ${plural(chat.membersCount, tr('участник|участника|участников'))}`
                    )}
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setInfo(true)} aria-label={tr('Информация о беседе')}>
                  <Info size={20} />
                </button>
              </>
            )}
          </>
        }
        renderRow={(m, i) => {
          if ((m as ChatMessage).kind === 'system') return <div className="system-msg">{systemText(m as ChatMessage)}</div>;
          const cm = m as ChatMessage;
          const out = cm.fromId === me.id;
          const prev = messages[i - 1] as ChatMessage | undefined;
          const firstOfRun = !prev || prev.fromId !== cm.fromId || prev.kind === 'system';
          const read = (chat?.readUpTo ?? 0) >= cm.id;
          return (
            <div className={`bubble-row${out ? ' out' : ''}${m.pending ? ' pending' : ''}${firstOfRun ? ' first' : ''}`}>
              {!out && (
                <span className="bubble-avatar">
                  {firstOfRun && cm.author && (
                    <Link to={`/id/${cm.author.id}`}>
                      <Avatar src={cm.author.avatar} name={fullName(cm.author)} id={cm.author.id} size={30} />
                    </Link>
                  )}
                </span>
              )}
              {(out || admin) && m.id > 0 && (
                <button className="icon-btn msg-del" onClick={() => remove(m)} aria-label={tr('Удалить')}>
                  <Trash2 size={16} />
                </button>
              )}
              <div className="bubble">
                {!out && firstOfRun && cm.author && <div className="bubble-author">{fullName(cm.author)}</div>}
                <MessageBody m={m} onImage={setViewer} />
                <span className="time">
                  {formatTime(m.createdAt)}
                  {out && (read ? <CheckCheck size={14} className="read" /> : <Check size={14} className="unread" />)}
                </span>
              </div>
            </div>
          );
        }}
        composer={<Composer onSend={send} onTyping={() => sendTyping({ chatId })} />}
      />
      {info && chat && <ChatInfoModal chat={chat} onClose={() => setInfo(false)} />}
      {viewer && <PhotoViewer urls={[viewer]} index={0} onClose={() => setViewer(null)} />}
    </>
  );
}

// ───────────────────────────── page ─────────────────────────────

export default function MessengerPage() {
  const { peerId, chatId } = useParams();
  const peer = Number(peerId) || null;
  const chat = Number(chatId) || null;
  const active = peer ? `u${peer}` : chat ? `c${chat}` : null;
  return (
    <div className={`card im${active ? ' has-chat' : ''}`}>
      <ConversationList active={active} />
      {peer ? (
        <PeerChat key={`u${peer}`} peerId={peer} />
      ) : chat ? (
        <GroupChat key={`c${chat}`} chatId={chat} />
      ) : (
        <div className="im-chat">
          <div className="im-empty">
            <div>
              <MessageCircle size={56} color="var(--icon)" />
              <div style={{ marginTop: 8 }}>{tr('Выберите чат или начните новую беседу')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
