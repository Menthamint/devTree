const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_PART_LENGTH = 64;

export function isValidEmailAddress(value: string): boolean {
  const email = value.trim();
  if (!email || email.length > MAX_EMAIL_LENGTH) {
    return false;
  }

  if (email !== email.toLowerCase()) {
    return false;
  }

  if (email.includes(' ') || email.includes('\t') || email.includes('\n') || email.includes('\r')) {
    return false;
  }

  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@') || atIndex === email.length - 1) {
    return false;
  }

  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);

  if (localPart.length > MAX_LOCAL_PART_LENGTH) {
    return false;
  }

  if (
    domainPart.length < 3 ||
    !domainPart.includes('.') ||
    domainPart.startsWith('.') ||
    domainPart.endsWith('.') ||
    domainPart.includes('..')
  ) {
    return false;
  }

  for (const char of domainPart) {
    const isLetter = (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
    const isNumber = char >= '0' && char <= '9';
    if (!isLetter && !isNumber && char !== '-' && char !== '.') {
      return false;
    }
  }

  return true;
}
