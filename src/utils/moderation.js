// 별명/제목 1차 비속어 필터 (MVP — 간단 금지어 목록).
// 완벽 차단이 목적이 아니라 명백한 욕설/혐오 표현을 1차로 거르는 용도.
// 운영 중 신고 데이터를 보며 목록을 늘린다.
const BANNED = [
  '시발', '씨발', '씨발', '시발', '병신', '새끼', '개새', '지랄', '좆', '존나',
  '니미', '엿먹', '창녀', '느금', '꺼져',
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'nigger', 'faggot',
];

/** 비교용 정규화: 소문자 + 공백 제거(우회 방지). */
export function normalizeForMatch(text) {
  return String(text ?? '').toLowerCase().replace(/\s+/g, '');
}

/** 금지어 포함 여부. */
export function containsBannedWord(text) {
  const t = normalizeForMatch(text);
  if (!t) return false;
  return BANNED.some((w) => t.includes(w));
}
