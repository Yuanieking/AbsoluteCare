import { createContext, useContext } from "react";
import { Legend, ResponsiveContainer, Tooltip } from "recharts";

const ChartContext = createContext({});

export function ChartContainer({ config = {}, children, className = "" }) {
  const variables = Object.fromEntries(
    Object.entries(config).flatMap(([key, value]) => [
      [`--color-${key}`, value.color || "var(--chart-1)"],
    ]),
  );
  return (
    <ChartContext.Provider value={config}>
      <div className={`chart-container ${className}`.trim()} style={variables}>
        {children}
      </div>
    </ChartContext.Provider>
  );
}

export function ChartTooltip({ content }) {
  return <Tooltip content={content || <ChartTooltipContent />} />;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip-content">
      <strong>{labelFormatter ? labelFormatter(label) : label}</strong>
      {payload.map((item) => (
        <span key={item.dataKey || item.name}>
          <i style={{ background: item.color }} />
          {item.name}:{" "}
          {formatter ? formatter(item.value, item.name) : item.value}
        </span>
      ))}
    </div>
  );
}

export function ChartLegend({ content }) {
  return <Legend content={content || <ChartLegendContent />} />;
}

export function ChartLegendContent() {
  const config = useContext(ChartContext);
  return (
    <div className="chart-legend-content">
      {Object.entries(config).map(([key, value]) => (
        <span key={key}>
          <i style={{ background: value.color || `var(--color-${key})` }} />
          {value.label || key}
        </span>
      ))}
    </div>
  );
}

export { ResponsiveContainer };
