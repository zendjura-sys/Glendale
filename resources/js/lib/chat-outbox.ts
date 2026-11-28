import type { ChatMessage, OutgoingMessage } from '@/types/messenger';

/**
 * Черга невідправлених повідомлень чату в браузері: текст, стікер, контакт (файли й голосові
 * не зберігаємо — вони завеликі для сховища). Переживає перезавантаження сторінки:
 * щойно мережа повернеться, повідомлення підуть самі.
 */
export type OutboxItem = {
    localId: string;
    message: OutgoingMessage;
    replyTo: number | null;
    createdAt: string;
};

const key = (conversationId: number) => `gc.outbox.${conversationId}`;

export function storable(message: OutgoingMessage): boolean {
    if (message.kind === 'sticker' || message.kind === 'contact') return true;

    return (
        message.kind === 'text' &&
        message.images.length === 0 &&
        message.files.length === 0 &&
        !message.publishAt
    );
}

export function readOutbox(conversationId: number): OutboxItem[] {
    try {
        const raw = window.localStorage.getItem(key(conversationId));
        const list = raw ? (JSON.parse(raw) as OutboxItem[]) : [];

        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function write(conversationId: number, list: OutboxItem[]) {
    try {
        if (list.length === 0)
            window.localStorage.removeItem(key(conversationId));
        else
            window.localStorage.setItem(
                key(conversationId),
                JSON.stringify(list.slice(-50)),
            );
    } catch {
        // Без сховища черга живе лише до перезавантаження.
    }
}

export function addToOutbox(conversationId: number, item: OutboxItem) {
    if (!storable(item.message)) return;
    // Файли не серіалізуються — для тексту зберігаємо порожні списки.
    const message =
        item.message.kind === 'text'
            ? { ...item.message, images: [], files: [] }
            : item.message;
    write(conversationId, [
        ...readOutbox(conversationId).filter((i) => i.localId !== item.localId),
        { ...item, message },
    ]);
}

export function removeFromOutbox(conversationId: number, localId: string) {
    write(
        conversationId,
        readOutbox(conversationId).filter((i) => i.localId !== localId),
    );
}

/** Повідомлення з черги для показу в стрічці чату (поки не надіслано). */
export function outboxMessage(
    item: OutboxItem,
    conversationId: number,
    me: ChatMessage['user'],
): ChatMessage {
    const m = item.message;

    return {
        id: Number.MAX_SAFE_INTEGER - Math.floor(Math.random() * 100000),
        local_id: item.localId,
        pending: 'queued',
        conversation_id: conversationId,
        type: m.kind === 'text' ? 'text' : m.kind,
        body: m.kind === 'text' ? m.body || null : null,
        user: me,
        sticker: m.kind === 'sticker' ? m.sticker : null,
        contact: m.kind === 'contact' ? m.contact : null,
        reply_to: null,
        attachments: [],
        edited_at: null,
        created_at: item.createdAt,
    } as ChatMessage;
}
