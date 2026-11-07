import {
  Disc3,
  Download,
  Friends,
  FriendsFeed,
  Folder,
  Headphones,
  Search,
} from "@craft/icons";
import type { DubPostProps } from "../organisms/DubPost/DubPost";
import type { NavigationSection } from "../organisms/Navigation/Navigation";

export const templatePosts: DubPostProps[] = [
  {
    author: "Meladee",
    authorDetail: "Friend",
    timestamp: "24 min ago",
    message: "One for the late hours. Fresh out of the studio — let me know how it hits.",
    track: {
      title: "Alien",
      artist: "Malaa",
      duration: "03:42",
      bpm: "174",
      keySignature: "F minor",
      fileSize: "WAV · 62.4 MB",
    },
    likes: 28,
    comments: 6,
    downloads: 18,
  },
  {
    author: "Meladee, Holik",
    authorDetail: "2 Friends",
    timestamp: "1 hr ago",
    message: "New roller for the weekend. Tested this one in Bristol last night.",
    track: {
      title: "Renegade",
      artist: "Malaa, Hek",
      duration: "04:18",
      bpm: "174",
      keySignature: "D minor",
      fileSize: "WAV · 71.9 MB",
    },
    likes: 42,
    comments: 12,
    downloads: 31,
  },
  {
    author: "Meladee",
    authorDetail: "Friend",
    timestamp: "Yesterday",
    message: "Deep cut from last night's session.",
    track: {
      title: "Underground",
      artist: "Malaa",
      duration: "03:56",
      bpm: "128",
      keySignature: "A minor",
      fileSize: "WAV · 58.2 MB",
    },
    likes: 16,
    comments: 3,
    downloads: 9,
  },
];

export const desktopNavigation: NavigationSection[] = [
  {
    label: "Your workspace",
    items: [
      { label: "Feed", icon: <FriendsFeed />, badge: "•" },
      { label: "Friends", icon: <Friends />, badge: "24" },
      { label: "My dubs", icon: <Disc3 />, badge: "08" },
      { label: "Downloads", icon: <Download /> },
      { label: "Saved dubs", icon: <Disc3 /> },
    ],
  },
  {
    label: "Your crates",
    items: [
      { label: "Late-night weapons", icon: <Folder /> },
      { label: "Warm-up selections", icon: <Folder /> },
      { label: "Test on the system", icon: <Folder /> },
    ],
  },
];

export const mobileNavigation: NavigationSection[] = [
  {
    items: [
      { label: "Feed", icon: <FriendsFeed /> },
      { label: "Friends", icon: <Friends /> },
      { label: "Discover", icon: <Search /> },
      { label: "My dubs", icon: <Disc3 /> },
      { label: "Listen", icon: <Headphones /> },
    ],
  },
];
