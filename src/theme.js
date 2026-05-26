export const colors = {
  bg: '#0f1115',
  card: '#1a1d24',
  cardAlt: '#22262f',
  border: '#2a2f3a',
  text: '#f5f7fa',
  textDim: '#9aa3b2',
  primary: '#4f8cff',
  primaryDim: '#2f4a8a',
  danger: '#ff5d5d',
  success: '#3ecf8e',
  warning: '#ffb454',
};

export const palette = [
  '#4f8cff',
  '#ff7ab6',
  '#3ecf8e',
  '#ffb454',
  '#a78bfa',
  '#ff5d5d',
  '#22d3ee',
  '#facc15',
  '#fb923c',
  '#34d399',
  '#f472b6',
  '#60a5fa',
];

export function colorAt(i) {
  return palette[i % palette.length];
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
};
