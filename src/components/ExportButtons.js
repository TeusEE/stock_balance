import React, { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { toJsonString } from '@/utils/exportData';
import { colors, radius, spacing } from '@/theme';

/**
 * JSON 내보내기 버튼 묶음 (공유 / 클립보드 복사).
 *
 * @param getData 누를 때 호출되어 내보낼 JS 객체를 반환하는 함수
 * @param label   알림 메시지에 사용할 대상 이름 (예: "계좌", "통합 포트폴리오")
 */
export const ExportButtons = ({ getData, label }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      const json = toJsonString(getData());
      await Share.share({ message: json, title: `${label} 내보내기 (JSON)` });
    } catch (e) {
      Alert.alert('공유 실패', '잠시 후 다시 시도해주세요.');
    }
  };

  const handleCopy = async () => {
    try {
      const json = toJsonString(getData());
      await Clipboard.setStringAsync(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      Alert.alert('복사 실패', '잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <View style={styles.row}>
      <Pressable style={[styles.btn, styles.share]} onPress={handleShare}>
        <Text style={styles.shareText}>JSON 공유</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.copy]} onPress={handleCopy}>
        <Text style={styles.copyText}>{copied ? '복사됨 ✓' : 'JSON 복사'}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  share: { backgroundColor: colors.primary },
  shareText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  copy: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyText: { color: colors.text, fontWeight: '600', fontSize: 14 },
});
