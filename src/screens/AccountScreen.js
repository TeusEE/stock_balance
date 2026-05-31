import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePortfolio } from '@/context/PortfolioContext';
import { AccountTabsBar } from '@/components/AccountTabsBar';
import { ItemEditorModal } from '@/components/ItemEditorModal';
import { DonutChart } from '@/components/DonutChart';
import { ExportButtons } from '@/components/ExportButtons';
import { colors, colorAt, radius, spacing } from '@/theme';
import { formatCurrency, formatPercent } from '@/utils/format';
import { isValidAllocation, sumTargetPercent } from '@/utils/aggregate';
import { computeAccountRebalance } from '@/utils/rebalance';
import { buildAccountExport } from '@/utils/exportData';
import { categoryColor, categoryLabel } from '@/constants/categories';
import { fetchExchangeRate, fetchQuotes } from '@/services/stockApi';
import { SCREENSHOT_ENABLED, screenshotEditorOpen } from '@/utils/screenshot';

export const AccountScreen = () => {
  const {
    state,
    addAccount,
    removeAccount,
    renameAccount,
    setTotal,
    setCurrency,
    setActiveAccount,
    addItem,
    updateItem,
    removeItem,
    usdToKrw,
    rateUpdatedAt,
    setExchangeRate,
  } = usePortfolio();

  const activeAccount = useMemo(
    () => state.accounts.find((a) => a.id === state.activeAccountId) ?? state.accounts[0],
    [state.accounts, state.activeAccountId],
  );

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(undefined);
  const [totalInput, setTotalInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const autoRefreshedRef = useRef(new Set());

  useEffect(() => {
    if (activeAccount) {
      setTotalInput(activeAccount.totalAmount ? String(activeAccount.totalAmount) : '');
      setNameInput(activeAccount.name);
    }
  }, [activeAccount?.id]);

  const rebalance = useMemo(
    () => (activeAccount ? computeAccountRebalance(activeAccount) : null),
    [activeAccount],
  );

  const refreshPrices = useCallback(
    async (silent) => {
      if (!activeAccount) return;
      const symbols = activeAccount.items
        .filter((it) => it.symbol)
        .map((it) => it.symbol);
      if (symbols.length === 0) return;
      setRefreshing(true);
      try {
        const [quotes, rate] = await Promise.all([
          fetchQuotes(symbols),
          fetchExchangeRate('USD', 'KRW'),
        ]);
        if (rate != null) setExchangeRate(rate);
        for (const item of activeAccount.items) {
          if (item.symbol && quotes[item.symbol]) {
            const q = quotes[item.symbol];
            updateItem(activeAccount.id, item.id, {
              currentPrice: q.price,
              currency: q.currency,
              lastPriceUpdatedAt: Date.now(),
            });
          }
        }
      } catch (e) {
        if (!silent) {
          Alert.alert('가격 업데이트 실패', '잠시 후 다시 시도해주세요.');
        }
      } finally {
        setRefreshing(false);
      }
    },
    [activeAccount, updateItem, setExchangeRate],
  );

  const handleRefreshPrices = useCallback(() => {
    refreshPrices(false);
  }, [refreshPrices]);

  useEffect(() => {
    if (SCREENSHOT_ENABLED) return; // 스크린샷 모드: 시드 가격 고정 (네트워크 새로고침 안 함)
    if (!activeAccount) return;
    if (autoRefreshedRef.current.has(activeAccount.id)) return;
    const STALE_MS = 5 * 60 * 1000;
    const now = Date.now();
    const hasStale = activeAccount.items.some(
      (it) =>
        !!it.symbol && (!it.lastPriceUpdatedAt || now - it.lastPriceUpdatedAt > STALE_MS),
    );
    if (hasStale) {
      autoRefreshedRef.current.add(activeAccount.id);
      refreshPrices(true);
    }
  }, [activeAccount?.id, refreshPrices]);

  if (state.accounts.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AccountTabsBar accounts={[]} onSelect={setActiveAccount} onAdd={() => addAccount('')} />
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>아직 계좌가 없습니다</Text>
          <Text style={styles.emptyDesc}>
            상단의 “＋ 탭 추가” 버튼으로 새 계좌를 만들어 주세요.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => addAccount('')}>
            <Text style={styles.primaryBtnText}>＋ 계좌 추가</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeAccount || !rebalance) return null;

  const totalPercent = sumTargetPercent(activeAccount.items);
  const valid = isValidAllocation(activeAccount.items);
  const remaining = 100 - totalPercent;

  const handleDeleteAccount = () => {
    Alert.alert('계좌 삭제', `“${activeAccount.name}” 계좌를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => removeAccount(activeAccount.id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AccountTabsBar
        accounts={state.accounts}
        activeId={activeAccount.id}
        onSelect={setActiveAccount}
        onAdd={() => addAccount('')}
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>계좌 이름</Text>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            onBlur={() => {
              const trimmed = nameInput.trim();
              if (trimmed && trimmed !== activeAccount.name) {
                renameAccount(activeAccount.id, trimmed);
              } else {
                setNameInput(activeAccount.name);
              }
            }}
            style={styles.input}
            placeholder="예: 키움 ISA"
            placeholderTextColor={colors.textDim}
          />

          <Text style={styles.label}>총 금액</Text>
          <View style={styles.totalRow}>
            <TextInput
              value={totalInput}
              onChangeText={setTotalInput}
              onBlur={() => {
                const num = parseFloat(totalInput.replace(/[^0-9.]/g, ''));
                setTotal(activeAccount.id, isFinite(num) ? num : 0);
              }}
              style={[styles.input, { flex: 1 }]}
              placeholder="0"
              placeholderTextColor={colors.textDim}
              keyboardType="decimal-pad"
            />
            <View style={styles.currencyToggle}>
              {['KRW', 'USD'].map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCurrency(activeAccount.id, c)}
                  style={[
                    styles.currencyBtn,
                    activeAccount.currency === c && styles.currencyBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.currencyText,
                      activeAccount.currency === c && styles.currencyTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Text style={styles.totalDisplay}>
            {formatCurrency(activeAccount.totalAmount, activeAccount.currency)}
          </Text>
        </View>

        <View style={[styles.card, styles.allocationCard]}>
          <DonutChart
            size={160}
            thickness={20}
            data={activeAccount.items.map((it, i) => ({
              value: it.targetPercent,
              color: colorAt(i),
            }))}
          />
          <View style={{ flex: 1, marginLeft: spacing.lg }}>
            <Text style={styles.allocTitle}>비중 합계</Text>
            <Text
              style={[
                styles.allocPercent,
                { color: valid ? colors.success : colors.warning },
              ]}
            >
              {formatPercent(totalPercent, 2)}
            </Text>
            <Text style={[styles.allocHint, !valid && { color: colors.warning }]}>
              {valid
                ? '합계가 100%로 맞춰져 있습니다.'
                : `남은 비중: ${formatPercent(remaining, 2)}`}
            </Text>
            {activeAccount.items.some((it) => it.symbol) && (
              <>
                <Pressable
                  style={styles.refreshBtn}
                  onPress={handleRefreshPrices}
                  disabled={refreshing}
                >
                  <Text style={styles.refreshBtnText}>
                    {refreshing ? '갱신 중…' : '현재가 새로고침'}
                  </Text>
                </Pressable>
                <Text style={styles.rateNote}>
                  {`USD/KRW  ${usdToKrw.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}원`}
                  {rateUpdatedAt ? `  ·  ${new Date(rateUpdatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '  (기본값)'}
                </Text>
              </>
            )}
          </View>
        </View>

        {activeAccount.items.length > 0 && (
          <View style={styles.rebalanceCard}>
            <View style={styles.rebalanceRow}>
              <Text style={styles.rebalanceLabel}>권장 매수 총액</Text>
              <Text style={styles.rebalanceValue}>
                {formatCurrency(rebalance.totalActual, activeAccount.currency)}
              </Text>
            </View>
            {activeAccount.items.some((it) => it.ownedShares != null) && (
              <View style={styles.rebalanceRow}>
                <Text style={styles.rebalanceLabel}>추가 매수 필요액</Text>
                <Text
                  style={[
                    styles.rebalanceValue,
                    {
                      color:
                        rebalance.totalAdditionalCost > 0
                          ? colors.primary
                          : rebalance.totalAdditionalCost < 0
                          ? colors.warning
                          : colors.success,
                    },
                  ]}
                >
                  {rebalance.totalAdditionalCost > 0 ? '+' : rebalance.totalAdditionalCost < 0 ? '-' : ''}
                  {formatCurrency(Math.abs(rebalance.totalAdditionalCost), activeAccount.currency)}
                </Text>
              </View>
            )}
            <View style={styles.rebalanceRow}>
              <Text style={styles.rebalanceLabel}>예상 현금 잔액</Text>
              <Text
                style={[
                  styles.rebalanceValue,
                  { color: rebalance.totalUnallocated >= 0 ? colors.success : colors.danger },
                ]}
              >
                {formatCurrency(rebalance.totalUnallocated, activeAccount.currency)}
              </Text>
            </View>
            <Text style={styles.rebalanceHint}>
              * 정수 주 단위 매수 기준 — 1주 단위로 내림 계산됩니다.
            </Text>
          </View>
        )}

        <View style={styles.itemsHeader}>
          <Text style={styles.sectionTitle}>구성 항목</Text>
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              setEditingItem(undefined);
              setEditorVisible(true);
            }}
          >
            <Text style={styles.addBtnText}>＋ 항목 추가</Text>
          </Pressable>
        </View>

        {activeAccount.items.length === 0 ? (
          <View style={styles.emptyItems}>
            <Text style={styles.emptyDesc}>아직 항목이 없습니다.</Text>
          </View>
        ) : (
          rebalance.items.map(({ item, rebalance: rb }, i) => {
            return (
              <Pressable
                key={item.id}
                style={styles.itemRow}
                onPress={() => {
                  setEditingItem(item);
                  setEditorVisible(true);
                }}
                onLongPress={() => {
                  Alert.alert('항목 삭제', `“${item.name}”을(를) 삭제할까요?`, [
                    { text: '취소', style: 'cancel' },
                    {
                      text: '삭제',
                      style: 'destructive',
                      onPress: () => removeItem(activeAccount.id, item.id),
                    },
                  ]);
                }}
              >
                <View style={[styles.itemColorDot, { backgroundColor: colorAt(i) }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.itemHeaderRow}>
                    <View style={styles.itemNameWrap}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View
                        style={[styles.categoryBadge, { borderColor: categoryColor(item.category) }]}
                      >
                        <Text style={[styles.categoryBadgeText, { color: categoryColor(item.category) }]}>
                          {categoryLabel(item.category)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.itemPercent}>
                      {formatPercent(item.targetPercent)}
                    </Text>
                  </View>
                  <View style={styles.itemHeaderRow}>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {item.symbol ? `${item.symbol}` : '직접 입력'}
                      {item.currentPrice != null
                        ? `  ·  ${item.currentPrice.toLocaleString()} ${item.currency ?? ''}`
                        : ''}
                    </Text>
                    <Text style={styles.itemValue}>
                      {formatCurrency(rb.targetValue, activeAccount.currency)}
                    </Text>
                  </View>
                  {rb.hasPrice && rb.ownedShares != null ? (
                    <View style={styles.itemRebalanceBox}>
                      <Text style={styles.itemRebalanceShares}>
                        보유 {rb.ownedShares.toLocaleString()}주 → 목표 {rb.shares.toLocaleString()}주
                      </Text>
                      <Text
                        style={[
                          styles.itemRebalanceDelta,
                          {
                            color:
                              rb.delta > 0
                                ? colors.primary
                                : rb.delta < 0
                                ? colors.warning
                                : colors.success,
                          },
                        ]}
                      >
                        {rb.delta > 0
                          ? `+${rb.delta.toLocaleString()}주 매수`
                          : rb.delta < 0
                          ? `${rb.delta.toLocaleString()}주 매도`
                          : '목표 달성 ✓'}
                        {rb.delta !== 0
                          ? `  (${rb.delta > 0 ? '+' : '-'}${formatCurrency(
                              Math.abs(rb.additionalCost),
                              activeAccount.currency,
                            )})`
                          : ''}
                      </Text>
                    </View>
                  ) : rb.hasPrice ? (
                    <View style={styles.itemRebalanceBox}>
                      <Text style={styles.itemRebalanceShares}>
                        권장 매수 {rb.shares.toLocaleString()}주
                      </Text>
                      <Text style={styles.itemRebalanceDetail}>
                        예상 매수금액 {formatCurrency(rb.actualValue, activeAccount.currency)}
                        {'  ·  '}
                        {rb.remaining >= 0 ? '부족 ' : '초과 '}
                        {formatCurrency(Math.abs(rb.remaining), activeAccount.currency)}
                      </Text>
                    </View>
                  ) : rb.ownedShares != null ? (
                    <View style={styles.itemRebalanceBox}>
                      <Text style={styles.itemRebalanceDetail}>
                        보유 {rb.ownedShares.toLocaleString()}주 — 현재가 정보가 있으면 추가 매수 수량이 계산됩니다.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.itemRebalanceBox}>
                      <Text style={styles.itemRebalanceMissing}>
                        현재가 정보 없음 — 검색하거나 직접 입력하면 권장 매수 수량이 계산됩니다.
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })
        )}

        <View style={styles.exportSection}>
          <Text style={styles.sectionTitle}>내보내기</Text>
          <ExportButtons
            label="계좌"
            getData={() => buildAccountExport(activeAccount, rebalance)}
          />
        </View>

        <Pressable style={styles.dangerBtn} onPress={handleDeleteAccount}>
          <Text style={styles.dangerBtnText}>이 계좌 삭제</Text>
        </Pressable>
      </ScrollView>

      <ItemEditorModal
        visible={editorVisible || screenshotEditorOpen()}
        initial={screenshotEditorOpen() ? activeAccount.items[0] : editingItem}
        remainingPercent={
          remaining +
          ((screenshotEditorOpen() ? activeAccount.items[0] : editingItem)?.targetPercent ?? 0)
        }
        onClose={() => setEditorVisible(false)}
        onSubmit={(payload) => {
          if (editingItem) {
            updateItem(activeAccount.id, editingItem.id, payload);
          } else {
            addItem(activeAccount.id, payload);
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: spacing.sm },
  emptyDesc: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  emptyItems: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  allocationCard: { flexDirection: 'row', alignItems: 'center' },
  label: {
    color: colors.textDim,
    fontSize: 13,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  currencyToggle: {
    flexDirection: 'row',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  currencyBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  currencyBtnActive: { backgroundColor: colors.primary },
  currencyText: { color: colors.textDim, fontWeight: '600' },
  currencyTextActive: { color: '#fff' },
  totalDisplay: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: spacing.sm },
  allocTitle: { color: colors.textDim, fontSize: 13 },
  allocPercent: { fontSize: 28, fontWeight: '800', marginTop: spacing.xs },
  allocHint: { color: colors.textDim, fontSize: 13, marginTop: spacing.xs },
  refreshBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshBtnText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  rateNote: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  addBtnText: { color: '#fff', fontWeight: '700' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  itemColorDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemName: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: '700' },
  itemSub: { color: colors.textDim, fontSize: 12, marginTop: 2, flex: 1 },
  itemPercent: { color: colors.text, fontSize: 15, fontWeight: '700' },
  itemValue: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  itemRebalanceBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemRebalanceShares: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  itemRebalanceDelta: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  itemRebalanceDetail: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  itemRebalanceMissing: { color: colors.warning, fontSize: 12, fontStyle: 'italic' },
  rebalanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  rebalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rebalanceLabel: { color: colors.textDim, fontSize: 14 },
  rebalanceValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rebalanceHint: { color: colors.textDim, fontSize: 11, marginTop: spacing.xs },
  exportSection: { marginTop: spacing.md, gap: spacing.sm },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  dangerBtn: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
  },
  dangerBtnText: { color: colors.danger, fontWeight: '600' },
});
