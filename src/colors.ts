// Model colors: mid-tone, readable with white text in light and dark themes.
export const MODEL_COLORS = [
  '#3b6fd4', '#d4651c', '#14916a', '#c0306f', '#7a52c7',
  '#0f8796', '#a87412', '#5d6e85', '#c93b3b', '#3f8a2f',
];

export const modelColor = (index: number) => MODEL_COLORS[index % MODEL_COLORS.length];
