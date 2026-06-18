import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/services/supabase';

const AuthContext = createContext(null);

/**
 * 별명+비밀번호 인증 컨텍스트 (Supabase Auth 미사용).
 *
 * - `ensureUser(nickname, password)` 는 `auth_nickname` RPC 를 호출해
 *   없는 별명이면 등록, 있는 별명이면 비밀번호를 검증한다.
 * - 비밀번호는 세션 메모리(state)에만 보관하고 영속 저장하지 않는다(평문 보관 지양).
 *   앱 재시작 시 쓰기 동작 전에 다시 입력받는다.
 */
export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(null);
  const [nickname, setNickname] = useState(null);
  const [credentials, setCredentials] = useState(null); // { nickname, password } (메모리 한정)

  const ensureUser = useCallback(async (nick, password) => {
    const trimmed = String(nick ?? '').trim();
    const { data, error } = await supabase.rpc('auth_nickname', {
      p_nickname: trimmed,
      p_password: password,
    });
    if (error) {
      // invalid_credentials = 별명 선점(다른 사람) 또는 비밀번호 오류
      throw new Error(
        /invalid_credentials/i.test(error.message || '')
          ? '이미 사용 중인 별명이거나 비밀번호가 올바르지 않습니다.'
          : error.message || '인증에 실패했습니다.',
      );
    }
    setUserId(data);
    setNickname(trimmed);
    setCredentials({ nickname: trimmed, password });
    return data;
  }, []);

  const checkNicknameAvailable = useCallback(async (nick) => {
    const trimmed = String(nick ?? '').trim();
    if (!trimmed) return false;
    const { data, error } = await supabase
      .from('public_profiles')
      .select('id')
      .ilike('nickname', trimmed)
      .limit(1);
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) === 0;
  }, []);

  const signOut = useCallback(() => {
    setUserId(null);
    setNickname(null);
    setCredentials(null);
  }, []);

  const value = useMemo(
    () => ({
      userId,
      nickname,
      credentials,
      isSignedIn: !!userId,
      ensureUser,
      checkNicknameAvailable,
      signOut,
    }),
    [userId, nickname, credentials, ensureUser, checkNicknameAvailable, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
