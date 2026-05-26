import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePortfolio } from '@/context/PortfolioContext';
import { aggregateAcrossAccounts } from '@/utils/aggregate';
import { colorAt, colors, radius, spacing } from '@/theme';
import { formatCurrency, formatPercent } from '@/utils/format';
import { DonutChart } from '@/components/DonutChart';

export const ConsolidatedScreen = () => {
  const { state } = usePortfolio();
  const [base, setBase] = useState('KRW');

  const { totalBase, holdings } = useMemo(
    () => aggregateAcrossAccounts(state.accounts, base),
    [state.accounts, base],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>모든 계좌 통합</Text>
          <View style={styles.currencyToggle}>
            {['KRW', 'USD'].map((c) => (
              <Pressable
                key={c}
                onPress={() => setBase(c)}
                style={[styles.currencyBtn, base === c && styles.currencyBtnActive]}
              >
                <Text
                  style={[styles.currencyText, base === c && styles.currencyTextActive]}
                >
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.summaryCard}>
          <DonutChart
            size={200}
            thickness={26}
            data={holdings.map((h, i) => ({ value: h.percent, color: colorAt(i) }))}
          />
          <View style={styles.summaryRight}>
            <Text style={styles.totalLabel}>총 자산 ({base} 환산)</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalBase, base)}</Text>
            <Text style={styles.subInfo}>
              계좌 {state.accounts.length}개 · 항목 {holdings.length}개
            </Text>
            <Text style={styles.fxNote}>* USD→KRW 환율은 1,350 고정값으로 환산됩니다.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>비중 상세</Text>
        {holdings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              아직 데이터가 없습니다. “계좌” 탭에서 계좌와 항목을 추가해주세요.
            </Text>
          </View>
        ) : (
          holdings.map((h, i) => (
            <View key={h.key} style={styles.row}>
              <View style={[styles.colorDot, { backgroundColor: colorAt(i) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {h.name}
                </Text>
                <Text style={styles.sub} numberOfLines={2}>
                  {h.symbol ? `${h.symbol}  ·  ` : ''}
                  {h.perAccount
                    .map((p) => `${p.accountName} ${formatCurrency(p.value, base)}`)
                    .join(' · ')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.percent}>{formatPercent(h.percent)}</Text>
                <Text style={styles.value}>{formatCurrency(h.totalValue, base)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  currencyToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  currencyBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  currencyBtnActive: { backgroundColor: colors.primary },
  currencyText: { color: colors.textDim, fontWeight: '600' },
  currencyTextActive: { color: '#fff' },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRight: { flex: 1, marginLeft: spacing.lg },
  totalLabel: { color: colors.textDim, fontSize: 13 },
  totalValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: spacing.xs },
  subInfo: { color: colors.textDim, fontSize: 12, marginTop: spacing.sm },
  fxNote: { color: colors.textDim, fontSize: 11, marginTop: spacing.xs },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.md },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: { color: colors.textDim, textAlign: 'center' },
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
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  percent: { color: colors.text, fontSize: 15, fontWeight: '700' },
  value: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
