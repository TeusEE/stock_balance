import 'react-native-url-polyfill/auto'; // RN 의 fetch/URL 폴리필 (최상단 필수)
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = extra.supabaseUrl;
const supabaseAnonKey = extra.supabaseAnonKey;

function missingSupabaseConfig() {
  throw new Error('Supabase 설정이 없습니다. app.json expo.extra.supabaseUrl / supabaseAnonKey 를 확인해주세요.');
}

/**
 * 공유/순위판용 Supabase 클라이언트(싱글톤).
 *
 * 인증은 Supabase Auth(GoTrue)를 쓰지 않고 별명+비밀번호를 RPC 로 검증하므로,
 * 세션 관련 옵션은 모두 끈다. 클라이언트는 `.rpc()` 와 공개 `.from().select()` 에만 쓴다.
 */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : {
      rpc: missingSupabaseConfig,
      from: missingSupabaseConfig,
    };

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
