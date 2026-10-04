import { isValidOptionalEmail } from './pdfEmail';

describe('isValidOptionalEmail', () => {
  it('accepts an empty field and normal addresses', () => {
    expect(isValidOptionalEmail('')).toBe(true);
    expect(isValidOptionalEmail('   ')).toBe(true);
    expect(isValidOptionalEmail('martin@example.com')).toBe(true);
    expect(isValidOptionalEmail(' a.b+c@sub.example.eu ')).toBe(true);
  });

  it('rejects incomplete or malformed addresses', () => {
    expect(isValidOptionalEmail('martin')).toBe(false);
    expect(isValidOptionalEmail('martin@example')).toBe(false);
    expect(isValidOptionalEmail('a b@example.com')).toBe(false);
    expect(isValidOptionalEmail('a@@example.com')).toBe(false);
    expect(isValidOptionalEmail(`${'a'.repeat(250)}@example.com`)).toBe(false);
  });
});
