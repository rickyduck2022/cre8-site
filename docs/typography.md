# Typography

The shared typography tokens in `packages/tokens/src/theme.css` are available in
the web app, admin app, and Storybook. Their CSS variable references are also
exported as `typography` from `@craft/tokens` and listed in `tokens.json`.
Use the semantic tokens instead of introducing new pixel-based sizes.

| Use | Size | Weight and leading |
| --- | --- | --- |
| Page heading | `--type-size-page` | strong, tight; heading tracking |
| Section heading | `--type-size-section` | strong, tight |
| Body | `--type-size-body` | regular, body |
| Compact body, helper text | `--type-size-compact` | regular, body |
| Form label | `--type-size-compact` | medium, body |
| Editable input | `--type-size-input` | regular, body |
| Metadata and captions | `--type-size-label` or `--type-size-caption` | regular, body |
| Eyebrow and very compact metadata | `--type-size-micro` | strong for eyebrows, control leading and eyebrow tracking |
| Buttons | `--type-size-button-small`, `--type-size-button-medium`, `--type-size-button-large` | medium, control |

Use the `--type-weight-*`, `--type-leading-*`, and `--type-tracking-*`
tokens for the corresponding properties. Editable inputs use 0.875rem for a
compact, readable appearance; some mobile browsers may zoom when they receive
focus. Reserve micro text for short supporting content, not essential
instructions or errors. The older
`--font-size-*` variables remain available for compatibility.

`--font-interface` prefers a locally installed Inter and otherwise uses system
UI fonts. `--font-mono` similarly prefers IBM Plex Mono and falls back to system
monospace fonts. Neither font is downloaded by the app. See the Typography
foundation in Storybook for examples.
