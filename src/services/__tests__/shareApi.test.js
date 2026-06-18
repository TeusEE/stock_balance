jest.mock('../supabase', () => ({
  supabase: { rpc: jest.fn() },
  isSupabaseConfigured: true,
}));

import { supabase } from '../supabase';
import { publishPortfolio, getSharedByToken } from '../shareApi';

describe('shareApi.publishPortfolio', () => {
  beforeEach(() => {
    supabase.rpc.mockReset();
  });

  test('publish_portfolio RPC 에 별명+비번과 정제된 비중만 전달한다', async () => {
    supabase.rpc.mockResolvedValue({ data: { id: 'p1', share_token: 't1' }, error: null });

    const result = await publishPortfolio({
      nickname: '투자왕',
      password: 'secret123',
      title: '내 포트폴리오',
      baseCurrency: 'KRW',
      visibility: 'unlisted',
      holdings: [
        { name: '삼성전자', symbol: '005930.KS', category: '국내주식', targetPercent: 40, currentPrice: 70000, ownedShares: 10 },
        { name: '현금', targetPercent: 60 },
      ],
    });

    expect(result).toEqual({ id: 'p1', share_token: 't1' });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    const [fn, params] = supabase.rpc.mock.calls[0];
    expect(fn).toBe('publish_portfolio');
    expect(params.p_nickname).toBe('투자왕');
    expect(params.p_password).toBe('secret123');
    expect(params.p_visibility).toBe('unlisted');

    // 민감 정보가 holdings 페이로드에 절대 없어야 한다
    const json = JSON.stringify(params.p_holdings);
    for (const forbidden of ['currentPrice', 'ownedShares', 'totalAmount']) {
      expect(json).not.toContain(forbidden);
    }
    expect(params.p_holdings).toEqual([
      { name: '삼성전자', symbol: '005930.KS', category: '국내주식', targetPercent: 40 },
      { name: '현금', symbol: null, category: null, targetPercent: 60 },
    ]);
  });

  test('RPC 오류는 throw 한다', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'invalid_credentials' } });
    await expect(
      publishPortfolio({ nickname: 'x', password: 'y', title: 't', baseCurrency: 'KRW', holdings: [] }),
    ).rejects.toThrow('invalid_credentials');
  });
});

describe('shareApi.getSharedByToken', () => {
  beforeEach(() => supabase.rpc.mockReset());

  test('배열 응답에서 첫 행을 반환', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ id: 'p1' }], error: null });
    expect(await getSharedByToken('tok')).toEqual({ id: 'p1' });
  });

  test('없으면 null', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });
    expect(await getSharedByToken('tok')).toBeNull();
  });
});
