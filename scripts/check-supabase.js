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

  // 6.7) v3.1 공개 등재 + 수익률 제출 → 둘러보기 노출/검색
  const sub = await supabase.rpc('submit_return', { p_nickname: NICK, p_password: PW, p_id: row?.id, p_return: 12.34 });
  ok('submit_return (공개 등재)', !sub.error, sub.error ? `${sub.error.message} — v3.1 마이그레이션 실행 필요` : '');

  const top = await supabase.rpc('browse_public', { p_sort: 'return', p_nickname: null, p_symbol: null, p_limit: 5, p_offset: 0 });
  const found = Array.isArray(top.data) ? top.data.find((r) => r.id === row?.id) : null;
  ok('browse_public Top5 에 공개글 노출', !top.error && !!found, top.error ? `${top.error.message} — v3.1 마이그레이션 실행 필요` : '');
  ok('browse_public share_token 미반환', found ? !('share_token' in found) : false);
  ok('browse_public return_6m 반영', found ? Number(found.return_6m) === 12.34 : false);

  const byNick = await supabase.rpc('browse_public', { p_sort: 'return', p_nickname: NICK, p_symbol: null, p_limit: 10, p_offset: 0 });
  ok('browse_public 별명 검색', !byNick.error && (byNick.data ?? []).some((r) => r.id === row?.id), byNick.error?.message);

  const bySymbol = await supabase.rpc('browse_public', { p_sort: 'return', p_nickname: null, p_symbol: 'AAPL', p_limit: 10, p_offset: 0 });
  ok('browse_public 종목 검색(AAPL)', !bySymbol.error && (bySymbol.data ?? []).some((r) => r.id === row?.id), bySymbol.error?.message);

  const byName = await supabase.rpc('browse_public', { p_sort: 'return', p_nickname: null, p_symbol: '삼성', p_limit: 10, p_offset: 0 });
  ok('browse_public 종목명 검색(삼성)', !byName.error && (byName.data ?? []).some((r) => r.id === row?.id), byName.error?.message);

  // 7) 정리: 게시물 삭제(테스트 유저는 남음, 신고는 cascade 삭제)
  const del = await supabase.rpc('unpublish_portfolio', { p_nickname: NICK, p_password: PW, p_id: row?.id });
  ok('unpublish_portfolio (정리)', !del.error, del.error?.message);

  console.log('\nuser_id:', uid);
})();
