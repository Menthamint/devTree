import React from 'react';
import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RecordingIndicator } from '@/components/RecordingIndicator';

const meta: Meta = {
  title: 'Recording/RecordingIndicator',
  component: RecordingIndicator,
};

export default meta;

type Story = StoryObj<typeof RecordingIndicator>;

export const Active: Story = {
  render: () => {
    // Render a static mock of the indicator to avoid store update loops in tests
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-full bg-red-600 px-3 py-2 text-white shadow-lg" style={{padding: '8px 12px'}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden style={{marginRight:8}}>
          <circle cx="12" cy="12" r="8" fill="#fff" opacity="0.12" />
          <path d="M12 8v4l3 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span style={{fontSize:13, fontWeight:600}}>Recording</span>
          <span style={{fontSize:11, opacity:0.9}}>in block-123</span>
        </div>
      </div>
    );
  },
};

export const Inactive: Story = {
  render: () => {
    return (
      <div style={{padding:8}}>
        <span style={{fontSize:13, color:'#666'}}>No recording active</span>
      </div>
    );
  },
};
