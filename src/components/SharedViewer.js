import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DonutChart } from '@/components/DonutChart';
import { colorAt, colors, radius, spacing } from '@/theme';
import { formatPercent } from '@/utils/format';

/**
 * 공유된 포트폴리오를 읽기 전용으로 렌더합니다. (비중만 — 금액/수량 없음)
 *
 * @param payload { title, base_currency, nickname?, holdings: [{name, symbol, category, targetPercent}], return_6m? }
 */
export const SharedViewer = ({ payload }) => {
  if (!payload) return null;
  const holdings = Array.isArray(payload.holdings) ? payload.holdings : [];
  const chartData = holdings.map((h, i) => ({
    value: Number(h.targetPercent) || 0,
    color: colorAt(i),
  }));

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>{payload.title || '공유 포트폴리오'}</Text>
      {payload.nickname ? <Text style={styles.author}>by {payload.nickname}</Text> : null}

      <View style={styles.card}>
        <DonutChart size={200} thickness={26} data={chartData} />
        <View style={styles.right}>
          <Text style={styles.metaLabel}>구성 종목</Text>
          <Text style={styles.metaValue}>{holdings.length}개</Text>
          {payload.return_6m != null ? (
            <>
              <Text style={[styles.metaLabel, { marginTop: spacing.sm }]}>6개월 수익률</Text>
              <Text style={styles.metaValue}>{formatPercent(payload.return_6m)}</Text>
            </>
          ) : null}
          <Text style={styles.baseNote}>기준 통화 {payload.base_currency || 'KRW'}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>비중 상세</Text>
      {holdings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>구성 종목이 없습니다.</Text>
        </View>
      ) : (
        holdings.map((h, i) => (
          <View key={`${h.symbol ?? h.name}-${i}`} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: colorAt(i) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{h.name}</Text>
              {h.symbol ? <Text style={styles.sub} numberOfLines={1}>{h.symbol}</Text> : null}
            </View>
            <Text style={styles.percent}>{formatPercent(Number(h.targetPercent) || 0)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  author: { color: colors.textDim, fontSize: 13, marginTop: 2 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  right: { flex: 1, marginLeft: spacing.lg },
  metaLabel: { color: colors.textDim, fontSize: 13 },
  metaValue: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: spacing.xs },
  baseNote: { color: colors.textDim, fontSize: 11, marginTop: spacing.sm },

  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.md },
  emptyCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.textDim },

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
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  percent: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
