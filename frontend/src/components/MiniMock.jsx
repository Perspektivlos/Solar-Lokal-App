import { COLOR } from "./solar-ui";

/* Kompakte SVG-Mini-Mockups (keine Fotos) für die Vorher/Nachher-Vorschau
 * je Zeitachsen-Meilenstein im Projektbericht. ViewBox 120×76, SCADA-Dark. */

const C = {
  panel: "#0a0f1c",
  line: "#ffffff14",
  dim: "#ffffff10",
  dim2: "#ffffff22",
};

function dots() {
  return (
    <>
      <circle cx="8" cy="6" r="1.5" fill="#ffffff30" />
      <circle cx="13" cy="6" r="1.5" fill="#ffffff1e" />
      <circle cx="18" cy="6" r="1.5" fill="#ffffff1e" />
    </>
  );
}

function scene(variant) {
  switch (variant) {
    case "blank":
      return (
        <>
          <rect x="38" y="34" width="44" height="5" rx="2.5" fill="#ffffff1f" />
          <rect x="44" y="44" width="32" height="4" rx="2" fill="#ffffff10" />
        </>
      );

    case "dashboard":
      return (
        <>
          {[8, 36, 64, 92].map((x, i) => (
            <rect key={i} x={x} y="16" width={i === 3 ? 20 : 24} height="10" rx="2" fill={C.dim} />
          ))}
          <line x1="26" y1="51" x2="60" y2="51" stroke={COLOR.pv} strokeWidth="1.6" opacity="0.75" />
          <line x1="60" y1="51" x2="94" y2="51" stroke={COLOR.battery} strokeWidth="1.6" opacity="0.75" />
          <circle cx="26" cy="51" r="7" fill={C.panel} stroke={COLOR.pv} strokeWidth="1.6" />
          <circle cx="60" cy="51" r="7" fill={C.panel} stroke={COLOR.battery} strokeWidth="1.6" />
          <circle cx="94" cy="51" r="7" fill={C.panel} stroke={COLOR.house} strokeWidth="1.6" />
        </>
      );

    case "grafana-error":
      return (
        <>
          <rect x="10" y="18" width="100" height="48" rx="3" fill="#ffffff06" stroke={C.line} />
          <circle cx="60" cy="40" r="11" fill="none" stroke={COLOR.grid_imp} strokeWidth="2" />
          <line x1="54" y1="34" x2="66" y2="46" stroke={COLOR.grid_imp} strokeWidth="2" />
          <line x1="66" y1="34" x2="54" y2="46" stroke={COLOR.grid_imp} strokeWidth="2" />
          <rect x="42" y="56" width="36" height="3" rx="1.5" fill="#ffffff16" />
        </>
      );

    case "grafana-grid": {
      const cells = [];
      [10, 48, 86].forEach((x) =>
        [17, 43].forEach((y, r) => {
          cells.push(
            <g key={`${x}-${y}`}>
              <rect x={x} y={y} width="24" height="20" rx="2" fill="#ffffff06" stroke={C.line} />
              {r === 0 ? (
                <polyline
                  points={`${x + 3},${y + 14} ${x + 9},${y + 7} ${x + 15},${y + 11} ${x + 21},${y + 5}`}
                  fill="none"
                  stroke={COLOR.victron}
                  strokeWidth="1.2"
                />
              ) : (
                <>
                  <rect x={x + 3} y={y + 12} width="4" height="5" fill={COLOR.battery} />
                  <rect x={x + 9} y={y + 8} width="4" height="9" fill={COLOR.battery} />
                  <rect x={x + 15} y={y + 10} width="4" height="7" fill={COLOR.battery} />
                </>
              )}
            </g>
          );
        })
      );
      return <>{cells}</>;
    }

    case "dash-nofav":
      return (
        <>
          <rect x="8" y="16" width="104" height="7" rx="2" fill="#ffffff08" />
          <rect x="10" y="30" width="48" height="34" rx="3" fill="#ffffff06" stroke={C.line} />
          <rect x="62" y="30" width="48" height="34" rx="3" fill="#ffffff06" stroke={C.line} />
        </>
      );

    case "dash-fav":
      return (
        <>
          <rect x="8" y="15" width="104" height="13" rx="3" fill={`${COLOR.battery}14`} stroke={`${COLOR.battery}55`} />
          {[12, 38, 64, 90].map((x, i) => (
            <rect key={i} x={x} y="18" width="20" height="7" rx="1.5" fill={`${COLOR.battery}`} opacity="0.5" />
          ))}
          <path d="M14 62 Q60 32 106 62" fill="none" stroke={COLOR.pv} strokeWidth="1.5" opacity="0.7" />
          <circle cx="60" cy="43" r="3.5" fill={COLOR.pv} />
        </>
      );

    case "six-tiles": {
      const cells = [];
      [10, 46, 82].forEach((x) =>
        [18, 44].forEach((y) => {
          cells.push(
            <g key={`${x}-${y}`}>
              <rect x={x} y={y} width="28" height="20" rx="2" fill="#ffffff07" stroke={C.line} />
              <rect x={x + 4} y={y + 11} width="18" height="4" rx="1" fill={`${COLOR.grid_exp}`} opacity="0.5" />
            </g>
          );
        })
      );
      return <>{cells}</>;
    }

    case "four-cards": {
      const cfg = [
        { x: 10, y: 17, c: COLOR.pv },
        { x: 62, y: 17, c: COLOR.battery },
        { x: 10, y: 43, c: COLOR.house },
        { x: 62, y: 43, c: COLOR.grid_imp },
      ];
      return (
        <>
          {cfg.map((o, i) => (
            <g key={i}>
              <rect x={o.x} y={o.y} width="48" height="24" rx="3" fill="#ffffff06" stroke={C.line} />
              <rect x={o.x + 4} y={o.y + 4} width="14" height="3" rx="1.5" fill={o.c} />
              <rect x={o.x + 4} y={o.y + 11} width="30" height="7" rx="1.5" fill={`${o.c}`} opacity="0.55" />
            </g>
          ))}
        </>
      );
    }

    case "popup":
      return (
        <>
          <rect x="0.5" y="12" width="119" height="63.5" fill="#00000045" />
          <rect x="30" y="26" width="60" height="34" rx="4" fill="#0e1424" stroke="#ffffff24" />
          <rect x="36" y="31" width="34" height="4" rx="2" fill="#ffffff26" />
          <rect x="36" y="40" width="48" height="3" rx="1.5" fill="#ffffff12" />
          <rect x="36" y="47" width="48" height="3" rx="1.5" fill="#ffffff12" />
        </>
      );

    case "footer-docs":
      return (
        <>
          <rect x="10" y="18" width="100" height="4" rx="2" fill="#ffffff14" />
          <rect x="10" y="27" width="70" height="3" rx="1.5" fill="#ffffff0c" />
          <rect x="10" y="34" width="84" height="3" rx="1.5" fill="#ffffff0c" />
          <rect x="10" y="41" width="58" height="3" rx="1.5" fill="#ffffff0c" />
          <rect x="4" y="58" width="112" height="12" rx="3" fill={`${COLOR.battery}14`} stroke={`${COLOR.battery}55`} />
          <rect x="9" y="62" width="28" height="4" rx="2" fill={COLOR.battery} />
          <circle cx="105" cy="64" r="3" fill={COLOR.grid_exp} />
        </>
      );

    case "roadmap-static": {
      const cols = [14, 50, 86];
      return (
        <>
          {cols.map((x, ci) => (
            <g key={ci}>
              <rect x={x} y="16" width="22" height="3.5" rx="1.75" fill="#ffffff18" />
              {[26, 36, 46].map((y, ri) => (
                <rect key={ri} x={x} y={y} width="22" height="6" rx="1.5" fill="#ffffff08" stroke={C.line} />
              ))}
            </g>
          ))}
        </>
      );
    }

    case "roadmap-edit": {
      const cols = [
        { x: 14, c: COLOR.grid_exp },
        { x: 50, c: COLOR.battery },
        { x: 86, c: "#8C92AC" },
      ];
      return (
        <>
          {cols.map((o, ci) => (
            <g key={ci}>
              <rect x={o.x} y="16" width="22" height="3.5" rx="1.75" fill={`${o.c}`} opacity="0.7" />
              {[26, 36, 46].map((y, ri) => (
                <g key={ri}>
                  <rect
                    x={o.x}
                    y={y}
                    width="22"
                    height="6"
                    rx="1.5"
                    fill={ci === 1 && ri === 0 ? `${COLOR.battery}22` : "#ffffff08"}
                    stroke={ci === 1 && ri === 0 ? `${COLOR.battery}66` : C.line}
                  />
                  <circle cx={o.x + 2.5} cy={y + 2} r="0.7" fill="#ffffff40" />
                  <circle cx={o.x + 2.5} cy={y + 4} r="0.7" fill="#ffffff40" />
                </g>
              ))}
            </g>
          ))}
          {/* Bearbeiten-Stift */}
          <path d="M104 58 l6 -6 3 3 -6 6 -3 0 z" fill={`${COLOR.pv}`} opacity="0.85" />
        </>
      );
    }

    case "auto":
      return (
        <>
          {[20, 34, 48].map((y, i) => (
            <g key={i}>
              <rect x="12" y={y} width="96" height="10" rx="2" fill="#ffffff06" stroke={C.line} />
              <circle cx="19" cy={y + 5} r="2.6" fill="none" stroke={COLOR.grid_exp} strokeWidth="1.1" />
              <path d={`M17.6 ${y + 5} l1 1 l2 -2.2`} fill="none" stroke={COLOR.grid_exp} strokeWidth="1" />
              <rect x="26" y={y + 3.5} width={[52, 40, 60][i]} height="3" rx="1.5" fill="#ffffff1c" />
            </g>
          ))}
          <rect x="12" y="63" width="22" height="4" rx="2" fill={COLOR.grid_exp} opacity="0.55" />
        </>
      );

    default:
      return null;
  }
}

export function MiniMock({ variant, accent, className = "" }) {
  return (
    <svg viewBox="0 0 120 76" className={className} role="img" aria-hidden="true">
      <rect x="0.5" y="0.5" width="119" height="75" rx="6" fill={C.panel} stroke={accent || C.line} />
      <rect x="0.5" y="0.5" width="119" height="11" rx="6" fill="#ffffff08" />
      {dots()}
      {scene(variant)}
    </svg>
  );
}
