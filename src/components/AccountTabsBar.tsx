import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Account } from '@/types';
import { colors, radius, spacing } from '@/theme';

interface Props {
  accounts: Account[];
  activeId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export const AccountTabsBar: React.FC<Props> = ({ accounts, activeId, onSelect, onAdd }) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {accounts.map((acc) => {
          const active = acc.id === activeId;
          return (
            <Pressable
              key={acc.id}
              onPress={() => onSelect(acc.id)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                {acc.name}
              </Text>
            </Pressable>
          );
        })}
        <Pressable onPress={onAdd} style={[styles.tab, styles.addTab]}>
          <Text style={styles.addText}>＋ 탭 추가</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 180,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: { color: colors.textDim, fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  addTab: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  addText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
