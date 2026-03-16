import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'Workflows',
      items: ['workflows/build', 'workflows/release'],
    },
    {
      type: 'category',
      label: 'Guides',
      items: ['guides/github-app-setup'],
    },
  ],
};

export default sidebars;
