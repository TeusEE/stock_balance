import AsyncStorage from '@react-native-async-storage/async-storage';

// 기기 로컬 모더레이션 상태.
// - 차단(blocked authors): v3.0 에서는 기록만 하고, v3.1 공개 피드/순위판에서 필터링에 사용한다.
// - 신고(reported shares): 같은 공유물 중복 신고를 막기 위한 로컬 표시.
const BLOCKED_KEY = '@stockbalance/blockedAuthors';
const REPORTED_KEY = '@stockbalance/reportedShares';

async function readSet(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

async function writeSet(key, set) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // 저장 실패는 무시 (로컬 편의 기능)
  }
}

export async function getBlockedAuthors() {
  return [...(await readSet(BLOCKED_KEY))];
}

export async function isAuthorBlocked(userId) {
  if (!userId) return false;
  return (await readSet(BLOCKED_KEY)).has(userId);
}

export async function blockAuthor(userId) {
  if (!userId) return;
  const s = await readSet(BLOCKED_KEY);
  s.add(userId);
  await writeSet(BLOCKED_KEY, s);
}

export async function isShareReported(id) {
  if (!id) return false;
  return (await readSet(REPORTED_KEY)).has(id);
}

export async function markShareReported(id) {
  if (!id) return;
  const s = await readSet(REPORTED_KEY);
  s.add(id);
  await writeSet(REPORTED_KEY, s);
}
