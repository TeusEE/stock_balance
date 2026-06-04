import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { formatPercent } from '@/utils/format';

const REASON_LABEL = {
  'no-symbol': '심볼 없음 (수동/현금)',
  'no-data': '6개월 데이터 없음',
  'zero-weight': '비중 0',
};

/**
 * v2.1 — 리밸런싱 주기 프리셋. key 는 화면(runBacktest)이 만드는
 * results 객체의 키와 1:1 로 대응한다. intervalDays 는 영업일 기준.
 */
export const BACKTEST_MODES = [
  { key: 'hold', label: '보유', intervalDays: null },
  { key: 'weekly', label: '매주', intervalDays: 5 },
  { key: 'monthly', label: '매월', intervalDays: 21 },
  { key: 'quarterly', label: '매분기', intervalDays: 63 },
];

function returnColor(value) {
  if (value == null) return colors.textDim;
  if (value > 0) return colors.success;
  if (value < 0) return colors.danger;
  return colors.textDim;
}

function signedPercent(value) {
  if (value == null) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * 6개월 백테스트 결과 모달 (보유 + N일 주기 리밸런싱).
 *
 * 캐시 정책: 모드별 결과(`results` = { hold, weekly, monthly, quarterly })는
 * 부모(화면) 상태로 보관되어 모달이 닫혔다 다시 열려도 그대로 유지된다.
 * 사용자가 "새로고침"을 누를 때만 onRefresh 호출 → 부모가 fetch + results 갱신.
 * 모드 전환은 캐시된 결과 간 전환이라 네트워크 호출이 없다.
 */
export const BacktestModal = ({
  visible,
  onClose,
  title,
  results,
  loading,
  error,
  onRefresh,
}) => {
  const [modeKey, setModeKey] = useState('hold');
  const mode = BACKTEST_MODES.find((m) => m.key === modeKey) ?? BACKTEST_MODES[0];
  const result = results?.[mode.key];
  const hold = results?.hold;
  const total = result?.totalReturnPercent;

  // 보유 대비 차이 (%p) — 리밸런싱 모드에서만
  const diffVsHold =
    mode.key !== 'hold' && total != null && hold?.totalReturnPercent != null
      ? total - hold.totalReturnPercent
      : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title || '6개월 백테스트'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>

          {/* 리밸런싱 주기 세그먼트 */}
          <View style={styles.modeRow}>
            {BACKTEST_MODES.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => setModeKey(m.key)}
                style={[styles.modeBtn, modeKey === m.key && styles.modeBtnActive]}
              >
                <Text
                  style={[styles.modeText, modeKey === m.key && styles.modeTextActive]}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {/* 총 수익률 카드 */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>
                {mode.key === 'hold'
                  ? '6개월 보유 수익률'
                  : `6개월 ${mode.label} 리밸런싱 수익률`}
              </Text>
              {loading && !result ? (
                <View style={{ paddingVertical: spacing.lg }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <Text style={[styles.totalValue, { color: returnColor(total) }]}>
                  {total == null ? '계산 불가' : signedPercent(total)}
                </Text>
              )}
              {diffVsHold != null && (
                <Text style={[styles.diffText, { color: returnColor(diffVsHold) }]}>
                  보유 대비 {diffVsHold > 0 ? '+' : ''}
                  {diffVsHold.toFixed(2)}%p
                  {result?.rebalanceCount != null
                    ? ` · 리밸런싱 ${result.rebalanceCount}회`
                    : ''}
                </Text>
              )}
              {result && (
                <Text style={styles.totalSub}>
                  포함 {result.included.length}개 · 제외 {result.excluded.length}개
                </Text>
              )}
              <Pressable
                style={[styles.refreshBtn, loading && styles.refreshBtnDisabled]}
                onPress={onRefresh}
                disabled={loading}
              >
                <Text style={styles.refreshBtnText}>
                  {loading ? '불러오는 중…' : '새로고침'}
                </Text>
              </Pressable>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            {/* 포함 종목 */}
            {result && result.included.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>포함 종목</Text>
                {result.included.map((it) => (
                  <View key={it.symbol} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {it.name}
                      </Text>
                      <Text style={styles.itemSub} numberOfLines={1}>
                        {it.symbol}  ·  정규화 비중 {formatPercent(it.normalizedWeight)}
                      </Text>
                    </View>
                    <Text style={[styles.itemReturn, { color: returnColor(it.stockReturnPercent) }]}>
                      {signedPercent(it.stockReturnPercent)}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* 제외 종목 */}
            {result && result.excluded.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.warning }]}>
                  제외 {result.excluded.length}개
                </Text>
                {result.excluded.map((it, i) => (
                  <View key={`${it.symbol ?? 'none'}-${i}`} style={styles.excludedRow}>
                    <Text style={styles.excludedName} numberOfLines={1}>
                      {it.name}
                      {it.symbol ? `  (${it.symbol})` : ''}
                    </Text>
                    <Text style={styles.excludedReason}>
                      {REASON_LABEL[it.reason] ?? it.reason}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* 빈 상태 */}
            {result && result.included.length === 0 && result.excluded.length === 0 && (
              <Text style={styles.emptyText}>
                백테스트할 종목이 없습니다.
              </Text>
            )}

            {result && (
              <Text style={styles.note}>
                * 종목 자기 통화 기준 수익률입니다. 환차익·거래비용·세금은 반영되지
                않으며, 배당은 조정 종가 제공 시에만 반영됩니다. 리밸런싱은 영업일
                기준·소수 주식 허용의 이상적 시뮬레이션입니다.
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', flex: 1, marginRight: spacing.md },
  close: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },

  modeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeBtnActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  modeText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  modeTextActive: { color: colors.text },
  diffText: { fontSize: 13, fontWeight: '600' },

  totalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.xs,
  },
  totalLabel: { color: colors.textDim, fontSize: 13 },
  totalValue: { fontSize: 36, fontWeight: '800', marginTop: spacing.xs },
  totalSub: { color: colors.textDim, fontSize: 12 },
  refreshBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshBtnDisabled: { opacity: 0.6 },
  refreshBtnText: { color: colors.text, fontSize: 13, fontWeight: '600' },

  error: { color: colors.danger, fontSize: 13 },

  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  itemName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  itemSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  itemReturn: { fontSize: 15, fontWeight: '700' },

  excludedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  excludedName: { color: colors.textDim, fontSize: 13, flex: 1, marginRight: spacing.sm },
  excludedReason: { color: colors.warning, fontSize: 12, fontWeight: '600' },

  emptyText: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  note: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
});
