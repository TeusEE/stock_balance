import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { Account, PortfolioItem, PortfolioState } from '@/types';
import { loadState, saveState } from '@/utils/storage';
import { genId } from '@/utils/format';

type Action =
  | { type: 'HYDRATE'; payload: PortfolioState }
  | { type: 'ADD_ACCOUNT'; payload: { name: string } }
  | { type: 'REMOVE_ACCOUNT'; payload: { accountId: string } }
  | { type: 'RENAME_ACCOUNT'; payload: { accountId: string; name: string } }
  | { type: 'SET_TOTAL'; payload: { accountId: string; totalAmount: number } }
  | { type: 'SET_CURRENCY'; payload: { accountId: string; currency: 'KRW' | 'USD' } }
  | { type: 'SET_ACTIVE_ACCOUNT'; payload: { accountId: string } }
  | { type: 'ADD_ITEM'; payload: { accountId: string; item: Omit<PortfolioItem, 'id'> } }
  | { type: 'UPDATE_ITEM'; payload: { accountId: string; itemId: string; patch: Partial<PortfolioItem> } }
  | { type: 'REMOVE_ITEM'; payload: { accountId: string; itemId: string } };

const initialState: PortfolioState = {
  accounts: [],
  activeAccountId: undefined,
};

function reducer(state: PortfolioState, action: Action): PortfolioState {
  switch (action.type) {
    case 'HYDRATE':
      return action.payload;

    case 'ADD_ACCOUNT': {
      const acc: Account = {
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
      const newItem: PortfolioItem = { id: genId('item'), ...action.payload.item };
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

interface PortfolioContextValue {
  state: PortfolioState;
  ready: boolean;
  addAccount: (name: string) => void;
  removeAccount: (accountId: string) => void;
  renameAccount: (accountId: string, name: string) => void;
  setTotal: (accountId: string, totalAmount: number) => void;
  setCurrency: (accountId: string, currency: 'KRW' | 'USD') => void;
  setActiveAccount: (accountId: string) => void;
  addItem: (accountId: string, item: Omit<PortfolioItem, 'id'>) => void;
  updateItem: (accountId: string, itemId: string, patch: Partial<PortfolioItem>) => void;
  removeItem: (accountId: string, itemId: string) => void;
}

const PortfolioContext = createContext<PortfolioContextValue | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    (async () => {
      const persisted = await loadState();
      if (persisted) {
        dispatch({ type: 'HYDRATE', payload: persisted });
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready) {
      saveState(state);
    }
  }, [state, ready]);

  const value = useMemo<PortfolioContextValue>(
    () => ({
      state,
      ready,
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
    [state, ready],
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
};

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
}
