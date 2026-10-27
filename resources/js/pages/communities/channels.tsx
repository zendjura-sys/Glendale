import { Head, Link } from '@inertiajs/react';
import { Hash, LayoutList, Lock, Megaphone, UsersRound } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ChannelDialog } from '@/components/communities/channel-dialog';
import type { ChannelCard } from '@/components/communities/channel-dialog';
import { ChannelSidebar } from '@/components/communities/channel-sidebar';
import type { ChannelTree } from '@/components/communities/channel-sidebar';
import { VoiceChannel } from '@/components/communities/voice-channel';
import { ChatView } from '@/components/messenger/chat-view';
import { tr } from '@/lib/i18n';
import { usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';
import type { ChatHistory, ConversationDetails } from '@/types';

type Props = {
    community: {
        id: number;
        slug: string;
        name: string;
        avatar_url: string | null;
        cover_url?: string | null;
        members_count: number;
    };
    joined: boolean;
    can_manage: boolean;
    tree: ChannelTree;
    channel: ChannelCard | null;
    active: ConversationDetails | null;
    history: ChatHistory | null;
};

/**
 * Канали спільноти (як у Discord): ліворуч категорії й канали, праворуч — текстовий канал
 * (той самий чат, що й у «Повідомленнях»), «Оголошення» чи голосовий канал.
 */
export default function CommunityChannels({
    community,
    joined,
    can_manage,
    tree,
    channel,
    active,
    history,
}: Props) {
    const playing = usePlayer().current !== null;
    const [dialog, setDialog] = useState<{
        channel: ChannelCard | null;
        category: number | null;
    } | null>(null);
    // На телефоні: список каналів або сам канал.
    const [listOpen, setListOpen] = useState(channel === null);
    const [shownId, setShownId] = useState(channel?.id ?? null);
    if ((channel?.id ?? null) !== shownId) {
        setShownId(channel?.id ?? null);
        setListOpen(channel === null);
    }
    const onRead = useCallback(() => undefined, []);
    const categories = tree.categories.map((c) => ({ id: c.id, name: c.name }));
    const TypeIcon =
        channel?.type === 'announcement'
            ? Megaphone
            : channel?.is_private
              ? Lock
              : Hash;

    return (
        <>
            <Head
                title={
                    channel
                        ? `${channel.name} · ${community.name}`
                        : community.name
                }
            />
            <div
                className={cn(
                    'flex min-h-0 gap-4 max-lg:h-[calc(100dvh-76px)] lg:h-[calc(100dvh-100px)]',
                    playing ? 'max-lg:-mb-44' : 'max-lg:-mb-24',
                )}
            >
                <ChannelSidebar
                    community={community}
                    tree={tree}
                    activeId={channel?.id ?? null}
                    canManage={can_manage}
                    onCreate={(category) =>
                        setDialog({ channel: null, category })
                    }
                    onEdit={(item) =>
                        setDialog({ channel: item, category: null })
                    }
                    className={cn(
                        'w-full md:w-[260px] md:shrink-0',
                        !listOpen && 'max-md:hidden',
                    )}
                />

                <div
                    className={cn(
                        'glass flex min-h-0 min-w-0 flex-1 flex-col overflow-clip rounded-2xl',
                        listOpen && 'max-md:hidden',
                    )}
                >
                    {!(active && history && channel?.type !== 'voice') && (
                        <button
                            type="button"
                            onClick={() => setListOpen(true)}
                            className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2 text-sm text-white/70 md:hidden"
                        >
                            <LayoutList className="size-4" />
                            {tr('Канали')}
                        </button>
                    )}

                    {!joined ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                            <UsersRound className="size-10 text-white/30" />
                            <p className="max-w-sm text-sm text-white/55">
                                {tr(
                                    'Канали бачать учасники спільноти. Вступіть, щоб читати й писати.',
                                )}
                            </p>
                            <Link
                                href={`/c/${community.slug}`}
                                className="btn-glow inline-flex h-10 items-center rounded-xl px-5 text-sm font-semibold"
                            >
                                {tr('До спільноти')}
                            </Link>
                        </div>
                    ) : channel?.type === 'voice' ? (
                        <VoiceChannel channel={channel} community={community} />
                    ) : active && history ? (
                        <ChatView
                            key={active.id}
                            active={active}
                            history={history}
                            conversations={[]}
                            onRead={onRead}
                            onOpenInfo={() =>
                                channel &&
                                can_manage &&
                                setDialog({ channel, category: null })
                            }
                            onTypingChange={() => undefined}
                            channel={{
                                icon: TypeIcon,
                                topic: channel?.topic ?? null,
                                onBack: () => setListOpen(true),
                                onSettings:
                                    channel && can_manage
                                        ? () =>
                                              setDialog({
                                                  channel,
                                                  category: null,
                                              })
                                        : undefined,
                            }}
                        />
                    ) : (
                        <div className="flex flex-1 items-center justify-center p-8 text-sm text-white/45">
                            {tr('Оберіть канал ліворуч.')}
                        </div>
                    )}
                </div>
            </div>

            {dialog && (
                <ChannelDialog
                    open
                    onOpenChange={(open) => {
                        if (!open) setDialog(null);
                    }}
                    slug={community.slug}
                    categories={categories}
                    channel={dialog.channel}
                    defaultCategory={dialog.category}
                />
            )}
        </>
    );
}
