import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import * as Clipboard from 'expo-clipboard';
import { colors, radius, spacing } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { publishPortfolio } from '@/services/shareApi';
import { suggestNickname, isValidNickname } from '@/utils/nickname';
import { containsBannedWord } from '@/utils/moderation';

/**
 * 포트폴리오 공유 모달.
 * 별명+비밀번호+EULA 동의 → publish_portfolio RPC → 공유 코드(share_token) 발급.
 * 비중만 전송되며(toSharePayload), 금액/수량은 절대 나가지 않는다.
 *
 * @param holdings 통합/계좌 holdings ([{name, symbol, category, percent|targetPercent}])
 */
export const ShareModal = ({ visible, onClose, defaultTitle = '내 포트폴리오', baseCurrency = 'KRW', holdings = [] }) => {
  const { nickname: savedNickname, ensureUser } = useAuth();
  const [title, setTitle] = useState(defaultTitle);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [eula, setEula] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'done'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(defaultTitle);
      setNickname(savedNickname ?? '');
      setPassword('');
      setEula(false);
      setStep('form');
      setLoading(false);
      setError(null);
      setShareToken(null);
      setCopied(false);
    }
  }, [visible, defaultTitle, savedNickname]);

  const canSubmit =
    title.trim().length > 0 &&
    isValidNickname(nickname) &&
    password.length >= 4 &&
    eula &&
    holdings.length > 0 &&
    !loading;

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!canSubmit) return;
    if (containsBannedWord(nickname) || containsBannedWord(title)) {
      setError('별명/제목에 부적절한 표현이 포함되어 있습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ensureUser(nickname.trim(), password);
      const row = await publishPortfolio({
        nickname: nickname.trim(),
        password,
        title: title.trim(),
        baseCurrency,
        holdings,
        visibility: 'unlisted',
      });
      setShareToken(row?.share_token ?? null);
      setStep('done');
    } catch (e) {
      setError(e?.message || '공유에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareToken) return;
    await Clipboard.setStringAsync(shareToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        >
          <Pressable style={styles.sheet} onPress={Keyboard.dismiss}>
            <View style={styles.header}>
              <Text style={styles.title}>포트폴리오 공유</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.close}>닫기</Text>
              </Pressable>
            </View>

            {step === 'form' ? (
              <>
                <Text style={styles.hint}>
                  비중(%)만 공유됩니다. 금액·보유수량·현재가는 전송되지 않습니다.
                </Text>

                <Text style={styles.label}>공유 제목</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="예: 든든한 배당 포트폴리오"
                  placeholderTextColor={colors.textDim}
                  maxLength={40}
                  style={styles.input}
                />

                <Text style={styles.label}>별명</Text>
                <View style={styles.row}>
                  <TextInput
                    value={nickname}
                    onChangeText={setNickname}
                    placeholder="공개될 별명 (1~20자)"
                    placeholderTextColor={colors.textDim}
                    maxLength={20}
                    autoCapitalize="none"
                    style={[styles.input, { flex: 1 }]}
                  />
                  <Pressable style={styles.suggestBtn} onPress={() => setNickname(suggestNickname())}>
                    <Text style={styles.suggestText}>랜덤</Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>비밀번호</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="4자 이상 (재설정 불가 — 꼭 기억하세요)"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Text style={styles.note}>
                  다른 기기에서도 같은 별명·비밀번호로 내 공유물을 관리할 수 있어요. 이메일은 받지 않으므로 비밀번호 분실 시 복구가 불가합니다.
                </Text>

                <Pressable style={styles.eulaRow} onPress={() => setEula((v) => !v)}>
                  <View style={[styles.checkbox, eula && styles.checkboxOn]}>
                    {eula ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <Text style={styles.eulaText}>
                    불쾌하거나 불법적인 콘텐츠를 게시하지 않으며, 신고된 콘텐츠는 검토 후 조치됨에 동의합니다.
                  </Text>
                </Pressable>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                  style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>공유하기</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.doneTitle}>공유되었습니다 🎉</Text>
                <Text style={styles.hint}>
                  아래 공유 코드를 전달하세요. 받는 사람이 "공유 코드로 보기"에 붙여넣으면 열람할 수 있습니다.
                </Text>
                <View style={styles.tokenBox}>
                  <Text style={styles.tokenText} selectable numberOfLines={2}>
                    {shareToken}
                  </Text>
                </View>
                <Pressable style={styles.submitBtn} onPress={handleCopy}>
                  <Text style={styles.submitText}>{copied ? '복사됨 ✓' : '공유 코드 복사'}</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={onClose}>
                  <Text style={styles.secondaryText}>완료</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
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
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  close: { color: colors.textDim, fontSize: 15, fontWeight: '600' },

  hint: { color: colors.textDim, fontSize: 12, lineHeight: 17 },
  label: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
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
  suggestBtn: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestText: { color: colors.text, fontWeight: '600' },
  note: { color: colors.textDim, fontSize: 11, lineHeight: 16, marginTop: 2 },

  eulaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: '#fff', fontWeight: '800', fontSize: 14 },
  eulaText: { color: colors.textDim, fontSize: 12, lineHeight: 17, flex: 1 },

  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },

  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.xs },
  secondaryText: { color: colors.textDim, fontWeight: '600', fontSize: 14 },

  doneTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.xs },
  tokenBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  tokenText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
