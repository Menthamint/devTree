import { describe, expect, it } from 'vitest';

import { isValidEmailAddress } from '@/lib/auth/email';

describe('isValidEmailAddress', () => {
  it('accepts valid lowercase emails', () => {
    expect(isValidEmailAddress('user@example.com')).toBe(true);
    expect(isValidEmailAddress('first.last+tag@sub.domain.dev')).toBe(true);
  });

  it('rejects malformed email values', () => {
    expect(isValidEmailAddress('')).toBe(false);
    expect(isValidEmailAddress('plainaddress')).toBe(false);
    expect(isValidEmailAddress('@example.com')).toBe(false);
    expect(isValidEmailAddress('user@')).toBe(false);
    expect(isValidEmailAddress('user@example')).toBe(false);
    expect(isValidEmailAddress('user@example..com')).toBe(false);
    expect(isValidEmailAddress('user@exa mple.com')).toBe(false);
    expect(isValidEmailAddress('user@exämple.com')).toBe(false);
  });

  it('rejects uppercase and overly long values', () => {
    expect(isValidEmailAddress('User@Example.com')).toBe(false);

    const tooLongLocal = `${'a'.repeat(65)}@example.com`;
    expect(isValidEmailAddress(tooLongLocal)).toBe(false);

    const tooLongEmail = `${'a'.repeat(245)}@a.com`;
    expect(isValidEmailAddress(tooLongEmail)).toBe(false);
  });
});
