import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getToken } from './api';
import { useAuth } from './auth';
import type { Counters, Dialog, Message, Notification, UserShort } from './types';

type Event =
  | { type: 'message'; payload: { message: Message; peer: UserShort } }
  | { type: 'read'; payload: { peerId: number } }
  | { type: 'message_deleted'; payload: { id: number; peerId: number } }
  | { type: 'typing'; payload: { userId: number } }
  | { type: 'counters'; payload: Counters }
  | { type: 'notification'; payload: Notification }
  | { type: 'presence'; payload: { userId: number; online: boolean; lastSeen: number } };

export interface Toast {
  id: number;
  user: UserShort;
  title: string;
  text: string;
  link: string;
}

interface RealtimeState {
  counters: Counters;
  setCounters: (c: Counters) => void;
  typing: Record<number, number>;
  sendTyping: (peerId: number) => void;
  activePeer: React.MutableRefObject<number | null>;
  toasts: Toast[];
  dismissToast: (id: number) => void;
}

const RealtimeContext = createContext<RealtimeState>(null!);

export type MessagesCache = { items: Message[]; hasMore: boolean };

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [counters, setCounters] = useState<Counters>({ messages: 0, friends: 0, notifications: 0 });
  const [typing, setTyping] = useState<Record<number, number>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const activePeer = useRef<number | null>(null);

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 5000);
  }, []);

  useEffect(() => {
    if (!user) return;
    api<Counters>('/counters').then(setCounters).catch(() => {});

    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;

    const handle = (ev: Event) => {
      switch (ev.type) {
        case 'counters':
          setCounters(ev.payload);
          break;
        case 'message': {
          const { message, peer } = ev.payload;
          const peerId = message.fromId === user.id ? message.toId : message.fromId;
          qc.setQueryData<MessagesCache>(['messages', peerId], (old) =>
            old && !old.items.some((m) => m.id === message.id) ? { ...old, items: [...old.items, message] } : old,
          );
          qc.setQueryData<Dialog[]>(['dialogs'], (old) => {
            if (!old) return old;
            const prev = old.find((d) => d.peer.id === peerId);
            const incoming = message.fromId !== user.id && activePeer.current !== peerId;
            const updated: Dialog = { peer, lastMessage: message, unread: (prev?.unread ?? 0) + (incoming ? 1 : 0) };
            return [updated, ...old.filter((d) => d.peer.id !== peerId)];
          });
          setTyping((t) => {
            const { [peerId]: _, ...rest } = t;
            return rest;
          });
          if (message.fromId !== user.id && activePeer.current !== peerId) {
            pushToast({
              user: peer,
              title: `${peer.firstName} ${peer.lastName}`,
              text: message.text || 'Фотография',
              link: `/im/${peer.id}`,
            });
          }
          break;
        }
        case 'read':
          qc.setQueryData<MessagesCache>(['messages', ev.payload.peerId], (old) =>
            old ? { ...old, items: old.items.map((m) => (m.toId === ev.payload.peerId ? { ...m, isRead: true } : m)) } : old,
          );
          qc.setQueryData<Dialog[]>(['dialogs'], (old) =>
            old?.map((d) =>
              d.peer.id === ev.payload.peerId ? { ...d, lastMessage: { ...d.lastMessage, isRead: true } } : d,
            ),
          );
          break;
        case 'message_deleted':
          qc.setQueryData<MessagesCache>(['messages', ev.payload.peerId], (old) =>
            old ? { ...old, items: old.items.filter((m) => m.id !== ev.payload.id) } : old,
          );
          qc.invalidateQueries({ queryKey: ['dialogs'] });
          break;
        case 'typing':
          setTyping((t) => ({ ...t, [ev.payload.userId]: Date.now() }));
          break;
        case 'notification': {
          qc.invalidateQueries({ queryKey: ['notifications'] });
          const n = ev.payload;
          if (n.type === 'friend_request' || n.type === 'friend_accept') qc.invalidateQueries({ queryKey: ['friends'] });
          pushToast({
            user: n.actor,
            title: `${n.actor.firstName} ${n.actor.lastName}`,
            text: NOTIFICATION_TEXT[n.type],
            link: n.post ? `/wall/${n.post.id}` : `/id/${n.actor.id}`,
          });
          break;
        }
        case 'presence':
          qc.setQueryData<Dialog[]>(['dialogs'], (old) =>
            old?.map((d) =>
              d.peer.id === ev.payload.userId ? { ...d, peer: { ...d.peer, online: ev.payload.online, lastSeen: ev.payload.lastSeen } } : d,
            ),
          );
          qc.setQueryData<UserShort>(['user-short', ev.payload.userId], (old) =>
            old ? { ...old, online: ev.payload.online, lastSeen: ev.payload.lastSeen } : old,
          );
          break;
      }
    };

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(getToken() ?? '')}`);
      wsRef.current = ws;
      ws.onopen = () => {
        if (retry > 0) {
          // Catch up on anything missed while disconnected.
          qc.invalidateQueries({ queryKey: ['dialogs'] });
          qc.invalidateQueries({ queryKey: ['messages'] });
          api<Counters>('/counters').then(setCounters).catch(() => {});
        }
        retry = 0;
      };
      ws.onmessage = (e) => {
        try {
          handle(JSON.parse(e.data));
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (closed) return;
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
      };
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [user?.id, qc, pushToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastTypingSent = useRef(0);
  const sendTyping = useCallback((peerId: number) => {
    if (Date.now() - lastTypingSent.current < 3000) return;
    lastTypingSent.current = Date.now();
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'typing', peerId }));
  }, []);

  // Typing indicators expire after 5s.
  useEffect(() => {
    const id = setInterval(() => {
      setTyping((t) => {
        const fresh = Object.entries(t).filter(([, ts]) => Date.now() - ts < 5000);
        return fresh.length === Object.keys(t).length ? t : Object.fromEntries(fresh);
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((l) => l.filter((t) => t.id !== id)), []);

  return (
    <RealtimeContext.Provider value={{ counters, setCounters, typing, sendTyping, activePeer, toasts, dismissToast }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export const NOTIFICATION_TEXT: Record<Notification['type'], string> = {
  like: 'оценил(а) вашу запись',
  comment: 'прокомментировал(а) вашу запись',
  repost: 'поделился(ась) вашей записью',
  wall_post: 'написал(а) на вашей стене',
  friend_request: 'хочет добавить вас в друзья',
  friend_accept: 'принял(а) вашу заявку в друзья',
};

export const useRealtime = () => useContext(RealtimeContext);

export const isTyping = (typing: Record<number, number>, userId: number) => Date.now() - (typing[userId] ?? 0) < 5000;
