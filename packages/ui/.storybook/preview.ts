import "@craft/tokens/styles.css";
import '../../tokens/src/theme.css';
import '../src/foundations/Global.css';
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#171A20' },
      ],
    },
  },
};

export default preview;