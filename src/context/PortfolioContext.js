import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import { loadExchangeRate, loadState, saveExchangeRate, saveState } from '@/utils/storage';
import { genId } from '@/utils/format';
import { SCREENSHOT_ENABLED, SEED_STATE, SEED_RATE } from '@/utils/screenshot';

const FALLBACK_USD_KRW = 1350;

const initialState = SCREENSHOT_ENABLED
  ? SEED_STATE
  : {
      accounts: [],
      activeAccountId: undefined,
    };

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return action.payload;

    case 'ADD_ACCOUNT': {
      const acc = {
        id: genId('acc'),
        name: action.payload.name || `계좌 ${state.accounts.length + 1}`,
        totalAmount: 0,
        currency: 'KRW',
        items: [],
        createdAt: Date.now(),
      };
      return {
        ...state,
        accounts: [...state.accounts, acc],
        activeAccountId: acc.id,
      };
    }

    case 'REMOVE_ACCOUNT': {
      const accounts = state.accounts.filter((a) => a.id !== action.payload.accountId);
      const activeAccountId =
        state.activeAccountId === action.payload.accountId
          ? accounts[0]?.id
          : state.activeAccountId;
      return { ...state, accounts, activeAccountId };
    }

    case 'RENAME_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.payload.accountId ? { ...a, name: action.payload.name } : a,
        ),
      };

    case 'SET_TOTAL':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.payload.accountId
            ? { ...a, totalAmount: action.payload.totalAmount }
            : a,
        ),
      };

    case 'SET_CURRENCY':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.payload.accountId
            ? { ...a, currency: action.payload.currency }
            : a,
        ),
      };

    case 'SET_ACTIVE_ACCOUNT':
      return { ...state, activeAccountId: action.payload.accountId };

    case 'ADD_ITEM': {
      const newItem = { id: genId('item'), ...action.payload.item };
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.payload.accountId
            ? { ...a, items: [...a.items, newItem] }
            : a,
        ),
      };
    }

    case 'UPDATE_ITEM':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.payload.accountId
            ? {
                ...a,
                items: a.items.map((it) =>
                  it.id === action.payload.itemId ? { ...it, ...action.payload.patch } : it,
                ),
              }
            : a,
        ),
      };

    case 'REMOVE_ITEM':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.payload.accountId
            ? { ...a, items: a.items.filter((it) => it.id !== action.payload.itemId) }
            : a,
        ),
      };

    default:
      return state;
  }
}

const PortfolioContext = createContext(undefined);

export const PortfolioProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);
  const [usdToKrw, setUsdToKrw] = useState(
    SCREENSHOT_ENABLED ? SEED_RATE.usdToKrw : FALLBACK_USD_KRW,
  );
  const [rateUpdatedAt, setRateUpdatedAt] = useState(
    SCREENSHOT_ENABLED ? SEED_RATE.updatedAt : null,
  );

  useEffect(() => {
    if (SCREENSHOT_ENABLED) {
      // 스크린샷 모드: 영구 저장소를 무시하고 시드 데이터를 그대로 사용
      setReady(true);
      return;
    }
    (async () => {
      try {
        const [persisted, savedRate] = await Promise.all([loadState(), loadExchangeRate()]);
        if (persisted) {
          dispatch({ type: 'HYDRATE', payload: persisted });
        }
        if (savedRate && typeof savedRate.usdToKrw === 'number') {
          setUsdToKrw(savedRate.usdToKrw);
          setRateUpdatedAt(savedRate.updatedAt);
        }
      } catch (e) {
        console.warn('Failed to hydrate state', e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (ready && !SCREENSHOT_ENABLED) {
      saveState(state);
    }
  }, [state, ready]);

  const value = useMemo(
    () => ({
      state,
      ready,
      usdToKrw,
      rateUpdatedAt,
      setExchangeRate: (rate) => {
        const updatedAt = Date.now();
        setUsdToKrw(rate);
        setRateUpdatedAt(updatedAt);
        saveExchangeRate(rate, updatedAt);
      },
      addAccount: (name) => dispatch({ type: 'ADD_ACCOUNT', payload: { name } }),
      removeAccount: (accountId) => dispatch({ type: 'REMOVE_ACCOUNT', payload: { accountId } }),
      renameAccount: (accountId, name) =>
        dispatch({ type: 'RENAME_ACCOUNT', payload: { accountId, name } }),
      setTotal: (accountId, totalAmount) =>
        dispatch({ type: 'SET_TOTAL', payload: { accountId, totalAmount } }),
      setCurrency: (accountId, currency) =>
        dispatch({ type: 'SET_CURRENCY', payload: { accountId, currency } }),
      setActiveAccount: (accountId) =>
        dispatch({ type: 'SET_ACTIVE_ACCOUNT', payload: { accountId } }),
      addItem: (accountId, item) => dispatch({ type: 'ADD_ITEM', payload: { accountId, item } }),
      updateItem: (accountId, itemId, patch) =>
        dispatch({ type: 'UPDATE_ITEM', payload: { accountId, itemId, patch } }),
      removeItem: (accountId, itemId) =>
        dispatch({ type: 'REMOVE_ITEM', payload: { accountId, itemId } }),
    }),
    [state, ready, usdToKrw, rateUpdatedAt],
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
};

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
}
