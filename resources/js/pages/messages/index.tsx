import { Head, router, usePage } from '@inertiajs/react';
import { MessagesSquare, PenSquare } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatView } from '@/components/messenger/chat-view';
import { ConversationList } from '@/components/messenger/conversation-list';
import { GroupInfoDialog } from '@/components/messenger/group-info-dialog';
import { NewChatDialog } from '@/components/messenger/new-chat-dialog';
import { inbox } from '@/lib/inbox';
import { usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';
import type {
    ChatHistory,
    ConversationDetails,
    ConversationSummary,
} from '@/types';
import { tr } from '@/lib/i18n';

type Props = {
    conversations: ConversationSummary[];
    active: ConversationDetails | null;
    history: ChatHistory | null;
    draft?: string | null;
};

export default function Messages({
    conversations,
    active,
    history,
    draft = null,
}: Props) {
    const userId = usePage().props.auth.user.id;
    const playing = usePlayer().current !== null;
    const [list, setList] = useState(conversations);
    const [composeOpen, setComposeOpen] = useState(false);
    const [infoOpen, setInfoOpen] = useState(false);
    const [typingName, setTypingName] = useState<string | null>(null);
    const activeId = active?.id ?? null;

    const [source, setSource] = useState(conversations);
    const listRef = useRef(list);

    if (source !== conversations) {
        setSource(conversations);
        setList(conversations);
    }

    useEffect(() => {
        listRef.current = list;
    }, [list]);

    useEffect(
        () =>
            inbox.subscribe((event) => {
                if (
                    !listRef.current.some((c) => c.id === event.conversation_id)
                ) {
                    if (event.message) {
                        router.reload({ only: ['conversations'] });
                    }

                    return;
                }

                setList((current) => {
                    const item = current.find(
                        (c) => c.id === event.conversation_id,
                    );

                    if (!item) return current;
                    const message = event.message;

                    if (!message) {
                        return current.map((c) =>
                            c.id === item.id ? { ...c, unread: 0 } : c,
                        );
                    }

                    const isOwn = message.user?.id === userId;
                    const isOpen =
                        inbox.active() === item.id &&
                        document.visibilityState === 'visible';

                    return [
                        {
                            ...item,
                            unread:
                                isOwn || isOpen
                                    ? 0
                                    : message.type !== 'system'
                                      ? item.unread + 1
                                      : item.unread,
                            last_message: {
                                id: message.id,
                                type: message.type,
                                body: message.body,
                                preview: message.preview,
                                author: message.user?.first_name ?? null,
                                is_own: isOwn,
                                has_attachments: message.attachments.length > 0,
                                created_at: message.created_at,
                            },
                        },
                        ...current.filter((c) => c.id !== item.id),
                    ];
                });
            }),
        [userId],
    );

    const onRead = useCallback((id: number) => {
        setList((current) =>
            current.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
        );
    }, []);

    return (
        <>
            <Head title={active ? active.title : tr('Повідомлення')} />
            <div
                className={cn(
                    'glass flex min-h-0 overflow-clip rounded-2xl max-lg:h-[calc(100dvh-76px)] max-lg:rounded-b-none md:flex-row lg:h-[calc(100dvh-100px)]',
                    playing ? 'max-lg:-mb-44' : 'max-lg:-mb-24',
                )}
            >
                <ConversationList
                    conversations={list}
                    activeId={activeId}
                    typing={
                        activeId && typingName ? { [activeId]: typingName } : {}
                    }
                    onCompose={() => setComposeOpen(true)}
                    className={cn(
                        'w-full border-white/[0.06] md:w-[300px] md:border-r xl:w-[340px]',
                        active && 'hidden md:flex',
                    )}
                />

                {active && history ? (
                    <ChatView
                        key={active.id}
                        active={active}
                        history={history}
                        conversations={list}
                        draft={draft}
                        onRead={onRead}
                        onOpenInfo={() => setInfoOpen(true)}
                        onTypingChange={setTypingName}
                    />
                ) : (
                    <div className="hidden flex-1 flex-col items-center justify-center px-8 text-center md:flex">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 animate-pulse rounded-full bg-gc-indigo/40 blur-3xl" />
                            <div className="gradient-border relative flex size-24 items-center justify-center rounded-2xl bg-[#0b1020]/70">
                                <MessagesSquare className="size-11 text-[#9fb0ff] drop-shadow-[0_0_14px_rgb(124_140_255/0.9)]" />
                            </div>
                        </div>
                        <h2 className="font-display text-xl font-semibold text-white">
                            {tr('Оберіть бесіду')}
                        </h2>
                        <p className="mt-2 max-w-sm text-sm text-white/45">
                            {tr(
                                'Спілкуйтеся з друзями в реальному часі: фото, відповіді, групові чати до 200 учасників.',
                            )}
                        </p>
                        <button
                            type="button"
                            onClick={() => setComposeOpen(true)}
                            className="btn-glow mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
                        >
                            <PenSquare className="size-4" />
                            {tr('Нове повідомлення')}
                        </button>
                    </div>
                )}
            </div>

            <NewChatDialog open={composeOpen} onOpenChange={setComposeOpen} />
            {active?.type === 'group' && (
                <GroupInfoDialog
                    key={active.id}
                    open={infoOpen}
                    onOpenChange={setInfoOpen}
                    conversation={active}
                />
            )}
        </>
    );
}
