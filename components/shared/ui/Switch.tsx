/**
 * Switch — an accessible toggle/switch component.
 *
 * Built with a <button role="switch"> rather than a styled <input type="checkbox">
 * because:
 *   - The ARIA switch role better communicates the "on/off state" semantic to
 *     screen readers vs. a checkbox which implies "selected/unselected".
 *   - Pure CSS implementation avoids adding @radix-ui/react-switch as a dependency
 *     for a simple visual element. The accessibility requirements are met with
 *     role="switch" + aria-checked without a library.
 *
 * IMPROVEMENT IDEAS:
 *   - Add a `disabled` prop with `aria-disabled` and reduced opacity.
 *   - Support `size` prop ('sm' | 'md' | 'lg') for different visual scales.
 *   - Replace with @radix-ui/react-switch if more complex usage is needed
 *     (e.g. form integration with native form submission).
 */
import { cn } from '@/lib/utils';

type SwitchProps = Readonly<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible label for screen readers when there is no visible <label> element. */
  label?: string;
  id?: string;
  disabled?: boolean;
}>;

export function Switch({ checked, onChange, label, id, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        // Track
        'motion-interactive relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:ring-ring focus-visible:ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        checked ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-muted hover:bg-muted-foreground/20',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {/* Thumb */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0',
          'transition-transform duration-200 ease-out',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}
