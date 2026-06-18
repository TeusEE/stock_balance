import 'react-native-url-polyfill/auto'; // RN 의 fetch/URL 폴리필 (최상단 필수)
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = extra.supabaseUrl;
const supabaseAnonKey = extra.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  // 키가 없으면 공유 기능이 동작하지 않는다 (app.json 의 expo.extra 확인).
  console.warn('[supabase] supabaseUrl / supabaseAnonKey 가 app.json extra 에 없습니다.');
}

/**
 * 공유/순위판용 Supabase 클라이언트(싱글톤).
 *
 * 인증은 Supabase Auth(GoTrue)를 쓰지 않고 별명+비밀번호를 RPC 로 검증하므로,
 * 세션 관련 옵션은 모두 끈다. 클라이언트는 `.rpc()` 와 공개 `.from().select()` 에만 쓴다.
 */
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
