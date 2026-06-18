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
import { publishPortfolio, submitReturn } from '@/services/shareApi';
import { suggestNickname, isValidNickname } from '@/utils/nickname';
import { containsBannedWord } from '@/utils/moderation';
import { buildConsolidatedWeights, uniqueSymbolsForBacktest, computeBacktest } from '@/utils/backtest';
import { fetchHistoricalCloses } from '@/services/stockApi';
import { formatPercent } from '@/utils/format';

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
  const [isPublic, setIsPublic] = useState(true); // 기본값: 공개 + 순위 등재
  const [step, setStep] = useState('form'); // 'form' | 'done'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [returnInfo, setReturnInfo] = useState(null); // 공개 등재 시 계산된 6개월 수익률
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(defaultTitle);
      setNickname(savedNickname ?? '');
      setPassword('');
      setEula(false);
      setIsPublic(true);
      setStep('form');
      setLoading(false);
      setError(null);
      setShareToken(null);
      setReturnInfo(null);
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
        visibility: isPublic ? 'public' : 'unlisted',
      });
      setShareToken(row?.share_token ?? null);

      // 공개로 자랑하기: 기존 backtest.js 로 6개월 수익률을 계산해 제출(MVP).
      // 계산/제출이 실패해도 공개 게시는 유지되며 순위는 최신순으로 노출된다.
      if (isPublic && row?.id) {
        try {
          const weighted = buildConsolidatedWeights(holdings);
          const symbols = uniqueSymbolsForBacktest(weighted);
          const priceMap = symbols.length ? await fetchHistoricalCloses(symbols, '6mo') : {};
          const bt = computeBacktest(weighted, priceMap);
          const r = bt?.totalReturnPercent ?? null;
          if (r != null) {
            await submitReturn({ nickname: nickname.trim(), password, id: row.id, return6m: r });
            setReturnInfo(r);
          }
        } catch (e) {
          // 수익률 계산/제출 실패는 무시(공개는 유지)
        }
      }
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

                <Text style={styles.label}>공개 범위</Text>
                <View style={styles.visToggle}>
                  {[
                    { key: false, label: '코드로만 공유', desc: '받은 사람만 열람' },
                    { key: true, label: '공개 + 순위 등재', desc: '둘러보기 탭에 노출' },
                  ].map((opt) => (
                    <Pressable
                      key={String(opt.key)}
                      onPress={() => setIsPublic(opt.key)}
                      style={[styles.visBtn, isPublic === opt.key && styles.visBtnActive]}
                    >
                      <Text style={[styles.visLabel, isPublic === opt.key && styles.visLabelActive]}>{opt.label}</Text>
                      <Text style={[styles.visDesc, isPublic === opt.key && styles.visLabelActive]}>{opt.desc}</Text>
                    </Pressable>
                  ))}
                </View>
                {isPublic ? (
                  <Text style={styles.note}>
                    공개 시 6개월 백테스트 수익률이 계산되어 순위판에 노출됩니다(비중만 공개, 금액·수량 비공개).
                  </Text>
                ) : null}

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
                {isPublic ? (
                  <Text style={styles.hint}>
                    "둘러보기" 탭에 공개되었습니다.
                    {returnInfo != null ? ` 6개월 수익률 ${formatPercent(returnInfo)} 로 순위판에 등재됨.` : ' (수익률은 곧 반영됩니다.)'}
                    {'\n'}아래 공유 코드로도 직접 전달할 수 있습니다.
                  </Text>
                ) : (
                  <Text style={styles.hint}>
                    아래 공유 코드를 전달하세요. 받는 사람이 "공유 코드로 보기"에 붙여넣으면 열람할 수 있습니다.
                  </Text>
                )}
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

  visToggle: { flexDirection: 'row', gap: spacing.sm },
  visBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  visBtnActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  visLabel: { color: colors.text, fontWeight: '700', fontSize: 13 },
  visLabelActive: { color: '#fff' },
  visDesc: { color: colors.textDim, fontSize: 11, marginTop: 2 },

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
