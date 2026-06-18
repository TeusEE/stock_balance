// 별명 추천에 쓰는 형용사/명사 풀 (충돌 최소화용, 한글)
const ADJECTIVES = [
  '든든한', '용감한', '똑똑한', '느긋한', '성실한',
  '과감한', '신중한', '부지런한', '침착한', '대담한',
];
const NOUNS = [
  '코끼리', '호랑이', '독수리', '거북이', '여우',
  '부엉이', '다람쥐', '고래', '표범', '두루미',
];

const MIN_LEN = 1;
const MAX_LEN = 20;

/**
 * 랜덤 별명을 추천합니다. (예: "든든한코끼리42")
 * 선점 충돌을 줄이기 위해 형용사+명사+0~99 숫자를 조합합니다.
 */
export function suggestNickname() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100); // 0~99
  return `${a}${n}${num}`;
}

/**
 * 비교/유일성 판단용 정규화. DB 의 `lower(nickname)` 유니크 인덱스와 동일 기준
 * (앞뒤 공백 제거 + 소문자화)을 사용합니다.
 */
export function normalizeNickname(nickname) {
  return String(nickname ?? '').trim().toLowerCase();
}

/**
 * 별명 길이 규칙(1~20자, 공백 제외) 검증. DB check 제약과 동일.
 */
export function isValidNickname(nickname) {
  const t = String(nickname ?? '').trim();
  return t.length >= MIN_LEN && t.length <= MAX_LEN;
}
