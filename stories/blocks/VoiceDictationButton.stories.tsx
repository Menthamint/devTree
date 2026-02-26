import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { VoiceDictationButton } from '@/components/features/MainContent/voice-dictation/VoiceDictationButton';
import { ConfirmationProvider } from '@/lib/confirmationContext';
import { I18nProvider } from '@/lib/i18n';

const meta: Meta<typeof VoiceDictationButton> = {
  title: 'Components/Blocks/VoiceDictationButton',
  component: VoiceDictationButton,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <ConfirmationProvider>
        <I18nProvider>
          <Story />
        </I18nProvider>
      </ConfirmationProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof VoiceDictationButton>;

export const Default: Story = {
  args: {
    onTextRecognized: (text: string) => console.log('Recognized text:', text),
  },
};

export const English: Story = {
  args: {
    language: 'en',
    onTextRecognized: (text: string) => console.log('Recognized text (English):', text),
  },
};

export const Ukrainian: Story = {
  args: {
    language: 'uk',
    onTextRecognized: (text: string) => console.log('Recognized text (Ukrainian):', text),
  },
};
