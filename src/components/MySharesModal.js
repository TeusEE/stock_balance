import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { listMine, updateShared, unpublishPortfolio } from '@/services/shareApi';
import { formatPercent } from '@/utils/format';
import { isValidNickname } from '@/utils/nickname';

/**
 * 내가 등록한 공유 포트폴리오 관리 — 제목/공개범위 수정, 삭제(공유 해제).
 * 세션에 자격(별명+비밀번호)이 있으면 바로 목록, 없으면 로그인 폼.
 */
export const MySharesModal = ({ visible, onClose }) => {
  const { credentials, ensureUser } = useAuth();
  const [step, setStep] = useState('login'); // 'login' | 'list'
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPublic, setDraftPublic] = useState(false);

  const creds = credentials; // { nickname, password } | null

  const load = async (c) => {
    setLoading(true);
    setError(null);
    try {
      const rows = (await listMine({ nickname: c.nickname, password: c.password })) ?? [];
      setItems(rows);
      setStep('list');
    } catch (e) {
      setError(e?.message || '목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setError(null);
      setEditingId(null);
      if (creds) {
        load(creds);
      } else {
        setStep('login');
        setNickname('');
        setPassword('');
        setItems([]);
      }
    }
  }, [visible]);

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!isValidNickname(nickname) || password.length < 4) {
      setError('별명(1~20자)과 비밀번호(4자 이상)를 확인해주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ensureUser(nickname.trim(), password);
      await load({ nickname: nickname.trim(), password });
    } catch (e) {
      setError(e?.message || '로그인에 실패했습니다.');
      setLoading(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setDraftTitle(item.title);
    setDraftPublic(item.visibility === 'public');
  };

  const saveEdit = async (item) => {
    Keyboard.dismiss();
    if (!draftTitle.trim()) return;
    setLoading(true);
    try {
      await updateShared({
        nickname: creds.nickname,
        password: creds.password,
        id: item.id,
        title: draftTitle.trim(),
        visibility: draftPublic ? 'public' : 'unlisted',
      });
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, title: draftTitle.trim(), visibility: draftPublic ? 'public' : 'unlisted' }
            : it,
        ),
      );
      setEditingId(null);
    } catch (e) {
      Alert.alert('실패', e?.message || '수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert('공유 삭제', `"${item.title}"의 공유를 해제할까요?\n이 작업은 되돌릴 수 없습니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await unpublishPortfolio({ nickname: creds.nickname, password: creds.password, id: item.id });
            setItems((prev) => prev.filter((it) => it.id !== item.id));
          } catch (e) {
            Alert.alert('실패', e?.message || '삭제에 실패했습니다.');
          }
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
              <Text style={styles.title}>내 공유물 관리</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.close}>닫기</Text>
              </Pressable>
            </View>

            {step === 'login' ? (
              <>
                <Text style={styles.hint}>공유할 때 사용한 별명과 비밀번호를 입력하세요.</Text>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="별명"
                  placeholderTextColor={colors.textDim}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="비밀번호"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.input}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>불러오기</Text>}
                </Pressable>
              </>
            ) : (
              <ScrollView style={styles.listWrap} keyboardShouldPersistTaps="handled">
                {loading && items.length === 0 ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
                ) : items.length === 0 ? (
                  <Text style={styles.empty}>{error || '등록한 공유물이 없습니다.'}</Text>
                ) : (
                  items.map((item) => (
                    <View key={item.id} style={styles.card}>
                      {editingId === item.id ? (
                        <>
                          <TextInput
                            value={draftTitle}
                            onChangeText={setDraftTitle}
                            placeholder="제목"
                            placeholderTextColor={colors.textDim}
                            maxLength={40}
                            style={styles.input}
                          />
                          <View style={styles.visToggle}>
                            {[
                              { key: false, label: '코드로만' },
                              { key: true, label: '공개+순위' },
                            ].map((opt) => (
                              <Pressable
                                key={String(opt.key)}
                                onPress={() => setDraftPublic(opt.key)}
                                style={[styles.visBtn, draftPublic === opt.key && styles.visBtnActive]}
                              >
                                <Text style={[styles.visText, draftPublic === opt.key && styles.visTextActive]}>
                                  {opt.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                          <View style={styles.btnRow}>
                            <Pressable style={[styles.smallBtn, styles.saveBtn]} onPress={() => saveEdit(item)}>
                              <Text style={styles.saveText}>저장</Text>
                            </Pressable>
                            <Pressable style={[styles.smallBtn, styles.cancelBtn]} onPress={() => setEditingId(null)}>
                              <Text style={styles.cancelText}>취소</Text>
                            </Pressable>
                          </View>
                        </>
                      ) : (
                        <>
                          <View style={styles.cardTop}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                              <Text style={styles.cardSub}>
                                {item.visibility === 'public' ? '공개+순위' : '코드 공유'}
                                {item.return_6m != null ? `  ·  ${formatPercent(item.return_6m)}` : ''}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.btnRow}>
                            <Pressable style={[styles.smallBtn, styles.editBtn]} onPress={() => startEdit(item)}>
                              <Text style={styles.editText}>수정</Text>
                            </Pressable>
                            <Pressable style={[styles.smallBtn, styles.delBtn]} onPress={() => handleDelete(item)}>
                              <Text style={styles.delText}>삭제</Text>
                            </Pressable>
                          </View>
                        </>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
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
  hint: { color: colors.textDim, fontSize: 12 },

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
  error: { color: colors.danger, fontSize: 13 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  listWrap: { marginTop: spacing.xs },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  cardSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },

  visToggle: { flexDirection: 'row', gap: spacing.sm },
  visBtn: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  visBtnActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  visText: { color: colors.textDim, fontWeight: '600', fontSize: 13 },
  visTextActive: { color: '#fff' },

  btnRow: { flexDirection: 'row', gap: spacing.sm },
  smallBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  editBtn: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  editText: { color: colors.text, fontWeight: '600' },
  delBtn: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.danger },
  delText: { color: colors.danger, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary },
  saveText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.textDim, fontWeight: '600' },
});
