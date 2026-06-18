import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { reportShared } from '@/services/shareApi';
import { SharedViewer } from '@/components/SharedViewer';
import { blockAuthor, isShareReported, markShareReported } from '@/utils/localModeration';

/**
 * 이미 가지고 있는 공유 포트폴리오 row(payload)를 읽기 전용으로 보여주는 모달.
 * 신고(익명)/작성자 차단(기기 로컬) 제공 — 둘러보기 탭에서 항목 탭 시 사용.
 *
 * @param payload  browse_public 이 반환한 row ({ id, title, nickname, user_id, holdings, return_6m, ... })
 * @param onBlocked 차단 완료 콜백(목록에서 제거용)
 */
export const SharedDetailModal = ({ visible, payload, onClose, onBlocked }) => {
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (visible && payload) {
      isShareReported(payload.id).then(setReported);
    }
  }, [visible, payload]);

  if (!payload) return null;

  const handleReport = () => {
    if (reported) return;
    Alert.alert('신고', '이 공유물을 부적절한 콘텐츠로 신고할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '신고',
        style: 'destructive',
        onPress: async () => {
          try {
            await reportShared({ id: payload.id, reason: null });
            await markShareReported(payload.id);
            setReported(true);
            Alert.alert('접수됨', '신고가 접수되었습니다. 검토 후 조치하겠습니다.');
          } catch (e) {
            Alert.alert('실패', e?.message || '신고에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const handleBlock = () => {
    Alert.alert('작성자 차단', '이 작성자의 콘텐츠를 더 이상 보지 않을까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '차단',
        style: 'destructive',
        onPress: async () => {
          await blockAuthor(payload.user_id);
          if (onBlocked) onBlocked(payload.user_id);
          Alert.alert('차단됨', '이 작성자의 공유물은 앞으로 숨겨집니다.');
          onClose();
        },
      },
    ]);
  };

  // browse_public 은 return_6m 를 별도 컬럼으로 주므로 뷰어 payload 에 합쳐 전달
  const viewerPayload = { ...payload, return_6m: payload.return_6m };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>공유 포트폴리오</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>

          <View style={styles.viewerWrap}>
            <SharedViewer payload={viewerPayload} />
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.modBtn, reported && styles.modBtnDim]}
              onPress={handleReport}
              disabled={reported}
            >
              <Text style={styles.modText}>{reported ? '신고됨' : '신고'}</Text>
            </Pressable>
            <Pressable style={styles.modBtn} onPress={handleBlock}>
              <Text style={styles.modText}>작성자 차단</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '90%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  close: { color: colors.textDim, fontSize: 15, fontWeight: '600' },
  viewerWrap: { maxHeight: 460 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modBtn: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modText: { color: colors.text, fontWeight: '600' },
  modBtnDim: { opacity: 0.5 },
});
