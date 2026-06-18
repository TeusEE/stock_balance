// Supabase v3 스키마/RPC 라이브 스모크 테스트
//   node scripts/check-supabase.js
// app.json 의 expo.extra.{supabaseUrl,supabaseAnonKey} 를 사용해
// 등록→게시→토큰조회→비번오류→정리 흐름을 실제 프로젝트에 대해 검증한다.
const { createClient } = require('@supabase/supabase-js');
const app = require('../app.json');

const { supabaseUrl, supabaseAnonKey } = app.expo.extra;
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const NICK = '__smoketest__';
const PW = 'smoke-pw-1234';

function ok(label, cond, extra) {
  console.log(`${cond ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

(async () => {
  // 1) 등록 또는 검증
  const a = await supabase.rpc('auth_nickname', { p_nickname: NICK, p_password: PW });
  ok('auth_nickname (등록/검증) → user_id', !a.error && !!a.data, a.error?.message);
  const uid = a.data;

  // 2) 게시
  const pub = await supabase.rpc('publish_portfolio', {
    p_nickname: NICK,
    p_password: PW,
    p_title: '스모크 포트폴리오',
    p_base: 'KRW',
    p_holdings: [
      { name: '삼성전자', symbol: '005930.KS', category: '국내주식', targetPercent: 60 },
      { name: '애플', symbol: 'AAPL', category: '해외주식', targetPercent: 40 },
    ],
    p_visibility: 'unlisted',
  });
  ok('publish_portfolio → row', !pub.error && !!pub.data?.id, pub.error?.message);
  const row = pub.data;

  // 3) 토큰으로 조회
  const got = await supabase.rpc('get_shared_by_token', { p_token: row?.share_token });
  const fetched = Array.isArray(got.data) ? got.data[0] : got.data;
  ok('get_shared_by_token → 동일 행', !got.error && fetched?.id === row?.id, got.error?.message);
  const hjson = JSON.stringify(fetched?.holdings ?? null);
  ok('holdings 비중 보존 + 민감정보 없음',
    hjson.includes('targetPercent') && !hjson.includes('currentPrice'));

  // 4) public_profiles 노출(별명만, 해시 없음)
  const prof = await supabase.from('public_profiles').select('*').ilike('nickname', NICK).limit(1);
  ok('public_profiles 조회', !prof.error && prof.data?.length === 1, prof.error?.message);
  ok('public_profiles 에 password_hash 미노출',
    prof.data?.[0] && !('password_hash' in prof.data[0]));

  // 5) 비밀번호 오류는 거부되어야 함
  const bad = await supabase.rpc('auth_nickname', { p_nickname: NICK, p_password: 'wrong-pw' });
  ok('틀린 비밀번호 → 거부(invalid_credentials)', !!bad.error, bad.error?.message ?? '거부 안 됨');

  // 6) anon 이 app_users 직접 읽기 차단(RLS)
  const direct = await supabase.from('app_users').select('*').limit(1);
  ok('app_users 직접 SELECT 차단(빈 결과/거부)', direct.error || (direct.data?.length ?? 0) === 0,
    direct.error?.message);

  // 6.5) 익명 신고 (별명/비번 없이)
  const rep = await supabase.rpc('report_shared', { p_id: row?.id, p_reason: '스모크 테스트' });
  ok('report_shared (익명 신고)', !rep.error, rep.error ? `${rep.error.message} — report_shared 미배포면 마이그레이션 실행 필요` : '');

  // 7) 정리: 게시물 삭제(테스트 유저는 남음, 신고는 cascade 삭제)
  const del = await supabase.rpc('unpublish_portfolio', { p_nickname: NICK, p_password: PW, p_id: row?.id });
  ok('unpublish_portfolio (정리)', !del.error, del.error?.message);

  console.log('\nuser_id:', uid);
})();
