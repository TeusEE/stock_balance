import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { CATEGORIES, DEFAULT_CATEGORY } from '@/constants/categories';
import { StockSearchModal } from './StockSearchModal';

export const ItemEditorModal = ({
  visible,
  initial,
  remainingPercent,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState(undefined);
  const [percent, setPercent] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [currency, setCurrency] = useState(undefined);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [ownedInput, setOwnedInput] = useState('');
  const [manual, setManual] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setSymbol(initial?.symbol);
      setPercent(initial?.targetPercent != null ? String(initial.targetPercent) : '');
      setPriceInput(initial?.currentPrice != null ? String(initial.currentPrice) : '');
      setCurrency(initial?.currency);
      setCategory(initial?.category ?? DEFAULT_CATEGORY);
      setOwnedInput(initial?.ownedShares != null ? String(initial.ownedShares) : '');
      setManual(initial?.manual ?? !initial?.symbol);
    }
  }, [visible, initial]);

  const handleSelectStock = (q) => {
    setName(q.longname || q.shortname);
    setSymbol(q.symbol);
    setPriceInput(q.price != null ? String(q.price) : '');
    setCurrency(q.currency);
    setManual(false);
  };

  const handleSubmit = () => {
    const pct = parseFloat(percent);
    if (!name.trim() || !isFinite(pct) || pct <= 0) return;
    const parsedPrice = parseFloat(priceInput);
    const price =
      isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined;
    const parsedOwned = parseFloat(ownedInput);
    const ownedShares =
      ownedInput.trim() !== '' && isFinite(parsedOwned) && parsedOwned >= 0
        ? parsedOwned
        : undefined;
    onSubmit({
      name: name.trim(),
      symbol,
      targetPercent: pct,
      currentPrice: price,
      currency,
      category,
      ownedShares,
      manual,
      lastPriceUpdatedAt: price ? Date.now() : undefined,
    });
    onClose();
  };

  const pctNum = parseFloat(percent);
  const remainingAfter = remainingPercent - (isFinite(pctNum) ? pctNum : 0);
  const isOver = remainingAfter < -0.001;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{initial?.name ? '항목 편집' : '항목 추가'}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>취소</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>종목명</Text>
          <View style={styles.row}>
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                setManual(true);
                setSymbol(undefined);
              }}
              placeholder="직접 입력 또는 검색"
              placeholderTextColor={colors.textDim}
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable
              style={styles.searchBtn}
              onPress={() => setSearchOpen(true)}
            >
              <Text style={styles.searchBtnText}>검색</Text>
            </Pressable>
          </View>

          {symbol ? (
            <Text style={styles.symbolHint}>
              {symbol}
              {currency ? `  ·  ${currency}` : ''}
            </Text>
          ) : null}

          <Text style={styles.label}>분류</Text>
          <View style={styles.categoryWrap}>
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={[
                    styles.categoryChip,
                    active && { backgroundColor: c.color, borderColor: c.color },
                  ]}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>
            현재가 {symbol ? '(검색 시 자동 입력, 수정 가능)' : '(선택)'}
          </Text>
          <View style={styles.row}>
            <TextInput
              value={priceInput}
              onChangeText={setPriceInput}
              placeholder="예: 300"
              placeholderTextColor={colors.textDim}
              keyboardType="decimal-pad"
              style={[styles.input, { flex: 1 }]}
            />
            <View style={styles.currencyToggle}>
              {['KRW', 'USD'].map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCurrency(c)}
                  style={[styles.currencyBtn, currency === c && styles.currencyBtnActive]}
                >
                  <Text
                    style={[
                      styles.currencyText,
                      currency === c && styles.currencyTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Text style={styles.label}>보유 수량 (선택)</Text>
          <TextInput
            value={ownedInput}
            onChangeText={setOwnedInput}
            placeholder="예: 70 (지금 가지고 있는 주식 수)"
            placeholderTextColor={colors.textDim}
            keyboardType="decimal-pad"
            style={styles.input}
          />

          <Text style={styles.label}>비중 (%)</Text>
          <TextInput
            value={percent}
            onChangeText={setPercent}
            placeholder={`남은 비중 ${remainingPercent.toFixed(2)}%`}
            placeholderTextColor={colors.textDim}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <Text style={[styles.hint, isOver && { color: colors.danger }]}>
            저장 후 남은 비중: {remainingAfter.toFixed(2)}%
          </Text>

          <Pressable
            style={[styles.submit, (!name.trim() || !isFinite(pctNum) || pctNum <= 0) && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={!name.trim() || !isFinite(pctNum) || pctNum <= 0}
          >
            <Text style={styles.submitText}>저장</Text>
          </Pressable>
        </View>
      </View>

      <StockSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSelectStock}
      />
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '600' },
  close: { color: colors.primary, fontSize: 16 },
  label: { color: colors.textDim, fontSize: 13, marginBottom: spacing.xs, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  searchBtnText: { color: '#fff', fontWeight: '600' },
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
  symbolHint: { color: colors.textDim, marginTop: spacing.xs, fontSize: 13 },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  categoryChipTextActive: { color: '#fff' },
  hint: { color: colors.textDim, marginTop: spacing.xs, fontSize: 13 },
  submit: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  submitDisabled: { backgroundColor: colors.primaryDim },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
