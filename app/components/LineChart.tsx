"use client";

export type Series = {
  name: string;
  color: string;
  data: number[];
  axis?: "left" | "right";
  unit?: string;
};

type Props = {
  title: string;
  xs: string[];
  series: Series[];
  height?: number;
};

export default function LineChart({ title, xs, series, height = 280 }: Props) {
  const W = 720;
  const H = height;
  const pad = { t: 28, r: 52, b: 32, l: 52 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const leftMax = Math.max(
    10,
    ...series
      .filter((s) => !s.axis || s.axis === "left")
      .flatMap((s) => s.data),
  );
  const rightMax = Math.max(
    1,
    ...series.filter((s) => s.axis === "right").flatMap((s) => s.data),
  );
  const x = (i: number) =>
    pad.l + (xs.length <= 1 ? innerW / 2 : (innerW * i) / (xs.length - 1));
  const yLeft = (v: number) => pad.t + innerH - (v / leftMax) * innerH;
  const yRight = (v: number) => pad.t + innerH - (v / rightMax) * innerH;
  const leftTicks = 4;
  const rightTicks = 4;

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 4,
          color: "inherit",
          opacity: 0.9,
        }}
      >
        {title}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient
              key={`grad-${title}-${i}`}
              id={`grad-${title}-${i}`}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {/* grid */}
        {Array.from({ length: leftTicks + 1 }).map((_, i) => {
          const y = pad.t + (innerH * i) / leftTicks;
          return (
            <line
              key={i}
              x1={pad.l}
              x2={W - pad.r}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeDasharray="3 4"
            />
          );
        })}
        {/* axis lines */}
        <line
          x1={pad.l}
          x2={pad.l}
          y1={pad.t}
          y2={pad.t + innerH}
          stroke="currentColor"
          strokeOpacity="0.2"
        />
        <line
          x1={W - pad.r}
          x2={W - pad.r}
          y1={pad.t}
          y2={pad.t + innerH}
          stroke="currentColor"
          strokeOpacity="0.2"
        />
        {/* legends */}
        <g>
          {series.map((s, i) => (
            <g key={s.name} transform={`translate(${pad.l + i * 130}, 6)`}>
              <rect width="10" height="10" rx="3" fill={s.color} />
              <text x="16" y="9" fontSize="11" fill="currentColor" opacity="0.8">
                {s.name}
              </text>
            </g>
          ))}
        </g>
        {/* left ticks */}
        {Array.from({ length: leftTicks + 1 }).map((_, i) => {
          const v = leftMax - (leftMax * i) / leftTicks;
          const y = pad.t + (innerH * i) / leftTicks;
          return (
            <text
              key={i}
              x={pad.l - 8}
              y={y + 3}
              textAnchor="end"
              fill="currentColor"
              opacity="0.55"
              fontSize="10"
            >
              {Math.round(v)}
            </text>
          );
        })}
        {/* right ticks */}
        {rightMax > 0 &&
          Array.from({ length: rightTicks + 1 }).map((_, i) => {
            const v = rightMax - (rightMax * i) / rightTicks;
            const y = pad.t + (innerH * i) / rightTicks;
            return (
              <text
                key={i}
                x={W - pad.r + 8}
                y={y + 3}
                fill="currentColor"
                opacity="0.55"
                fontSize="10"
              >
                {Math.round(v)}
              </text>
            );
          })}
        {/* xs */}
        {xs.map((v, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 12}
            textAnchor="middle"
            fill="currentColor"
            opacity="0.55"
            fontSize="10"
          >
            {v}
          </text>
        ))}
        {/* series */}
        {series.map((s, i) => {
          const yFn = s.axis === "right" && rightMax > 0 ? yRight : yLeft;
          const d = s.data
            .map((v, idx) => `${idx === 0 ? "M" : "L"} ${x(idx)} ${yFn(v)}`)
            .join(" ");
          const area = `${d} L ${x(s.data.length - 1)} ${pad.t + innerH} L ${x(0)} ${pad.t + innerH
            } Z`;
          return (
            <g key={s.name}>
              <path d={area} fill={`url(#grad-${title}-${i})`} />
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
