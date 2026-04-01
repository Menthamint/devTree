'use client';

import { TEXT_COLORS } from '@/components/features/editor/colorConstants';

type Props = {
  currentColor?: string;
  onSelectColor: (hex: string) => void;
  onClose: () => void;
};

export function ColorPickerDropdown({ currentColor, onSelectColor, onClose }: Readonly<Props>) {
  return (
    <>
      <div className="fixed inset-0 z-40" aria-hidden onClick={onClose} />
      <div className="border-border bg-popover absolute top-full left-0 z-50 mt-1 max-h-52 w-40 overflow-y-auto rounded-lg border p-2 shadow-lg">
        {TEXT_COLORS.map(({ name, value }) => (
          <button
            key={name}
            type="button"
            className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelectColor(value);
              onClose();
            }}
          >
            <span
              className="border-border h-4 w-4 rounded border"
              style={{
                backgroundColor: value || 'transparent',
                outline: currentColor === value && value ? '2px solid currentColor' : undefined,
              }}
            />
            {name}
          </button>
        ))}
        <div className="border-border mt-1 border-t pt-1">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="color"
              className="h-6 w-6 border-none p-0"
              onChange={(e) => {
                onSelectColor(e.target.value);
                onClose();
              }}
            />{' '}
            Custom
          </label>
        </div>
      </div>
    </>
  );
}
