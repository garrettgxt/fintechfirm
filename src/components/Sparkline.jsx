// Small inline SVG line built from a rolling window of real tick history
// (see useLivePrices' per-symbol `history` array). Used anywhere a full
// PriceChart would be too heavy — ticker strips, holdings rows.

export default function Sparkline({ history, width = 84, height = 28, isUp = true }) {
  if (!history || history.length < 2) {
    return <svg width={width} height={height} />;
  }

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  const points = history.map((price, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - ((price - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={isUp ? "var(--sage)" : "var(--rust)"}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
