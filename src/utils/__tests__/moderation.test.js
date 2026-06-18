import { containsBannedWord, normalizeForMatch } from '../moderation';

describe('moderation.containsBannedWord', () => {
  test('깨끗한 텍스트는 false', () => {
    expect(containsBannedWord('든든한 배당 포트폴리오')).toBe(false);
    expect(containsBannedWord('My S&P 500 plan')).toBe(false);
    expect(containsBannedWord('')).toBe(false);
    expect(containsBannedWord(null)).toBe(false);
  });

  test('금지어 포함 시 true (대소문자/공백 우회 차단)', () => {
    expect(containsBannedWord('병신같은 종목')).toBe(true);
    expect(containsBannedWord('F U C K')).toBe(true);
    expect(containsBannedWord('SHIT coin')).toBe(true);
  });

  test('normalizeForMatch: 소문자 + 공백 제거', () => {
    expect(normalizeForMatch('  Hello World ')).toBe('helloworld');
  });
});
