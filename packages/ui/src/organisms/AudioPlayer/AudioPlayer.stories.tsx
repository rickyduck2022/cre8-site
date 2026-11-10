import type { Meta, StoryObj } from "@storybook/react";
import { AudioPlayer } from "./AudioPlayer";
import { PlayerTab } from "../../atoms/PlayerTab/PlayerTab";
import { PlayerPositionMenu } from "../../molecules/PlayerPositionMenu/PlayerPositionMenu";
import { AudioLines } from "@craft/icons";
import "../../templates/CommunityPageTemplates.css";

const meta = {
  title: "Organisms/AudioPlayer",
  component: AudioPlayer,
  args: {
    track: {
      title: "Alien",
      artist: "Malaa",
      duration: "03:42",
    },
    playing: true,
    currentTimeSeconds: 93,
    durationSeconds: 222,
  },
} satisfies Meta<typeof AudioPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {};

export const AList: Story = {
  args: { distribution: "alist" },
};

export const Private: Story = {
  args: { distribution: "private" },
};

export const Compact: Story = {
  args: { variant: "compact" },
};

export const Mini: Story = {
  args: { variant: "mini" },
};

export const Controller: Story = {
  args: { colorVariant: "controller", onMinimizedChange: () => {} },
};

export const ControllerMinimized: Story = {
  args: { colorVariant: "controller", minimized: true, onMinimizedChange: () => {} },
};

export const FloatingTabs: Story = {
  args: {
    className: "app-player",
    colorVariant: "controller",
    minimized: true,
    onMinimizedChange: () => {},
    onClose: () => {},
    dragHandle: <PlayerTab aria-label="Move audio player" className="audio-player__drag" leadingIcon={<AudioLines aria-hidden="true" />} />,
    positionMenu: <PlayerPositionMenu positions={["header", "footer", "floating"]} onSelect={() => {}} />,
  },
  render: (args) => (
    <div className="community-dashboard-template community-dashboard-template--player-minimized">
      <AudioPlayer {...args} />
    </div>
  ),
};

export const SidebarTabs: Story = {
  ...FloatingTabs,
  render: (args) => (
    <div className="community-dashboard-template community-dashboard-template--player-minimized community-dashboard-template--player-docked">
      <AudioPlayer {...args} />
    </div>
  ),
};
