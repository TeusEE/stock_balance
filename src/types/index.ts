export type Currency = 'KRW' | 'USD';

export interface StockQuote {
  symbol: string;
  shortname: string;
  longname?: string;
  exchange?: string;
  currency?: Currency | string;
  price?: number;
  marketState?: string;
}

export interface PortfolioItem {
  id: string;
  symbol?: string;
  name: string;
  targetPercent: number;
  currency?: Currency | string;
  currentPrice?: number;
  lastPriceUpdatedAt?: number;
  manual: boolean;
}

export interface Account {
  id: string;
  name: string;
  totalAmount: number;
  currency: Currency;
  items: PortfolioItem[];
  createdAt: number;
}

export interface PortfolioState {
  accounts: Account[];
  activeAccountId?: string;
}
