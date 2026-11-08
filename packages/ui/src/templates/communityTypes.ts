export type Presence = "online" | "away" | "offline";
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
  presence: Presence;
  genre: string;
  role: string;
  bio: string;
  groups: string[];
  unread?: number;
}

export interface MemberSearchResult {
  id: string;
  artistId?: string;
  username: string;
  displayName: string;
  genre: string;
}

export interface Dub {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  uploader: string;
  uploaderDisplayName: string;
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
}
