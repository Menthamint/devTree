import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { VoiceDictationLanguageButton } from '@/components/features/MainContent/voice-dictation/VoiceDictationLanguageButton';
import { I18nProvider, type Locale } from '@/lib/i18n';

const meta: Meta<typeof VoiceDictationLanguageButton> = {
  title: 'Components/Blocks/VoiceDictationLanguageButton',
  component: VoiceDictationLanguageButton,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <I18nProvider>
        <Story />
      </I18nProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof VoiceDictationLanguageButton>;

export const Default: Story = {
  args: {
    onLanguageChange: (nextLanguage: Locale) => console.log('Language changed to:', nextLanguage),
  },
};

export const WithEnglish: Story = {
  args: {
    onLanguageChange: (nextLanguage: Locale) => console.log('Language changed to:', nextLanguage),
  },
  decorators: [
    (Story) => (
      <I18nProvider initialLocale="en">
        <Story />
      </I18nProvider>
    ),
  ],
};

export const WithUkrainian: Story = {
  args: {
    onLanguageChange: (nextLanguage: Locale) => console.log('Language changed to:', nextLanguage),
  },
  decorators: [
    (Story) => (
      <I18nProvider initialLocale="uk">
        <Story />
      </I18nProvider>
    ),
  ],
};
