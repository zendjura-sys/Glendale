import type { CallState } from '@/lib/voice';
import type { UserCard } from './social';

export type ConversationType = 'direct' | 'group';
export type MemberRole = 'owner' | 'admin' | 'member';

export type MessageType =
    | 'text'
    | 'system'
    | 'sticker'
    | 'voice'
    | 'contact'
    | 'video_note';

export type ChatAttachment = {
    id: number;
    type: 'image' | 'file' | 'voice' | 'video_note';
    url: string;
    width: number | null;
    height: number | null;
    name?: string | null;
    mime?: string | null;
    size?: number | null;
    duration?: number | null;
    waveform?: number[] | null;
};

export type StickerItem = {
    id: number;
    url: string;
    emoji: string | null;
};

export type StickerPackItem = {
    id: number;
    slug: string;
    name: string;
    /** Набір GameCon+ */
    is_plus?: boolean;
    /** Без підписки — видно, але надіслати не можна */
    locked?: boolean;
    stickers: StickerItem[];
};

export type ContactCard = UserCard & { is_friend?: boolean };

export type OutgoingMessage =
    | {
          kind: 'text';
          body: string;
          images: File[];
          files: File[];
          publishAt?: string | null;
          vanish?: boolean;
          card?: {
              kind: string;
              id: number;
              title: string;
              hint: string;
              href: string;
              image: string | null;
          } | null;
      }
    | { kind: 'sticker'; sticker: StickerItem }
    | { kind: 'voice'; blob: Blob; duration: number; waveform: number[] }
    | { kind: 'video_note'; blob: Blob; duration: number }
    | { kind: 'contact'; contact: ContactCard };

/** Реакції під повідомленням: user_ids — щоб позначити свою. */
export type MessageReaction = {
    emoji: string;
    count: number;
    user_ids: number[];
};

export type ChatMessage = {
    id: number;
    conversation_id: number;
    type: MessageType;
    body: string | null;
    preview?: string;
    user: UserCard | null;
    sticker?: StickerItem | null;
    contact?: ContactCard | null;
    reply_to: {
        id: number;
        body: string | null;
        preview?: string | null;
        author: string | null;
        has_attachments: boolean;
        deleted: boolean;
    } | null;
    attachments: ChatAttachment[];
    edited_at: string | null;
    publish_at?: string | null;
    expires_at?: string | null;
    created_at: string;
    starred?: boolean;
    reactions?: MessageReaction[];
    forward?: { name: string; username: string | null } | null;
    card?: {
        kind: string;
        id: number;
        title: string;
        hint: string;
        href: string;
        image: string | null;
    } | null;
    /** Локальний стан оптимістичної відправки. */
    pending?: 'sending' | 'failed';
    local_id?: string;
};

export type ConversationSummary = {
    id: number;
    type: ConversationType;
    title: string;
    avatar_url: string | null;
    peer: UserCard | null;
    members_count: number;
    unread: number;
    is_muted: boolean;
    pinned?: boolean;
    folder?: string | null;
    last_message: {
        id: number;
        type: MessageType;
        body: string | null;
        preview?: string;
        author: string | null;
        is_own: boolean;
        has_attachments: boolean;
        created_at: string;
    } | null;
};

export type ConversationMember = UserCard & { role: MemberRole };

export type ConversationDetails = {
    id: number;
    type: ConversationType;
    title: string;
    avatar_url: string | null;
    peer:
        | (UserCard & { last_seen_at: string | null; gender: string | null })
        | null;
    can_write: boolean;
    is_muted: boolean;
    share_receipts?: boolean;
    slow_seconds?: number;
    automod?: {
        links: boolean;
        caps: boolean;
        flood: boolean;
        words: string[];
    } | null;
    pinned?: boolean;
    folder?: string | null;
    my_role: MemberRole;
    read_up_to: number;
    members: ConversationMember[];
    members_count: number;
    /** Дзвінок, що триває в бесіді, і чи можна дзвонити. */
    call?: CallState | null;
    can_call?: boolean;
    calls_enabled?: boolean;
    /** «Поки тебе не було»: зведена непрочитаного в групі. */
    catch_up?: CatchUp | null;
};

export type ChatHistory = {
    messages: ChatMessage[];
    has_more: boolean;
};

export type InboxEvent = {
    conversation_id: number;
    message: ChatMessage | null;
    is_muted: boolean;
    unread_total: number;
};

export type CatchUpItem = {
    id: number;
    author: string | null;
    text: string | null;
    link: string | null;
    reactions: number;
    created_at: string;
};

export type CatchUp = {
    count: number;
    people: number;
    first_id: number;
    sections: {
        key: 'mentions' | 'plans' | 'popular' | 'links';
        items: CatchUpItem[];
    }[];
};
