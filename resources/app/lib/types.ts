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
  /** Родини, в яких людина (для меню «Моя родина»). */
  families: MyFamily[];
  canManageFamilies: boolean;
  /** Активна родина: у ній відкриваються звіти, банк, цілі… */
  activeFamilyId: number | null;
  /** Учасник активної родини — бачить її інструменти. */
  familyTools: boolean;
  /** Лідер або заступник активної родини. */
  familyManager: boolean;
}

// ───────────── Система управління родинами («Моя родина») ─────────────

export type FamilyStatus = 'pending' | 'verified' | 'rejected';
export type FamilyRole = 'leader' | 'deputy' | 'member';

export interface MyFamily {
  id: number;
  name: string;
  tag: string | null;
  status: FamilyStatus;
  role: FamilyRole;
}

export interface GameProject {
  id: number;
  name: string;
  logo: string | null;
  approved: boolean;
  families: number;
  website: string | null;
  serversSource: string | null;
  servers: { id: number; name: string; approved: boolean; address: string | null; players: number | null; maxPlayers: number | null }[];
}

export interface Family {
  id: number;
  name: string;
  tag: string | null;
  color: string | null;
  project: string;
  server: string;
  projectId: number | null;
  serverId: number | null;
  description: string;
  avatar: string | null;
  cover: string | null;
  status: FamilyStatus;
  membersCount: number;
  myRole: FamilyRole | null;
  requested: boolean;
  createdAt: number;
}

export interface FamilyFull extends Family {
  discordUrl: string | null;
  telegramUrl: string | null;
  leader: UserShort | null;
  reviewNote: string | null;
  proof: string | null;
  verifiedAt: number | null;
  canManage: boolean;
  isLeader: boolean;
  requestsCount: number;
  union: { id: number; name: string; tag: string | null; status: FamilyStatus; role: 'founder' | 'member' } | null;
}

/** Профіль родини — опис, керівництво, посади, правила (керує лідер/заступник). */
export interface FamilyProfile {
  about: string[];
  leadership: { title: string; text: string; nickname: string }[];
  positions: { key: string; title: string; text: string; image: string }[];
  promotionCriteria: string[];
  rules: string;
  members: { id: number; name: string; role: FamilyRole; positionKey: string | null }[];
}

export interface FamilyMember extends UserShort {
  role: FamilyRole;
  roleLabel: string;
  joinedAt: number;
}

export interface FamilyRequest extends UserShort {
  message: string;
  requestedAt: number;
}

export interface FamilyUnion {
  id: number;
  name: string;
  tag: string | null;
  description: string;
  avatar: string | null;
  status: FamilyStatus;
  familiesCount: number;
  founder: Family | null;
  createdAt: number;
}

export interface FamilyUnionFull extends FamilyUnion {
  families: (Family & { unionRole: 'founder' | 'member' })[];
  isFounder: boolean;
  reviewNote: string | null;
  requestsCount: number;
  myFamilies: { id: number; name: string; status: FamilyStatus; inUnion: number | null; requested: boolean }[];
  canJoin: boolean;
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
  ownerType: 'user' | 'group' | 'family';
  ownerId: number;
  fromGroup: boolean;
  author: UserShort;
  group: Group | null;
  wallOwner: UserShort | null;
  repost: Post | null;
  audio: Track | null;
  spotify: SpotifyRef | null;
  family?: { id: number; name: string; tag: string; avatar: string | null } | null;
  cinema?: TitleCard | null;
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
  type:
    | 'like'
    | 'comment'
    | 'repost'
    | 'wall_post'
    | 'friend_request'
    | 'friend_accept'
    | 'group_request'
    | 'group_accept'
    | 'family_verified'
    | 'family_rejected'
    | 'family_join_request'
    | 'family_join_accepted'
    | 'union_verified'
    | 'union_rejected'
    | 'union_join_request'
    | 'union_join_accepted'
    | 'cinema_recommend';
  text: string;
  isRead: boolean;
  createdAt: number;
  actor: UserShort;
  post: { id: number; text: string; image: string | null } | null;
  groupId: number | null;
  familyId?: number | null;
  unionId?: number | null;
  titleId?: number | null;
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

/* ——— Кінопортал ——— */

export interface TitleCard {
  id: number;
  type: 'movie' | 'series';
  name: string;
  originalName: string | null;
  year: number | null;
  poster: string | null;
  backdrop: string | null;
  rating: number | null;
  localRating: number | null;
  hasPlayer: boolean;
  quality?: string | null;
  isNew?: boolean;
  category?: CinemaCategory;
  categoryLabel?: string | null;
  badges?: string[];
  genres: string[];
  myRating?: number;
  role?: string | null;
}

export interface CinemaCredit {
  personId: number;
  name: string;
  photo: string | null;
  role: string | null;
}

export interface TitleFull extends TitleCard {
  overview: string;
  tagline: string | null;
  releaseDate: string | null;
  runtime: number | null;
  countries: string[];
  status: string | null;
  voteCount: number;
  localRatingCount: number;
  seasonsCount: number | null;
  episodesCount: number | null;
  backdropLarge: string | null;
  trailer: string | null;
  videos: { key: string; name: string | null; type: string | null }[];
  cast: CinemaCredit[];
  crew: CinemaCredit[];
  seasons: { number: number; name: string | null; episodes: number; poster: string | null; airDate: string | null }[];
  inWatchlist: boolean;
  myReview: { rating: number; body: string } | null;
  progress: { season: number | null; episode: number | null; position: number; duration: number | null } | null;
  translations: { index: number; title: string; quality: string | null; source: 'kodik' | 'flixcdn' }[];
  social: {
    ratings: { user: UserShort; rating: number; family: boolean }[];
    wantToWatch: UserShort[];
  };
  isPublished: boolean;
  interest: number | null;
  similar: TitleCard[];
}

export type CinemaCategory = 'movie' | 'series' | 'anime' | 'dorama' | 'cartoon' | 'toon';

export interface CinemaSpotlight extends TitleCard {
  overview: string;
  voteCount: number;
  localRatingCount: number;
  trailer: string | null;
  inWatchlist: boolean;
  addedAt: number | null;
  cast: { personId: number; name: string }[];
}

export interface CinemaHome {
  featured: CinemaSpotlight[];
  continue: TitleCard[];
  watchlist: TitleCard[];
  circle: TitleCard[];
  movies: TitleCard[];
  series: TitleCard[];
  top: TitleCard[];
  fresh: TitleCard[];
  genres: { id: number; name: string }[];
  trending: TitleCard[];
  categories: { key: CinemaCategory; name: string; caption: string; count: number; image: string | null }[];
}

export interface CinemaHistoryItem extends TitleCard {
  progress: { position: number; duration: number | null; season: number | null; episode: number | null };
  watchedAt: number;
}

export interface CinemaEpisode {
  number: number;
  name: string | null;
  overview: string;
  still: string | null;
  airDate: string | null;
  runtime: number | null;
}

export interface CinemaPerson {
  id: number;
  name: string;
  photo: string | null;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  knownFor: string | null;
  titles: TitleCard[];
}
