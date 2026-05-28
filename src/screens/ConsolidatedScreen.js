import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePortfolio } from '@/context/PortfolioContext';
import { aggregateAcrossAccounts, aggregateByCategory } from '@/utils/aggregate';
import { CATEGORIES, categoryColor, categoryLabel } from '@/constants/categories';
import { colorAt, colors, radius, spacing } from '@/theme';
import { formatCurrency, formatPercent } from '@/utils/format';
import { DonutChart } from '@/components/DonutChart';
import { ExportButtons } from '@/components/ExportButtons';
import { buildConsolidatedExport } from '@/utils/exportData';

export const ConsolidatedScreen = () => {
  const { state } = usePortfolio();
  const [base, setBase] = useState('KRW');
  const [viewMode, setViewMode] = useState('symbol'); // 'symbol' | 'group'
  const [expandedGroups, setExpandedGroups] = useState({});

  const { totalBase, holdings } = useMemo(
    () => aggregateAcrossAccounts(state.accounts, base),
    [state.accounts, base],
  );

  const { groups } = useMemo(
    () => aggregateByCategory(state.accounts, base),
    [state.accounts, base],
  );

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const chartData = viewMode === 'symbol'
    ? holdings.map((h, i) => ({ value: h.percent, color: colorAt(i) }))
    : groups.map((g) => ({ value: g.percent, color: categoryColor(g.category) }));

  const itemCount = viewMode === 'symbol' ? holdings.length : groups.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>모든 계좌 통합</Text>
          <View style={styles.currencyToggle}>
            {['KRW', 'USD'].map((c) => (
              <Pressable
                key={c}
                onPress={() => setBase(c)}
                style={[styles.currencyBtn, base === c && styles.currencyBtnActive]}
              >
                <Text style={[styles.currencyText, base === c && styles.currencyTextActive]}>
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 종목별 / 그룹별 토글 */}
        <View style={styles.viewToggle}>
          {[
            { key: 'symbol', label: '종목별' },
            { key: 'group', label: '그룹별' },
          ].map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setViewMode(opt.key)}
              style={[styles.viewToggleBtn, viewMode === opt.key && styles.viewToggleBtnActive]}
            >
              <Text style={[styles.viewToggleText, viewMode === opt.key && styles.viewToggleTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 요약 카드 */}
        <View style={styles.summaryCard}>
          <DonutChart size={200} thickness={26} data={chartData} />
          <View style={styles.summaryRight}>
            <Text style={styles.totalLabel}>총 자산 ({base} 환산)</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalBase, base)}</Text>
            <Text style={styles.subInfo}>
              계좌 {state.accounts.length}개 · {viewMode === 'symbol' ? `항목 ${holdings.length}개` : `그룹 ${groups.length}개`}
            </Text>
            <Text style={styles.fxNote}>* USD→KRW 환율은 1,350 고정값으로 환산됩니다.</Text>
          </View>
        </View>

        {/* 그룹별 범례 (그룹 모드일 때) */}
        {viewMode === 'group' && groups.length > 0 && (
          <View style={styles.legendRow}>
            {CATEGORIES.map((cat) => {
              const active = groups.some((g) => g.category === cat.key);
              return (
                <View key={cat.key} style={[styles.legendItem, !active && styles.legendItemDim]}>
                  <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                  <Text style={[styles.legendText, !active && styles.legendTextDim]}>
                    {cat.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* 비중 상세 */}
        <Text style={styles.sectionTitle}>비중 상세</Text>

        {itemCount === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              아직 데이터가 없습니다. "계좌" 탭에서 계좌와 항목을 추가해주세요.
            </Text>
          </View>
        ) : viewMode === 'symbol' ? (
          /* 종목별 뷰 */
          holdings.map((h, i) => (
            <View key={h.key} style={styles.row}>
              <View style={[styles.colorDot, { backgroundColor: colorAt(i) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{h.name}</Text>
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
        ) : (
          /* 그룹별 뷰 */
          groups.map((g) => {
            const isExpanded = expandedGroups[g.key];
            const catCol = categoryColor(g.category);
            return (
              <View key={g.key}>
                <Pressable
                  onPress={() => toggleGroup(g.key)}
                  style={[styles.groupRow, { borderLeftColor: catCol, borderLeftWidth: 3 }]}
                >
                  <View style={[styles.colorDot, { backgroundColor: catCol, width: 12, height: 12, borderRadius: 6 }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupName}>{categoryLabel(g.category)}</Text>
                    <Text style={styles.sub}>{g.holdings.length}개 종목</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginRight: spacing.xs }}>
                    <Text style={styles.percent}>{formatPercent(g.percent)}</Text>
                    <Text style={styles.value}>{formatCurrency(g.totalValue, base)}</Text>
                  </View>
                  <Text style={[styles.chevron, isExpanded && styles.chevronUp]}>›</Text>
                </Pressable>

                {/* 그룹 내 종목 목록 (펼쳤을 때) */}
                {isExpanded && g.holdings.map((h) => (
                  <View key={`${g.key}-${h.key}-${h.accountName}`} style={styles.subRow}>
                    <View style={[styles.colorDotSmall, { backgroundColor: catCol, opacity: 0.6 }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subRowName} numberOfLines={1}>{h.name}</Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {h.symbol ? `${h.symbol}  ·  ` : ''}{h.accountName}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.subPercent}>{formatPercent(h.percent)}</Text>
                      <Text style={styles.value}>{formatCurrency(h.value, base)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })
        )}

        {holdings.length > 0 && (
          <View style={styles.exportSection}>
            <Text style={styles.sectionTitle}>내보내기</Text>
            <ExportButtons
              label="통합 포트폴리오"
              getData={() =>
                buildConsolidatedExport({
                  baseCurrency: base,
                  totalBase,
                  holdings,
                  accountsCount: state.accounts.length,
                })
              }
            />
          </View>
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

  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  viewToggleBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  viewToggleBtnActive: { backgroundColor: colors.primary },
  viewToggleText: { color: colors.textDim, fontWeight: '600', fontSize: 14 },
  viewToggleTextActive: { color: '#fff' },

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

  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendItemDim: { opacity: 0.35 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  legendTextDim: { color: colors.textDim },

  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.md },

  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: { color: colors.textDim, textAlign: 'center' },

  /* 종목별 row */
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

  /* 그룹별 row */
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  groupName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  chevron: {
    color: colors.textDim,
    fontSize: 20,
    fontWeight: '300',
    transform: [{ rotate: '90deg' }],
  },
  chevronUp: {
    transform: [{ rotate: '-90deg' }],
  },

  /* 그룹 내 항목 */
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: 2,
    marginLeft: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    opacity: 0.9,
  },
  colorDotSmall: { width: 8, height: 8, borderRadius: 4 },
  subRowName: { color: colors.text, fontSize: 14, fontWeight: '500' },
  subPercent: { color: colors.text, fontSize: 13, fontWeight: '600' },

  exportSection: { marginTop: spacing.md, gap: spacing.sm },
});
