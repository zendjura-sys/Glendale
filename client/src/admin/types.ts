import type { Group, LevelType, Post, UserShort } from '../lib/types';

export interface AdminUser extends UserShort {
  email: string;
  level: { id: number; title: string; type: LevelType };
  enabled: boolean;
  approved: boolean;
  verified: boolean;
  signupIp: string;
  lastIp: string;
  createdAt: number;
  lockedUntil: number;
}

export interface AdminUserDetails extends AdminUser {
  stats: Record<'posts' | 'comments' | 'messages' | 'friends' | 'groups' | 'photos' | 'sessions' | 'reportsAgainst', number>;
}

export interface Paged<T> {
  items: T[];
  total: number;
  perPage: number;
}

export interface DayPoint {
  date: number;
  count: number;
}

export interface Dashboard {
  totals: Record<
    | 'users'
    | 'newUsersWeek'
    | 'online'
    | 'posts'
    | 'postsWeek'
    | 'comments'
    | 'messages'
    | 'groups'
    | 'photos'
    | 'openReports'
    | 'pendingUsers'
    | 'bannedUsers',
    number
  >;
  activity: { signups: DayPoint[]; posts: DayPoint[]; messages: DayPoint[] };
  recentUsers: AdminUser[];
  system: { node: string; uptime: number; memory: number; dbSize: number };
}

export type PermissionKey = 'can_post' | 'can_comment' | 'can_message' | 'can_create_groups' | 'can_upload';

export interface Level {
  id: number;
  title: string;
  description: string;
  type: LevelType;
  isDefault: boolean;
  floodSeconds: number;
  permissions: Record<PermissionKey, boolean>;
  members: number;
}

export interface Report {
  id: number;
  targetType: 'post' | 'comment' | 'user' | 'group' | 'message';
  targetId: number;
  category: string;
  categoryLabel: string;
  description: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolution: string;
  createdAt: number;
  resolvedAt: number | null;
  reporter: UserShort | null;
  resolvedBy: UserShort | null;
  target: { exists: boolean; text?: string; image?: string | null; author?: UserShort; link?: string | null };
  duplicates: number;
}

export interface AdminComment {
  id: number;
  postId: number;
  text: string;
  createdAt: number;
  author: UserShort | null;
}

export interface AdminGroup extends Group {
  owner: UserShort | null;
  posts: number;
}

export interface AdminAnnouncement {
  id: number;
  title: string;
  body: string;
  active: boolean;
  createdAt: number;
  author: UserShort | null;
}

export interface Settings {
  siteTitle: string;
  siteDescription: string;
  signupMode: 'open' | 'approval' | 'closed';
  maintenance: boolean;
  maintenanceMessage: string;
  bannedEmails: string;
  bannedIps: string;
  bannedWords: string;
  lockAttempts: number;
  lockMinutes: number;
  accentColor: string;
  aurora: boolean;
  wallForFriendsOnly: boolean;
}

export interface Stats {
  days: number;
  series: Record<'signups' | 'posts' | 'comments' | 'messages' | 'likes', DayPoint[]>;
  topPosters: { user: UserShort; posts: number }[];
  topGroups: { id: number; name: string; avatar: string | null; members: number }[];
  levels: { title: string; count: number }[];
}

export interface LogEntry {
  id: number;
  action: string;
  target: string;
  details: string;
  createdAt: number;
  admin: UserShort | null;
}

export type { Post };
