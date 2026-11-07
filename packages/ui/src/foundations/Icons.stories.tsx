import type { ComponentType } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { IconProps } from "../index";
import {
  AudioLines,
  Bell,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Disc3,
  Download,
  Ellipsis,
  Folder,
  Friends,
  FriendsFeed,
  Headphones,
  Heart,
  IosBatteryFull,
  IosSignal,
  IosWifiSignal,
  Link,
  ListMusic,
  LockKeyhole,
  Maximize2,
  MessageCircle,
  MoreActions,
  Pause,
  Play,
  Plus,
  Queue,
  Radio,
  Repeat,
  Search,
  SearchAlt,
  Settings,
  Settings2,
  Shuffle,
  SkipBack,
  SkipForward,
  Ticket,
  Upload,
  UserPlus,
  Users,
  Volume2,
} from "../index";

const icons: { name: string; Icon: ComponentType<IconProps> }[] = [
  { name: "AudioLines", Icon: AudioLines },
  { name: "Radio", Icon: Radio },
  { name: "Users", Icon: Users },
  { name: "Disc3", Icon: Disc3 },
  { name: "Download", Icon: Download },
  { name: "Bookmark", Icon: Bookmark },
  { name: "Plus", Icon: Plus },
  { name: "Folder", Icon: Folder },
  { name: "Headphones", Icon: Headphones },
  { name: "Settings2", Icon: Settings2 },
  { name: "Search", Icon: Search },
  { name: "SearchAlt", Icon: SearchAlt },
  { name: "LockKeyhole", Icon: LockKeyhole },
  { name: "Bell", Icon: Bell },
  { name: "Upload", Icon: Upload },
  { name: "ChevronDown", Icon: ChevronDown },
  { name: "Ellipsis", Icon: Ellipsis },
  { name: "Pause", Icon: Pause },
  { name: "Heart", Icon: Heart },
  { name: "MessageCircle", Icon: MessageCircle },
  { name: "Play", Icon: Play },
  { name: "CheckCheck", Icon: CheckCheck },
  { name: "Check", Icon: Check },
  { name: "Shuffle", Icon: Shuffle },
  { name: "UserPlus", Icon: UserPlus },
  { name: "Ticket", Icon: Ticket },
  { name: "Link", Icon: Link },
  { name: "SkipBack", Icon: SkipBack },
  { name: "SkipForward", Icon: SkipForward },
  { name: "Repeat", Icon: Repeat },
  { name: "ListMusic", Icon: ListMusic },
  { name: "Volume2", Icon: Volume2 },
  { name: "Maximize2", Icon: Maximize2 },
  { name: "IosWifiSignal", Icon: IosWifiSignal },
  { name: "IosBatteryFull", Icon: IosBatteryFull },
  { name: "FriendsFeed", Icon: FriendsFeed },
  { name: "Friends", Icon: Friends },
  { name: "Settings", Icon: Settings },
  { name: "MoreActions", Icon: MoreActions },
  { name: "Queue", Icon: Queue },
  { name: "IosSignal", Icon: IosSignal },
  { name: "ChevronRight", Icon: ChevronRight },
];

const meta = {
  title: "Foundations/Icons",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
        gap: "12px",
        color: "var(--text-primary)",
        fontFamily: "var(--font-interface)",
      }}
    >
      {icons.map(({ name, Icon }) => (
        <div
          key={name}
          style={{
            display: "flex",
            minHeight: "88px",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            backgroundColor: "var(--surface-raised)",
          }}
        >
          <Icon size={24} aria-hidden="true" />
          <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
            {name}
          </span>
        </div>
      ))}
    </div>
  ),
};
