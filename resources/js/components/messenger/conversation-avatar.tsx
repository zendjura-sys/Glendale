import { UsersRound } from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

const sizes = {
    sm: 'size-9',
    md: 'size-12',
    lg: 'size-20',
} as const;

const avatarSize = { sm: 'sm', md: 'md', lg: 'xl' } as const;

type Props = {
    conversation: {
        id: number;
        type: 'direct' | 'group';
        title: string;
        avatar_url: string | null;
        peer: UserCard | null;
    };
    size?: keyof typeof sizes;
    className?: string;
};

export function ConversationAvatar({
    conversation,
    size = 'md',
    className,
}: Props) {
    if (conversation.type === 'direct') {
        return (
            <UserAvatar
                user={
                    conversation.peer ?? {
                        name: conversation.title,
                        avatar_url: null,
                    }
                }
                size={avatarSize[size]}
                className={cn(size === 'md' && 'size-12', className)}
            />
        );
    }

    return (
        <span
            className={cn(
                'relative inline-flex shrink-0 overflow-hidden rounded-full',
                sizes[size],
                className,
            )}
        >
            {conversation.avatar_url ? (
                <img
                    loading="lazy"
                    decoding="async"
                    src={conversation.avatar_url}
                    alt={conversation.title}
                    className="size-full object-cover"
                />
            ) : (
                <span className="flex size-full items-center justify-center bg-gradient-to-br from-gc-blue via-gc-indigo to-gc-purple">
                    <UsersRound
                        className={cn(
                            'text-white',
                            size === 'lg' ? 'size-9' : 'size-[45%]',
                        )}
                    />
                </span>
            )}
        </span>
    );
}
