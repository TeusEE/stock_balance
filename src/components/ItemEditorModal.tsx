import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PortfolioItem, StockQuote } from '@/types';
import { colors, radius, spacing } from '@/theme';
import { StockSearchModal } from './StockSearchModal';

interface Props {
  visible: boolean;
  initial?: Partial<PortfolioItem>;
  remainingPercent: number;
  onClose: () => void;
  onSubmit: (item: Omit<PortfolioItem, 'id'>) => void;
}

export const ItemEditorModal: React.FC<Props> = ({
  visible,
  initial,
  remainingPercent,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState<string | undefined>(undefined);
  const [percent, setPercent] = useState('');
  const [currentPrice, setCurrentPrice] = useState<number | undefined>(undefined);
  const [currency, setCurrency] = useState<string | undefined>(undefined);
  const [manual, setManual] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setSymbol(initial?.symbol);
      setPercent(initial?.targetPercent != null ? String(initial.targetPercent) : '');
      setCurrentPrice(initial?.currentPrice);
      setCurrency(initial?.currency);
      setManual(initial?.manual ?? !initial?.symbol);
    }
  }, [visible, initial]);

  const handleSelectStock = (q: StockQuote) => {
    setName(q.longname || q.shortname);
    setSymbol(q.symbol);
    setCurrentPrice(q.price);
    setCurrency(q.currency);
    setManual(false);
  };

  const handleSubmit = () => {
    const pct = parseFloat(percent);
    if (!name.trim() || !isFinite(pct) || pct <= 0) return;
    onSubmit({
      name: name.trim(),
      symbol,
      targetPercent: pct,
      currentPrice,
      currency,
      manual,
      lastPriceUpdatedAt: currentPrice ? Date.now() : undefined,
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
                setCurrentPrice(undefined);
                setCurrency(undefined);
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
              {currentPrice != null
                ? `  ·  현재가 ${currentPrice.toLocaleString()} ${currency ?? ''}`
                : ''}
            </Text>
          ) : null}

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
  symbolHint: { color: colors.textDim, marginTop: spacing.xs, fontSize: 13 },
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
