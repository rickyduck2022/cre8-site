import type { CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react";

const sizes = [
  "9",
  "10",
  "10-2",
  "10-54",
  "10-8",
  "11",
  "11-16",
  "12",
  "12-4",
  "13",
  "14",
  "17",
  "18",
  "20",
  "21",
  "23",
  "29",
  "30",
] as const;

const meta = {
  title: "Foundations/Typography",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TypeScale: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gap: 24,
        color: "var(--text-primary)",
        fontFamily: "var(--font-interface)",
      }}
    >
      <section>
        <h2 style={{ fontSize: "var(--font-size-30)", margin: "0 0 8px" }}>
          Inter / interface
        </h2>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Native text styles use the optical sizes from the Foundations source.
        </p>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {sizes.map((size) => {
            const token = `--font-size-${size}`;
            const label = size.replace("-", ".");

            return (
              <div
                key={size}
                style={{
                  alignItems: "baseline",
                  borderBottom: "1px solid var(--border-default)",
                  display: "grid",
                  gap: 16,
                  gridTemplateColumns: "minmax(96px, auto) 1fr",
                  paddingBottom: 8,
                }}
              >
                <code
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--font-size-10)",
                  }}
                >
                  {token}
                </code>
                <span
                  style={
                    {
                      fontSize: `var(${token})`,
                      lineHeight: 1.3,
                    } as CSSProperties
                  }
                >
                  {label}px — The quick brown fox
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "var(--font-size-20)", margin: "0 0 8px" }}>
          IBM Plex Mono / audio metadata
        </h2>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-12)",
            margin: 0,
          }}
        >
          03:42 · 128 BPM · F♯ minor · 44.1 kHz
        </p>
      </section>
    </div>
  ),
};
