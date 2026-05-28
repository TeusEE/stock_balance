import { computeItemRebalance, computeAccountRebalance } from '../rebalance';

describe('computeItemRebalance — 보유 수량 미입력 (기존 동작)', () => {
  test('5000원 예산, 300원 종목 → 권장 16주, delta는 그대로 16', () => {
    const r = computeItemRebalance(10000, 50, 300, 'KRW', 'KRW');
    expect(r.shares).toBe(16);
    expect(r.actualValue).toBe(4800);
    expect(r.remaining).toBe(200);
    expect(r.ownedShares).toBeNull();
    expect(r.delta).toBe(16); // owned=0 으로 간주
    expect(r.additionalCost).toBe(4800);
  });

  test('가격 정보가 없으면 hasPrice=false 이고 보유는 null', () => {
    const r = computeItemRebalance(10000, 50, undefined, undefined, 'KRW');
    expect(r.hasPrice).toBe(false);
    expect(r.ownedShares).toBeNull();
    expect(r.shares).toBe(0);
  });
});

describe('computeItemRebalance — 보유 수량 입력 (신규)', () => {
  test('보유가 권장보다 적으면 추가 매수 필요 (delta > 0)', () => {
    const r = computeItemRebalance(10000, 50, 300, 'KRW', 'KRW', 1350, 10);
    expect(r.shares).toBe(16);
    expect(r.ownedShares).toBe(10);
    expect(r.delta).toBe(6); // 16 - 10
    expect(r.additionalCost).toBe(1800); // 6 * 300
    expect(r.ownedValue).toBe(3000); // 10 * 300
  });

  test('보유가 권장보다 많으면 매도 필요 (delta < 0)', () => {
    const r = computeItemRebalance(10000, 50, 300, 'KRW', 'KRW', 1350, 20);
    expect(r.shares).toBe(16);
    expect(r.ownedShares).toBe(20);
    expect(r.delta).toBe(-4);
    expect(r.additionalCost).toBe(-1200);
  });

  test('보유가 권장과 같으면 목표 달성 (delta == 0)', () => {
    const r = computeItemRebalance(10000, 50, 300, 'KRW', 'KRW', 1350, 16);
    expect(r.delta).toBe(0);
    expect(r.additionalCost).toBe(0);
  });

  test('보유 0주는 명시 입력으로 인정 (null 아님)', () => {
    const r = computeItemRebalance(10000, 50, 300, 'KRW', 'KRW', 1350, 0);
    expect(r.ownedShares).toBe(0);
    expect(r.delta).toBe(16);
  });

  test('잘못된 값(음수)은 무시되어 null 처리', () => {
    const r = computeItemRebalance(10000, 50, 300, 'KRW', 'KRW', 1350, -5);
    expect(r.ownedShares).toBeNull();
  });
});

describe('computeAccountRebalance — totalAdditionalCost 합계', () => {
  test('보유가 입력된 항목과 안 된 항목이 섞여 있어도 합산이 맞다', () => {
    const account = {
      id: 'a',
      name: '',
      totalAmount: 20000,
      currency: 'KRW',
      items: [
        // 목표 50% = 10000, 300원 → 권장 33주, 보유 30주 → delta +3 → +900
        { id: '1', name: 'A', targetPercent: 50, currentPrice: 300, currency: 'KRW', manual: true, ownedShares: 30 },
        // 목표 50% = 10000, 300원 → 권장 33주, 보유 미입력 → delta +33 → +9900
        { id: '2', name: 'B', targetPercent: 50, currentPrice: 300, currency: 'KRW', manual: true },
      ],
    };
    const summary = computeAccountRebalance(account);
    expect(summary.totalAdditionalCost).toBe(900 + 9900);
  });
});
