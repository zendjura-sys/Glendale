export type GtaServerCard = {
    id: number;
    slug: string;
    name: string;
    platform: 'pc' | 'mobile';
    platform_label: string;
    multiplayer: string;
    multiplayer_label: string;
    language: string;
    tagline: string | null;
    icon: string | null;
    website: string | null;
    discord: string | null;
    telegram: string | null;
    connect: string | null;
    players_online: number | null;
    players_max: number | null;
    players_peak: number | null;
    discord_members: number | null;
    discord_online: number | null;
    stats_updated_at: string | null;
    is_featured: boolean;
    families_count: number;
    tags?: { mode: string | null; region: string | null };
};

export type ServerOption = {
    id: number;
    slug: string;
    name: string;
    icon: string | null;
    platform: string;
};

export type FamilyCard = {
    id: number;
    slug: string;
    name: string;
    tag: string;
    logo_url: string | null;
    cover_url: string | null;
    status: 'pending_verification' | 'verified' | 'suspended';
    status_label: string;
    members_count: number;
    is_recruiting: boolean;
    description?: string | null;
    server: {
        slug: string;
        name: string;
        icon: string | null;
        platform: string;
    } | null;
};

export type MemberCard = {
    id: number;
    user_id: number;
    nickname: string;
    static_id: string;
    display: string;
    rank: number;
    rank_title: string | null;
    duties: string | null;
    avatar_url: string | null;
    username: string | null;
    is_online: boolean;
    discord: string | null;
};

export type RosterEntry = { id: number; display: string; rank: number };

export type FamilyAbilities = {
    'members.manage': boolean;
    'ranks.manage': boolean;
    'reports.bizwar': boolean;
    'reports.contract': boolean;
    'reports.investment': boolean;
    'reports.other': boolean;
    'reports.review': boolean;
    'treasury.manage': boolean;
    'warehouse.logs': boolean;
    'warehouse.manage': boolean;
    'sanctions.issue': boolean;
    'events.manage': boolean;
    'audit.view': boolean;
    'settings.manage': boolean;
    owner: boolean;
};

export type FamilySection =
    | 'overview'
    | 'reports'
    | 'queue'
    | 'bank'
    | 'warehouse'
    | 'members'
    | 'discipline'
    | 'events'
    | 'rating'
    | 'audit'
    | 'settings';

export type FamilyShellProps = {
    family: FamilyCard & {
        description: string | null;
        status_reason: string | null;
        treasury: number;
        conversation_id: number | null;
        owner_id: number | null;
        rank_titles: Record<string, string>;
    };
    me: MemberCard & { balance: number };
    can: FamilyAbilities;
    section: FamilySection;
    badges?: {
        queue: number;
        applications: number;
        alerts: number;
        my_pending: number;
    };
};

export type ReportType = 'bizwar' | 'contract' | 'investment' | 'other';

export type FamilyReportItem = {
    id: number;
    type: ReportType;
    type_label: string;
    status: 'pending' | 'approved' | 'rejected';
    event_date: string;
    data: {
        wins?: number;
        losses?: number;
        hours?: number[];
        tier?: 'light' | 'medium' | 'heavy';
        count?: number;
        amount?: number;
    } | null;
    description: string | null;
    reward: number;
    points: number;
    flags: { similar_reports?: number[] } | null;
    for_friend: boolean;
    submitter: MemberCard;
    beneficiary: MemberCard;
    reviewer: MemberCard | null;
    review_comment: string | null;
    reviewed_at: string | null;
    created_at: string;
    deadline: string;
    proofs: {
        id: number;
        url: string;
        width: number | null;
        height: number | null;
    }[];
};

export type ReportConfig = {
    types: Record<ReportType, string>;
    tiers: Record<'light' | 'medium' | 'heavy', string>;
    hours: number[];
    rates: Record<string, number>;
    deadline_hours: number;
    contract_limit: number;
    require_proof: boolean;
    max_proofs: number;
    today: string;
    min_date: string;
};

export type LedgerEntry = {
    id: number;
    type: string;
    type_label: string;
    amount: number;
    balance_after: number | null;
    treasury_delta: number;
    treasury_after: number | null;
    comment: string | null;
    member: string | null;
    actor: string | null;
    created_at: string;
};

export type CashoutItem = {
    id: number;
    amount: number;
    status: 'pending' | 'paid' | 'cancelled';
    note: string | null;
    member: { id: number; display: string; balance: number };
    process_comment: string | null;
    processed_at: string | null;
    has_proof: boolean;
    created_at: string;
};

export type DepositItem = {
    id: number;
    amount: number;
    payout: number;
    period: 'daily' | 'weekly';
    periods: number;
    rate: number;
    status: 'active' | 'matured' | 'closed';
    accrued: number;
    paid: number | null;
    matures_at: string;
    created_at: string;
};

export type AuditEntry = {
    id: number;
    action: string;
    action_label: string;
    actor: string | null;
    target: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
};

export type LeaderboardRow = MemberCard & {
    place: number;
    points: number;
    bizwar_wins: number;
    bizwar_losses: number;
    contracts: number;
    invested: number;
    events: number;
    earned: number;
};
