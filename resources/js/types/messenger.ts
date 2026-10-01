import type { UserCard } from './social';

export type ConversationType = 'direct' | 'group';
export type MemberRole = 'owner' | 'admin' | 'member';

export type ChatAttachment = {
    id: number;
    url: string;
    width: number | null;
    height: number | null;
};

export type ChatMessage = {
    id: number;
    conversation_id: number;
    type: 'text' | 'system';
    body: string | null;
    user: UserCard | null;
    reply_to: {
        id: number;
        body: string | null;
        author: string | null;
        has_attachments: boolean;
        deleted: boolean;
    } | null;
    attachments: ChatAttachment[];
    edited_at: string | null;
    created_at: string;
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
    last_message: {
        id: number;
        type: 'text' | 'system';
        body: string | null;
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
    my_role: MemberRole;
    read_up_to: number;
    members: ConversationMember[];
    members_count: number;
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
