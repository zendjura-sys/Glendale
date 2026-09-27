export interface UserShort {
  id: number;
  firstName: string;
  lastName: string;
  avatar: string | null;
  online: boolean;
  lastSeen: number;
  verified?: boolean;
}

export type LevelType = 'superadmin' | 'admin' | 'moderator' | 'user';

export interface Me extends User {
  email: string;
  /** False for accounts created through Google until the member sets a password. */
  hasPassword: boolean;
  level: { id: number; title: string; type: LevelType };
  permissions: { post: boolean; comment: boolean; message: boolean; createGroups: boolean; upload: boolean };
}

export interface SiteConfig {
  siteTitle: string;
  siteDescription: string;
  signupMode: 'open' | 'approval' | 'closed';
  maintenance: boolean;
  maintenanceMessage: string;
  accentColor: string;
  aurora: boolean;
  spotifyEnabled: boolean;
  googleEnabled: boolean;
  demoAccounts: boolean;
  defaultLanguage: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  createdAt: number;
}

export const isStaffLevel = (t?: LevelType) => t === 'superadmin' || t === 'admin' || t === 'moderator';
export const isAdminLevel = (t?: LevelType) => t === 'superadmin' || t === 'admin';

export interface User extends UserShort {
  cover: string | null;
  status: string;
  bio: string;
  city: string;
  birthday: string;
  createdAt: number;
}

export type Friendship = 'self' | 'friends' | 'outgoing' | 'incoming' | 'none';

export interface Group {
  id: number;
  name: string;
  description: string;
  avatar: string | null;
  cover: string | null;
  ownerId: number;
  privacy: 'open' | 'closed';
  membersCount: number;
  isMember: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  requested: boolean;
  requestsCount: number;
  createdAt: number;
}

export interface GroupFull extends Group {
  canSeeContent: boolean;
  membersSample: UserShort[];
  admins: UserShort[];
  friendsInGroup: number;
}

export interface Profile extends User {
  friendship: Friendship;
  counts: { friends: number; followers: number; photos: number; groups: number; posts: number; mutual: number; music: number };
  friendsSample: UserShort[];
  photosSample: { id: number; url: string }[];
  groupsSample: Group[];
}

export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: number | null;
  trackNo: number | null;
  lyrics: string;
  duration: number;
  url: string;
  cover: string | null;
  plays: number;
  createdAt: number;
  ownerId: number;
  added: boolean;
}

export interface Playlist {
  id: number;
  title: string;
  description: string;
  createdAt: number;
  owner: UserShort;
  count: number;
  duration: number;
  covers: string[];
  tracks?: Track[];
}

export interface SpotifyRef {
  type: 'track' | 'album' | 'playlist' | 'episode' | 'show' | 'artist';
  id: string;
}

export interface Post {
  id: number;
  text: string;
  image: string | null;
  createdAt: number;
  ownerType: 'user' | 'group';
  ownerId: number;
  fromGroup: boolean;
  author: UserShort;
  group: Group | null;
  wallOwner: UserShort | null;
  repost: Post | null;
  audio: Track | null;
  spotify: SpotifyRef | null;
  likes: number;
  liked: boolean;
  comments: number;
  reposts: number;
  reposted: boolean;
  canDelete: boolean;
}

export interface Comment {
  id: number;
  postId: number;
  text: string;
  createdAt: number;
  author: UserShort;
}

export interface Message {
  id: number;
  fromId: number;
  toId: number;
  text: string;
  image: string | null;
  audio?: Track | null;
  spotify?: SpotifyRef | null;
  isRead: boolean;
  createdAt: number;
}

export interface ChatMessage {
  id: number;
  chatId: number;
  fromId: number | null;
  author: UserShort | null;
  kind: 'text' | 'system';
  text: string;
  system: { key: string; params: Record<string, string | number> } | null;
  image: string | null;
  audio: Track | null;
  spotify: SpotifyRef | null;
  createdAt: number;
}

export interface ChatMember extends UserShort {
  role: 'owner' | 'admin' | 'member';
  lastReadId: number;
}

export interface Chat {
  id: number;
  title: string;
  avatar: string | null;
  ownerId: number | null;
  createdAt: number;
  membersCount: number;
  myRole: 'owner' | 'admin' | 'member' | null;
  lastMessage: ChatMessage | null;
  unread: number;
  readUpTo: number;
  previewMembers: UserShort[];
  members?: ChatMember[];
}

export interface Dialog {
  peer: UserShort;
  lastMessage: Message;
  unread: number;
}

export interface Photo {
  id: number;
  url: string;
  album: string;
  createdAt: number;
}

export interface Notification {
  id: number;
  type: 'like' | 'comment' | 'repost' | 'wall_post' | 'friend_request' | 'friend_accept' | 'group_request' | 'group_accept';
  text: string;
  isRead: boolean;
  createdAt: number;
  actor: UserShort;
  post: { id: number; text: string; image: string | null } | null;
  groupId: number | null;
}

export interface Counters {
  messages: number;
  friends: number;
  notifications: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: number | null;
}
