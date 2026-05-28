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

const RATE_KEY = '@stock_balance/exchange_rate_v1';

export async function loadExchangeRate() {
  try {
    const raw = await AsyncStorage.getItem(RATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw); // { usdToKrw: number, updatedAt: number }
  } catch (e) {
    console.warn('Failed to load exchange rate', e);
    return null;
  }
}

export async function saveExchangeRate(usdToKrw, updatedAt) {
  try {
    await AsyncStorage.setItem(RATE_KEY, JSON.stringify({ usdToKrw, updatedAt }));
  } catch (e) {
    console.warn('Failed to save exchange rate', e);
  }
}
