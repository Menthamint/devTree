import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SettingsDialog } from '@/components/features/SettingsDialog/SettingsDialog';

function SettingsDialogDemo() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open settings
      </button>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

const meta: Meta<typeof SettingsDialog> = {
  title: 'Components/SettingsDialog',
  component: SettingsDialog,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  render: () => <SettingsDialogDemo />,
};

export default meta;

type Story = StoryObj<typeof SettingsDialog>;

export const Open: Story = {};
