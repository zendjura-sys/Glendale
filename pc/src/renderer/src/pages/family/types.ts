export type Member = { id: number; user_id: number; display: string; nickname?: string | null; static_id?: string | null; rank: number; rank_title: string; duties?: string | null; avatar_url?: string | null; username?: string | null; is_online?: boolean; balance?: number; warns?: number; joined_at?: string; last_seen_at?: string | null; is_owner?: boolean; manageable?: boolean };
export type Can = Record<string, boolean>;
export type FamilyShell = {
    family: { id: number; slug: string; name: string; tag: string | null; logo_url: string | null; cover_url: string | null; status_label: string; members_count: number; description: string | null; treasury: number | null; conversation_id: number | null; rank_titles: Record<string, string>; sections: { events: boolean; warehouse: boolean; rating: boolean; shifts: boolean }; server?: { name: string } | null };
    me: Member | null;
    can: Can;
    badges: { queue?: number; applications?: number; alerts?: number; my_pending?: number };
};
export type Roster = { id: number; display: string; rank?: number; warns?: number }[];
