import { suggestNickname, normalizeNickname, isValidNickname } from '../nickname';

describe('nickname utils', () => {
  test('normalizeNickname: 앞뒤 공백 제거 + 소문자화', () => {
    expect(normalizeNickname('  HelLo  ')).toBe('hello');
    expect(normalizeNickname('투자왕')).toBe('투자왕');
    expect(normalizeNickname(null)).toBe('');
    expect(normalizeNickname(undefined)).toBe('');
  });

  test('isValidNickname: 1~20자(공백 제외)', () => {
    expect(isValidNickname('a')).toBe(true);
    expect(isValidNickname('a'.repeat(20))).toBe(true);
    expect(isValidNickname('투자왕')).toBe(true);
    expect(isValidNickname('')).toBe(false);
    expect(isValidNickname('   ')).toBe(false);
    expect(isValidNickname('a'.repeat(21))).toBe(false);
  });

  test('suggestNickname: 항상 유효한 한글+숫자 별명을 생성', () => {
    for (let i = 0; i < 50; i++) {
      const n = suggestNickname();
      expect(isValidNickname(n)).toBe(true);
      expect(n).toMatch(/^[가-힣]+\d{1,2}$/);
    }
  });
});
