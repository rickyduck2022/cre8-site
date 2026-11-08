export type Presence = "online" | "away" | "offline";
export type AListRole = "DJ" | "Producer" | "DJ & Producer" | "MC / Vocalist" | "Other";
export type AListProvider = "instagram" | "tiktok" | "facebook" | "soundcloud";
export interface AListApplicationFields {
  artistName: string;
  roles: AListRole[];
  djExperience: string;
  producerExperience: string;
  events: string[];
  supporters: string[];
  labels: string[];
  social: Record<AListProvider, { url: string; followers: number | null }>;
  additionalInfo: string;
}
export interface AListApplication {
  id: string;
  userId: string;
  status: "pending" | "approved" | "rejected" | "more_information" | "revoked";
  createdAt: string;
  updatedAt: string;
  versions: Array<{ fields: AListApplicationFields; submittedAt: string }>;
  decisions: Array<{ action: string; note: string; administratorId: string; administrator: string; decidedAt: string }>;
}
export type ChatConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface Buddy {
  id: string;
  userId?: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  presence: Presence;
  genre: string;
  role: string;
  bio: string;
  groups: string[];
  unread?: number;
  aListApproved?: boolean;
}

export interface MemberSearchResult {
  id: string;
  artistId?: string;
  username: string;
  displayName: string;
  genre: string;
  avatarUrl?: string;
  aListApproved?: boolean;
}

export interface Dub {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artistAListApproved?: boolean;
  uploaderAListApproved?: boolean;
  uploader: string;
  uploaderDisplayName: string;
  uploaderAvatarUrl?: string;
  uploadedAt: string;
  bpm: number;
  genre: string;
  tags?: string[];
  duration: string;
  likes: number;
  downloads: number;
  artwork: string;
  message: string;
  audioUrl?: string;
  audioFileName?: string;
  audioFormat?: string;
  bitrateKbps?: number;
  artworkUrl?: string;
  likedByCurrentUser?: boolean;
  downloaders?: Array<{ username: string; displayName: string; downloadedAt: string }>;
  distribution?: "worldwide" | "private" | "alist";
  version?: number;
  sharedBuddyIds?: string[];
  grants?: Array<{ id: string; username: string; displayName: string }>;
}

export interface LibraryDownload {
  downloadedAt: string;
  dub: Dub;
}

export interface ArtistOption {
  id: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  sender: "you" | "them";
  text: string;
  sentAt: string;
  dubId?: string;
  unsent?: boolean;
}

export interface Conversation {
  buddyId: string;
  messages: ChatMessage[];
  hasMoreMessages?: boolean;
}

export interface ChatMessagePage {
  buddyId: string;
  messages: ChatMessage[];
  hasMoreMessages: boolean;
}

export interface MemberProfile {
  id: string;
  username: string;
  displayName: string;
  presence: Presence;
  genre: string;
  role: string;
  bio: string;
  groups: string[];
  avatarUrl?: string;
  bannerUrl?: string;
  links?: Array<{ label: string; url: string }>;
  aListApproved?: boolean;
}
