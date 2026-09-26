import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CheckCheck, Image as ImageIcon, MessageCircle, Search, Trash2, X } from 'lucide-react';
import { api, form } from '../lib/api';
import { useMe } from '../lib/auth';
import { isTyping, useRealtime, type MessagesCache } from '../lib/realtime';
import type { Dialog, Message, Profile } from '../lib/types';
import { formatDay, formatShort, formatTime, fullName, lastSeenText } from '../lib/utils';
import { AutoTextarea, Avatar, Empty, PhotoViewer, Spinner, pickFile } from '../components/ui';
import { SendButton, TypingDots } from '../components/uiverse';

function DialogList({ activeId }: { activeId: number | null }) {
  const me = useMe();
  const { typing } = useRealtime();
  const [filter, setFilter] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['dialogs'], queryFn: () => api<Dialog[]>('/dialogs') });
  const needle = filter.trim().toLowerCase();
  const list = (data ?? []).filter((d) => !needle || fullName(d.peer).toLowerCase().includes(needle));

  return (
    <div className="im-list">
      <div className="im-list-head" style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 24, top: 22, color: 'var(--icon)' }} />
        <input className="field" style={{ paddingLeft: 36 }} placeholder="Поиск" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div className="im-list-scroll">
        {isLoading && <Spinner />}
        {!isLoading && !list.length && (
          <Empty icon={<MessageCircle size={40} />} title="Нет сообщений">
            Начните диалог со страницы друга
          </Empty>
        )}
        {list.map((d) => {
          const m = d.lastMessage;
          const mine = m.fromId === me.id;
          return (
            <Link key={d.peer.id} to={`/im/${d.peer.id}`} className={`dialog${activeId === d.peer.id ? ' active' : ''}`}>
              <Avatar src={d.peer.avatar} name={fullName(d.peer)} id={d.peer.id} size={48} online={d.peer.online} />
              <div className="body">
                <div className="top">
                  <span className="name ellipsis">{fullName(d.peer)}</span>
                  <span className="meta">{formatShort(m.createdAt)}</span>
                </div>
                <div className="preview">
                  {isTyping(typing, d.peer.id) ? (
                    <span className="text typing ellipsis">
                      печатает<TypingDots />
                    </span>
                  ) : (
                    <span className="text ellipsis">
                      {mine && <span style={{ color: 'var(--text-2)' }}>Вы: </span>}
                      <span style={{ color: mine ? 'var(--text-2)' : 'var(--text)' }}>
                        {m.text || (
                          <>
                            <ImageIcon size={14} style={{ verticalAlign: '-2px' }} /> Фотография
                          </>
                        )}
                      </span>
                    </span>
                  )}
                  {d.unread > 0 && <span className="badge">{d.unread}</span>}
                  {mine && !m.isRead && <span className="unread-dot" title="Не прочитано" />}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

let tempId = -1;

function Chat({ peerId }: { peerId: number }) {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { typing, sendTyping, activePeer } = useRealtime();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevHeight = useRef<number | null>(null);

  const { data: peer } = useQuery({ queryKey: ['user', peerId], queryFn: () => api<Profile>(`/users/${peerId}`) });
  const dialogs = qc.getQueryData<Dialog[]>(['dialogs']);
  const peerShort = dialogs?.find((d) => d.peer.id === peerId)?.peer ?? peer;

  const { data, isLoading } = useQuery({
    queryKey: ['messages', peerId],
    queryFn: () => api<MessagesCache>(`/messages/${peerId}`),
  });
  const messages = data?.items ?? [];

  // Mark as read whenever there are unread incoming messages in view.
  const unreadIncoming = messages.some((m) => m.fromId === peerId && !m.isRead);
  useEffect(() => {
    activePeer.current = peerId;
    return () => {
      activePeer.current = null;
    };
  }, [peerId, activePeer]);
  useEffect(() => {
    const dialog = dialogs?.find((d) => d.peer.id === peerId);
    if (!unreadIncoming && !dialog?.unread) return;
    api(`/messages/${peerId}/read`, { method: 'POST' }).catch(() => {});
    qc.setQueryData<MessagesCache>(['messages', peerId], (old) =>
      old ? { ...old, items: old.items.map((m) => (m.fromId === peerId ? { ...m, isRead: true } : m)) } : old,
    );
    qc.setQueryData<Dialog[]>(['dialogs'], (old) => old?.map((d) => (d.peer.id === peerId ? { ...d, unread: 0 } : d)));
  }, [unreadIncoming, peerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current != null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, isLoading]);

  useEffect(() => {
    stickToBottom.current = true;
    setText('');
    setFile(null);
  }, [peerId]);

  const loadOlder = async () => {
    if (!data?.hasMore || loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    try {
      const older = await api<MessagesCache>(`/messages/${peerId}?before=${messages[0].id}`);
      prevHeight.current = scroller.current?.scrollHeight ?? null;
      qc.setQueryData<MessagesCache>(['messages', peerId], (old) =>
        old ? { items: [...older.items, ...old.items], hasMore: older.hasMore } : old,
      );
    } finally {
      setLoadingOlder(false);
    }
  };

  const onScroll = () => {
    const el = scroller.current!;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 200) loadOlder();
  };

  const send = async () => {
    const value = text.trim();
    if (!value && !file) return;
    const id = tempId--;
    const temp: Message = { id, fromId: me.id, toId: peerId, text: value, image: null, isRead: false, createdAt: Date.now() };
    stickToBottom.current = true;
    qc.setQueryData<MessagesCache>(['messages', peerId], (old) => ({ items: [...(old?.items ?? []), temp], hasMore: old?.hasMore ?? false }));
    setText('');
    const attached = file;
    setFile(null);
    try {
      const msg = await api<Message>(`/messages/${peerId}`, { body: form({ text: value, image: attached }) });
      qc.setQueryData<MessagesCache>(['messages', peerId], (old) => {
        if (!old) return old;
        const items = old.items.filter((m) => m.id !== id);
        return { ...old, items: items.some((m) => m.id === msg.id) ? items : [...items, msg] };
      });
      if (!qc.getQueryData<Dialog[]>(['dialogs'])?.some((d) => d.peer.id === peerId)) qc.invalidateQueries({ queryKey: ['dialogs'] });
    } catch (e) {
      qc.setQueryData<MessagesCache>(['messages', peerId], (old) => (old ? { ...old, items: old.items.filter((m) => m.id !== id) } : old));
      setText(value);
      alert((e as Error).message);
    }
  };

  const remove = async (m: Message) => {
    if (!confirm('Удалить сообщение для всех?')) return;
    await api(`/messages/item/${m.id}`, { method: 'DELETE' });
    qc.setQueryData<MessagesCache>(['messages', peerId], (old) => (old ? { ...old, items: old.items.filter((x) => x.id !== m.id) } : old));
    qc.invalidateQueries({ queryKey: ['dialogs'] });
  };

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const peerTyping = isTyping(typing, peerId);

  return (
    <div className="im-chat">
      <div className="im-chat-head">
        <button className="icon-btn mobile-only" onClick={() => navigate('/im')} aria-label="Назад">
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
                    печатает<TypingDots />
                  </>
                ) : (
                  lastSeenText(peerShort)
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="im-messages" ref={scroller} onScroll={onScroll}>
        {(isLoading || loadingOlder) && <Spinner />}
        {!isLoading && !messages.length && (
          <div className="im-empty">
            <div>
              <MessageCircle size={48} color="var(--icon)" />
              <div style={{ marginTop: 8 }}>Здесь будет выводиться история переписки</div>
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const out = m.fromId === me.id;
          const newDay = i === 0 || formatDay(messages[i - 1].createdAt) !== formatDay(m.createdAt);
          return (
            <Fragment key={m.id}>
              {newDay && <div className="day-sep">{formatDay(m.createdAt)}</div>}
              <div className={`bubble-row${out ? ' out' : ''}${m.id < 0 ? ' pending' : ''}`}>
                {out && m.id > 0 && (
                  <button className="icon-btn msg-del" onClick={() => remove(m)} aria-label="Удалить">
                    <Trash2 size={16} />
                  </button>
                )}
                <div className="bubble">
                  {m.image && <img src={m.image} alt="" onClick={() => setViewer(m.image)} />}
                  {m.text}
                  <span className="time">
                    {formatTime(m.createdAt)}
                    {out &&
                      (m.isRead ? <CheckCheck size={14} className="read" /> : <Check size={14} className="unread" />)}
                  </span>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {preview && (
        <div className="attach-preview" style={{ margin: '8px 12px 0', background: 'var(--card-solid)' }}>
          <img src={preview} alt="" />
          <button onClick={() => setFile(null)} aria-label="Убрать фото">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="im-input">
        <button
          className="icon-btn"
          aria-label="Прикрепить фото"
          onClick={async () => {
            const [f] = await pickFile();
            if (f) setFile(f);
          }}
        >
          <ImageIcon size={22} />
        </button>
        <AutoTextarea
          className="autogrow"
          placeholder="Напишите сообщение..."
          value={text}
          maxLength={4000}
          autoFocus
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) sendTyping(peerId);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <SendButton onClick={send} disabled={!text.trim() && !file} />
      </div>
      {viewer && <PhotoViewer urls={[viewer]} index={0} onClose={() => setViewer(null)} />}
    </div>
  );
}

export default function MessengerPage() {
  const { peerId } = useParams();
  const id = Number(peerId) || null;
  return (
    <div className={`card im${id ? ' has-chat' : ''}`}>
      <DialogList activeId={id} />
      {id ? (
        <Chat key={id} peerId={id} />
      ) : (
        <div className="im-chat">
          <div className="im-empty">
            <div>
              <MessageCircle size={56} color="var(--icon)" />
              <div style={{ marginTop: 8 }}>Выберите чат или начните новую беседу</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
