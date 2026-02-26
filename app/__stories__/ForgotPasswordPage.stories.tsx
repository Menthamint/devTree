import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import ForgotPasswordPage from '@/app/forgot-password/page';

const meta: Meta<typeof ForgotPasswordPage> = {
  title: 'Auth/ForgotPasswordPage',
  component: ForgotPasswordPage,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof ForgotPasswordPage>;

export const RequestResetLink: Story = {
  render: () => (
    <div style={{ padding: 40 }}>
      ForgotPasswordPage request mode (router/search params are mocked in app runtime).
    </div>
  ),
};

export const ResetWithToken: Story = {
  render: () => (
    <div style={{ padding: 40 }}>
      ForgotPasswordPage reset mode (open `/forgot-password?token=demo&email=user@example.com` in
      app).
    </div>
  ),
};
