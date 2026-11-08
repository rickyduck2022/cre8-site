import type { Meta, StoryObj } from "@storybook/react";

const roles = [
  { name: "Page heading", size: "--type-size-page", weight: "--type-weight-strong", leading: "--type-leading-tight", sample: "A-List Submission" },
  { name: "Section heading", size: "--type-size-section", weight: "--type-weight-strong", leading: "--type-leading-tight", sample: "Your artist profile" },
  { name: "Body", size: "--type-size-body", weight: "--type-weight-regular", leading: "--type-leading-body", sample: "Share your music with the community." },
  { name: "Compact body", size: "--type-size-compact", weight: "--type-weight-regular", leading: "--type-leading-body", sample: "Follower counts are self-reported and unverified." },
  { name: "Form label", size: "--type-size-compact", weight: "--type-weight-medium", leading: "--type-leading-body", sample: "Artist name" },
  { name: "Input", size: "--type-size-input", weight: "--type-weight-regular", leading: "--type-leading-body", sample: "Your artist name" },
  { name: "Caption", size: "--type-size-label", weight: "--type-weight-regular", leading: "--type-leading-body", sample: "Optional details and metadata" },
  { name: "Eyebrow", size: "--type-size-micro", weight: "--type-weight-strong", leading: "--type-leading-control", sample: "ARTIST COMMUNITY" },
] as const;

const meta = {
  title: "Foundations/Typography",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TypeScale: Story = {
  render: () => (
    <div style={{ color: "var(--text-primary)", display: "grid", fontFamily: "var(--font-interface)", gap: 24 }}>
      <section>
        <h2 style={{ fontSize: "var(--type-size-heading)", margin: "0 0 8px" }}>Semantic typography</h2>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>Choose a role for the content, not just a size. Fonts fall back to the device's system fonts when the named fonts are not installed.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {roles.map(({ name, size, weight, leading, sample }) => (
            <div key={name} style={{ borderBottom: "1px solid var(--border-default)", display: "grid", gap: 8, paddingBottom: 12 }}>
              <code style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--type-size-label)" }}>{name} · {size}</code>
              <span style={{ fontSize: `var(${size})`, fontWeight: `var(${weight})`, letterSpacing: name === "Eyebrow" ? "var(--type-tracking-eyebrow)" : name === "Page heading" ? "var(--type-tracking-heading)" : undefined, lineHeight: `var(${leading})` }}>{sample}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 style={{ fontSize: "var(--type-size-heading)", margin: "0 0 8px" }}>Monospace / audio metadata</h2>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--type-size-compact)", margin: 0 }}>03:42 · 128 BPM · F♯ minor · 44.1 kHz</p>
      </section>
    </div>
  ),
};
