import type { Meta, StoryObj } from "@storybook/react";

const colorGroups = [
  {
    name: "Surfaces",
    tokens: ["surface-canvas", "surface-raised", "surface-control"],
  },
  {
    name: "Border",
    tokens: ["border-default"],
  },
  {
    name: "Text",
    tokens: ["text-primary", "text-secondary", "text-on-accent"],
  },
  {
    name: "Actions",
    tokens: [
      "action-primary",
      "action-primary-hover",
      "action-primary-pressed",
    ],
  },
  {
    name: "Audio",
    tokens: ["audio-active", "audio-inactive"],
  },
  {
    name: "Focus and links",
    tokens: ["focus-ring", "link-default"],
  },
] as const;

const meta = {
  title: "Foundations/Colors",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SemanticColors: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gap: "32px",
        fontFamily: "var(--font-interface)",
        color: "var(--text-primary)",
      }}
    >
      {colorGroups.map((group) => (
        <section key={group.name}>
          <h2
            style={{
              margin: "0 0 16px",
              color: "var(--text-secondary)",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {group.name}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "12px",
            }}
          >
            {group.tokens.map((token) => (
              <article
                key={token}
                style={{
                  overflow: "hidden",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  backgroundColor: "var(--surface-raised)",
                }}
              >
                <div
                  aria-label={`Color swatch for ${token}`}
                  style={{
                    height: "72px",
                    backgroundColor: `var(--${token})`,
                  }}
                />
                <div style={{ padding: "12px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>
                    {token}
                  </div>
                  <code
                    style={{
                      display: "block",
                      marginTop: "4px",
                      color: "var(--text-secondary)",
                      fontSize: "12px",
                    }}
                  >
                    --{token}
                  </code>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};
