export type Presence = "online" | "away" | "offline";
export type ChatConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface Buddy {
  id: string;
  username: string;
  displayName: string;
  presence: Presence;
  genre: string;
  role: string;
  bio: string;
  groups: string[];
  unread?: number;
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
  duration: string;
  likes: number;
  downloads: number;
  artwork: string;
  message: string;
  audioUrl?: string;
  audioFileName?: string;
  artworkUrl?: string;
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
}
