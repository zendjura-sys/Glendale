import type { UserCard } from './social';

export type CommunityType = 'group' | 'public';
export type CommunityPrivacy = 'open' | 'closed';
export type CommunityRole = 'owner' | 'admin' | 'editor' | 'member';
export type MembershipStatus = 'active' | 'pending';

export type CommunityCard = {
    id: number;
    slug: string;
    name: string;
    type: CommunityType;
    privacy: CommunityPrivacy;
    category: string | null;
    category_label: string | null;
    status: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    members_count: number;
    is_verified: boolean;
    has_password?: boolean;
};

export type CommunityListItem = CommunityCard & {
    membership: MembershipStatus | null;
    managed: boolean;
    /** Повідомлень у каналах за добу, людей у голосових зараз, нових учасників за тиждень. */
    active_today?: number;
    voice_now?: number;
    growth_week?: number;
};

export type CommunityDetails = CommunityCard & {
    description: string | null;
    website: string | null;
    city: string | null;
    wall: 'open' | 'closed';
    created_at: string;
};

export type CommunityMemberItem = UserCard & {
    role: CommunityRole;
    title?: string | null;
    color?: string | null;
    status: MembershipStatus;
    joined_at: string | null;
    is_friend: boolean;
};
