import { useSyncExternalStore } from 'react';
import type { InboxEvent } from '@/types/messenger';

let unread = 0;
let activeConversation: number | null = null;
const counterListeners = new Set<() => void>();
const eventListeners = new Set<(event: InboxEvent) => void>();

export const inbox = {
    setUnread(value: number) {
        if (value === unread) return;
        unread = value;
        counterListeners.forEach((listener) => listener());
    },
    setActive(id: number | null) {
        activeConversation = id;
    },
    active: () => activeConversation,
    emit(event: InboxEvent) {
        eventListeners.forEach((listener) => listener(event));
    },
    subscribe(listener: (event: InboxEvent) => void) {
        eventListeners.add(listener);

        return () => {
            eventListeners.delete(listener);
        };
    },
};

function subscribeCounter(listener: () => void) {
    counterListeners.add(listener);

    return () => {
        counterListeners.delete(listener);
    };
}

export function useUnreadMessages(): number {
    return useSyncExternalStore(
        subscribeCounter,
        () => unread,
        () => unread,
    );
}
