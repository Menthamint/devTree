const PASSWORD_RULES = {
  minLength: 8,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /\d/,
  special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
} as const;

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength) return 'Password must be at least 8 characters';
  if (!PASSWORD_RULES.uppercase.test(password)) return 'Password must include an uppercase letter';
  if (!PASSWORD_RULES.lowercase.test(password)) return 'Password must include a lowercase letter';
  if (!PASSWORD_RULES.number.test(password)) return 'Password must include a number';
  if (!PASSWORD_RULES.special.test(password))
    return 'Password must include a special character (!@#$%^&* etc.)';
  return null;
}
