import { supabase } from './supabase';
import { toSharePayload } from '@/utils/shareSerialize';

function unwrap({ data, error }) {
  if (error) throw new Error(error.message || String(error));
  return data;
}

/**
 * 포트폴리오 게시(공유). 별명+비밀번호를 RPC 로 검증한 뒤 INSERT 한다.
 * 페이로드는 toSharePayload 로 비중만 추출되어 금액/수량/현재가는 절대 전송되지 않는다.
 *
 * @returns 생성된 shared_portfolios row ({ id, share_token, ... })
 */
export async function publishPortfolio({ nickname, password, title, baseCurrency, holdings, visibility = 'private' }) {
  const payload = toSharePayload({ title, baseCurrency, holdings });
  return unwrap(
    await supabase.rpc('publish_portfolio', {
      p_nickname: nickname,
      p_password: password,
      p_title: payload.title,
      p_base: payload.base_currency,
      p_holdings: payload.holdings,
      p_visibility: visibility,
    }),
  );
}

/** 기존 공유물 수정(본인만). */
export async function updatePortfolio({ nickname, password, id, title, baseCurrency, holdings, visibility }) {
  const payload = toSharePayload({ title, baseCurrency, holdings });
  return unwrap(
    await supabase.rpc('update_portfolio', {
      p_nickname: nickname,
      p_password: password,
      p_id: id,
      p_title: payload.title,
      p_holdings: payload.holdings,
      p_visibility: visibility ?? null,
    }),
  );
}

/** 공유 취소(삭제, 본인만). */
export async function unpublishPortfolio({ nickname, password, id }) {
  return unwrap(
    await supabase.rpc('unpublish_portfolio', { p_nickname: nickname, p_password: password, p_id: id }),
  );
}

/** 링크 공유 토큰으로 1건 조회(공개 목록엔 안 잡힘). */
export async function getSharedByToken(token) {
  const rows = unwrap(await supabase.rpc('get_shared_by_token', { p_token: token }));
  if (Array.isArray(rows)) return rows[0] ?? null;
  return rows ?? null;
}

/** 신고 (UGC 1.2). */
export async function reportPortfolio({ nickname, password, id, reason }) {
  return unwrap(
    await supabase.rpc('report_portfolio', {
      p_nickname: nickname,
      p_password: password,
      p_id: id,
      p_reason: reason ?? null,
    }),
  );
}

/** 사용자 차단 (UGC 1.2). */
export async function blockUser({ nickname, password, blocked }) {
  return unwrap(
    await supabase.rpc('block_user', { p_nickname: nickname, p_password: password, p_blocked: blocked }),
  );
}
