import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { getSharedByToken, reportShared } from '@/services/shareApi';
import { SharedViewer } from '@/components/SharedViewer';
import { blockAuthor, isShareReported, markShareReported } from '@/utils/localModeration';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** 입력값(코드 또는 코드가 포함된 링크)에서 share_token(uuid)을 추출. */
function extractToken(input) {
  const m = String(input ?? '').match(UUID_RE);
  return m ? m[0] : '';
}

/**
 * 공유 코드(share_token)로 공유 포트폴리오를 열람하는 모달.
 * 신고/차단(UGC 1.2)은 별명+비밀번호가 있을 때 동작한다.
 */
export const ViewSharedModal = ({ visible, onClose }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (visible) {
      setCode('');
      setLoading(false);
      setError(null);
      setPayload(null);
      setReported(false);
    }
  }, [visible]);

  const handleLoad = async () => {
    Keyboard.dismiss();
    const token = extractToken(code);
    if (!token) {
      setError('올바른 공유 코드가 아닙니다.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await getSharedByToken(token);
      if (!row) {
        setError('공유물을 찾을 수 없습니다. 코드가 정확한지 확인해주세요.');
        setPayload(null);
      } else {
        setPayload(row);
        setReported(await isShareReported(row.id));
      }
    } catch (e) {
      setError(e?.message || '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReport = () => {
    if (!payload || reported) return;
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
    if (!payload) return;
    Alert.alert('작성자 차단', '이 작성자의 콘텐츠를 더 이상 보지 않을까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '차단',
        style: 'destructive',
        onPress: async () => {
          await blockAuthor(payload.user_id);
          Alert.alert('차단됨', '이 작성자의 공유물은 앞으로 숨겨집니다.');
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>공유 코드로 보기</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.close}>닫기</Text>
              </Pressable>
            </View>

            {!payload ? (
              <>
                <Text style={styles.label}>공유 코드</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="받은 공유 코드를 붙여넣으세요"
                  placeholderTextColor={colors.textDim}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable style={styles.submitBtn} onPress={handleLoad} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>불러오기</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.viewerWrap}>
                  <SharedViewer payload={payload} />
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
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
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

  label: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },

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
