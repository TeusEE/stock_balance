import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';
import { formatPercent } from '@/utils/format';
import { browsePublic } from '@/services/shareApi';
import { getBlockedAuthors } from '@/utils/localModeration';
import { SharedDetailModal } from '@/components/SharedDetailModal';

const TOP_N = 5; // 요구사항 ①: 상위 5개
const PAGE = 10; // 요구사항 ④: 더보기 10개씩

export const BrowseScreen = () => {
  const [mode, setMode] = useState('nickname'); // 'nickname' | 'symbol'
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState(''); // 실제 적용된 검색어
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState(null);

  const offsetRef = useRef(0); // 서버에서 가져온 raw 개수(차단 필터 전)
  const blockedRef = useRef(new Set());

  const fetchPage = useCallback(
    async (reset, q, searchMode) => {
      setLoading(true);
      setError(null);
      try {
        const offset = reset ? 0 : offsetRef.current;
        const trimmed = (q ?? '').trim();
        const limit = reset && !trimmed ? TOP_N : PAGE;
        const params = { sort: 'return', limit, offset };
        if (trimmed) {
          if (searchMode === 'nickname') params.nickname = trimmed;
          else params.symbol = trimmed;
        }
        const rows = (await browsePublic(params)) ?? [];
        const visible = rows.filter((r) => !blockedRef.current.has(r.user_id));
        offsetRef.current = offset + rows.length;
        setItems((prev) => (reset ? visible : [...prev, ...visible]));
        setHasMore(rows.length === limit);
      } catch (e) {
        setError('목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // 최초 로드: 차단 목록 먼저 읽고 Top5
  useEffect(() => {
    (async () => {
      blockedRef.current = new Set(await getBlockedAuthors());
      fetchPage(true, '', 'nickname');
    })();
  }, [fetchPage]);

  const handleSearch = () => {
    Keyboard.dismiss();
    setActiveQuery(query.trim());
    fetchPage(true, query, mode);
  };

  const handleClear = () => {
    setQuery('');
    setActiveQuery('');
    fetchPage(true, '', mode);
  };

  const renderItem = ({ item, index }) => {
    const top = !activeQuery; // 검색어 없을 때만 순위 표시
    return (
      <Pressable style={styles.card} onPress={() => setSelected(item)}>
        {top ? <Text style={styles.rank}>{index + 1}</Text> : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            by {item.nickname}
            {Array.isArray(item.holdings) && item.holdings.length
              ? `  ·  ${item.holdings.slice(0, 3).map((h) => h.name).join(', ')}${item.holdings.length > 3 ? ' 외' : ''}`
              : ''}
          </Text>
        </View>
        <Text
          style={[
            styles.return,
            item.return_6m != null && item.return_6m < 0 && styles.returnNeg,
            item.return_6m == null && styles.returnDim,
          ]}
        >
          {item.return_6m == null ? '—' : formatPercent(item.return_6m)}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerWrap}>
        <Text style={styles.title}>둘러보기</Text>

        {/* 검색 모드 토글 */}
        <View style={styles.modeToggle}>
          {[
            { key: 'nickname', label: '별명' },
            { key: 'symbol', label: '종목' },
          ].map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              style={[styles.modeBtn, mode === m.key && styles.modeBtnActive]}
            >
              <Text style={[styles.modeText, mode === m.key && styles.modeTextActive]}>{m.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* 검색바 */}
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder={mode === 'nickname' ? '작성자 별명 검색' : '종목명 또는 티커 검색'}
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.input}
          />
          {activeQuery ? (
            <Pressable style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearText}>초기화</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.searchBtn} onPress={handleSearch}>
            <Text style={styles.searchBtnText}>검색</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>
          {activeQuery ? `"${activeQuery}" 검색 결과` : '🏆 6개월 수익률 Top 5'}
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              {error || (activeQuery ? '검색 결과가 없습니다.' : '아직 공개된 포트폴리오가 없습니다.')}
            </Text>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {loading ? <ActivityIndicator color={colors.primary} /> : null}
            {!loading && hasMore ? (
              <Pressable style={styles.moreBtn} onPress={() => fetchPage(false, activeQuery, mode)}>
                <Text style={styles.moreText}>더보기</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <SharedDetailModal
        visible={!!selected}
        payload={selected}
        onClose={() => setSelected(null)}
        onBlocked={(uid) => {
          blockedRef.current.add(uid);
          setItems((prev) => prev.filter((it) => it.user_id !== uid));
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { padding: spacing.lg, gap: spacing.sm },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  modeBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  modeBtnActive: { backgroundColor: colors.primary },
  modeText: { color: colors.textDim, fontWeight: '600', fontSize: 14 },
  modeTextActive: { color: '#fff' },

  searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  clearBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  clearText: { color: colors.textDim, fontWeight: '600', fontSize: 13 },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchBtnText: { color: '#fff', fontWeight: '700' },

  sectionLabel: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: spacing.xs },

  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  rank: { color: colors.primary, fontSize: 16, fontWeight: '800', width: 20, textAlign: 'center' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  cardSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  return: { color: colors.success, fontSize: 15, fontWeight: '800' },
  returnNeg: { color: colors.danger },
  returnDim: { color: colors.textDim },

  empty: { color: colors.textDim, textAlign: 'center', marginTop: spacing.xl },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  moreBtn: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  moreText: { color: colors.text, fontWeight: '700' },
});
