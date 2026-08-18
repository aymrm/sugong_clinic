import { C, WEEKDAY } from "../../lib/theme.js";

// 요일이 7개뿐이라 드롭다운(클릭→스크롤→클릭)보다 버튼 7개를 바로 누르는 게 훨씬 빠릅니다.
// value: 0(일)~6(토), onChange(다음 값)
export default function WeekdayPicker({ value, onChange, size = 34 }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {WEEKDAY.map((w, i) => {
        const active = value === i;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            style={{
              width: size,
              height: size,
              borderRadius: 8,
              border: `1px solid ${active ? C.accent : C.line}`,
              background: active ? C.accent : "#fff",
              color: active ? "#fff" : C.ink,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {w}
          </button>
        );
      })}
    </div>
  );
}
