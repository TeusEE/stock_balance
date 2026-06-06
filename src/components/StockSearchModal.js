import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchQuote, searchStocks } from '@/services/stockApi';
import { colors, radius, spacing } from '@/theme';

export const StockSearchModal = ({ visible, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setError(null);
    }
  }, [visible]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        setError(null);
        const data = await searchStocks(query);
        setResults(data);
      } catch (e) {
        setError('검색에 실패했습니다. 네트워크를 확인해주세요.');
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = async (quote) => {
    try {
      const detail = await fetchQuote(quote.symbol);
      onSelect(detail ?? quote);
    } catch {
      onSelect(quote);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>주식 / ETF 검색</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="티커 또는 종목명 (예: AAPL, 삼성전자, VOO)"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            autoFocus
            autoCapitalize="characters"
          />
          {loading && (
            <View style={{ paddingVertical: spacing.lg }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <FlatList
            data={results}
            keyExtractor={(item) => item.symbol}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => handleSelect(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.shortname}
                    {item.exchange ? `  ·  ${item.exchange}` : ''}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              !loading && query && !error ? (
                <Text style={styles.empty}>검색 결과가 없습니다.</Text>
              ) : null
            }
          />
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '85%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '600' },
  close: { color: colors.primary, fontSize: 16 },
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
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  symbol: { color: colors.text, fontSize: 16, fontWeight: '600' },
  name: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  empty: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  error: { color: colors.danger, marginTop: spacing.sm },
});
