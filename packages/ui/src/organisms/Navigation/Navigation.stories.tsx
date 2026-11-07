import type { Meta, StoryObj } from "@storybook/react";
import {
  Disc3,
  Friends,
  FriendsFeed,
  Headphones,
  Search,
  Settings,
} from "@craft/icons";
import { Navigation } from "./Navigation";

const sections = [
  {
    label: "Your world",
    items: [
      { label: "Feed", icon: <FriendsFeed /> },
      { label: "People", icon: <Friends />, badge: "2" },
      { label: "My dubs", icon: <Disc3 /> },
    ],
  },
  {
    label: "Explore",
    items: [
      { label: "Discover", icon: <Search /> },
      { label: "Listening room", icon: <Headphones /> },
      { label: "Settings", icon: <Settings /> },
    ],
  },
  {
    label: "Your crates",
    items: [{ label: "Late-night weapons", icon: <Disc3 /> }],
    footer: <button type="button">Add a crate</button>,
  },
];

const meta = {
  title: "Organisms/Navigation",
  component: Navigation,
  args: {
    sections,
    activeItem: "Feed",
    userName: "Meladee",
    userDetail: "Friends circle",
  },
} satisfies Meta<typeof Navigation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sidebar: Story = {};

export const Horizontal: Story = {
  args: { variant: "horizontal" },
};

export const IconsOnly: Story = {
  args: { variant: "icons", userName: undefined },
};
