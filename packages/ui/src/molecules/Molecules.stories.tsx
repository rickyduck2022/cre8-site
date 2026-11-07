import type { Meta, StoryObj } from "@storybook/react";
import { Download, MoreActions, UserPlus } from "@craft/icons";
import { Button } from "../atoms/Button/Button";
import { AudioPreview } from "./AudioPreview/AudioPreview";
import { Brand } from "./Brand/Brand";
import { CircleShortcut } from "./CircleShortcut/CircleShortcut";
import { FeedControls } from "./FeedControls/FeedControls";
import { FriendRequest } from "./FriendRequest/FriendRequest";
import { MemberIdentity } from "./MemberIdentity/MemberIdentity";
import { NowPlaying } from "./NowPlaying/NowPlaying";
import { PostActions } from "./PostActions/PostActions";
import { PostAuthor } from "./PostAuthor/PostAuthor";
import { SearchField } from "./SearchField/SearchField";
import { ShareEntry } from "./ShareEntry/ShareEntry";
import { SuggestedFriend } from "./SuggestedFriend/SuggestedFriend";
import { TrackMetadata } from "./TrackMetadata/TrackMetadata";
import { TransportControls } from "./TransportControls/TransportControls";
import { Waveform } from "./Waveform/Waveform";

const sampleTracks = [
  { title: "Alien", artist: "Malaa", duration: "03:42" },
  { title: "Renegade", artist: "Malaa, Hek", duration: "04:18" },
];

const meta = {
  title: "Molecules/Overview",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <div className="molecule-gallery">
      <section className="molecule-gallery__section">
        <h2>SearchField</h2>
        <div className="molecule-gallery__searches">
          <SearchField placeholder="Search artists, dubs, or genres" shortcut="⌘ K" />
          <SearchField placeholder="Search people, dubs, or genres" />
          <SearchField placeholder="Search audio, tags, or artists" />
        </div>
      </section>

      <section className="molecule-gallery__section">
        <h2>Brand</h2>
        <div className="molecule-gallery__row">
          <Brand />
          <Brand size="large" />
        </div>
      </section>

      <section className="molecule-gallery__section">
        <h2>MemberIdentity</h2>
        <div className="molecule-gallery__row">
          <MemberIdentity name="Evan" detail="Friends circle" status="active" />
          <MemberIdentity name="Serena" detail="2 mutual friends" />
        </div>
      </section>

      <section className="molecule-gallery__section">
        <h2>PostAuthor</h2>
        <div className="molecule-gallery__authors">
          <PostAuthor name="Malaa" detail="Music producer" timestamp="1h ago" />
          <PostAuthor
            name="Malaa, Hek"
            detail="Shared a track"
            timestamp="Yesterday"
            action={
              <Button
                aria-label="More post options"
                leadingIcon={<MoreActions aria-hidden="true" />}
                size="small"
                variant="tertiary"
              >
                <span className="sr-only">More post options</span>
              </Button>
            }
          />
        </div>
      </section>

      <section className="molecule-gallery__section">
        <h2>TrackMetadata</h2>
        <TrackMetadata
          tags={["New", "Electronic", "Dub"]}
          duration="03:42"
          bpm="128"
          keySignature="F♯ minor"
        />
      </section>

      <section className="molecule-gallery__section">
        <h2>Waveform</h2>
        <Waveform label="Preview waveform" />
        <Waveform color="primary" progress={0.58} label="Played waveform" />
      </section>

      <section className="molecule-gallery__section">
        <h2>PostActions</h2>
        <PostActions likes={12} comments={4} downloads={2} />
      </section>

      <section className="molecule-gallery__section">
        <h2>FriendRequest</h2>
        <div className="molecule-gallery__row">
          <FriendRequest name="Evan" detail="Friend request" />
          <FriendRequest name="Serena" detail="Mutual friends" />
        </div>
      </section>

      <section className="molecule-gallery__section">
        <h2>SuggestedFriend</h2>
        <div className="molecule-gallery__row">
          <SuggestedFriend name="Q2B" detail="Friends you may know" />
          <SuggestedFriend name="Dickey" detail="Shared music taste" />
        </div>
      </section>

      <section className="molecule-gallery__section">
        <h2>TransportControls</h2>
        <TransportControls />
      </section>

      <section className="molecule-gallery__section">
        <h2>NowPlaying</h2>
        <NowPlaying title="Alien" artist="Malaa" />
      </section>

      <section className="molecule-gallery__section">
        <h2>FeedControls</h2>
        <FeedControls />
      </section>

      <section className="molecule-gallery__section">
        <h2>AudioPreview</h2>
        <AudioPreview tracks={sampleTracks} />
      </section>

      <section className="molecule-gallery__section">
        <h2>ShareEntry</h2>
        <ShareEntry name="Sam Rivera" />
      </section>

      <section className="molecule-gallery__section">
        <h2>CircleShortcut</h2>
        <div className="molecule-gallery__row">
          <CircleShortcut name="Your circle" members={["Evan", "Serena"]} />
          <div className="molecule-gallery__actions">
            <Button leadingIcon={<UserPlus />} size="small" variant="secondary">
              Invite
            </Button>
            <Button leadingIcon={<Download />} size="small">
              Download dub
            </Button>
          </div>
        </div>
      </section>
    </div>
  ),
};
