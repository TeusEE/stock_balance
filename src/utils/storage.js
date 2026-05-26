import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@stock_balance/portfolio_state_v1';

export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load state', e);
    return null;
  }
}

export async function saveState(state) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state', e);
  }
}
