import { C } from "../lib/theme.js";
import { inputStyle } from "../styles/common.js";

// 틀린 문제 번호를 입력하는 위젯.
// 총 문항수를 알고 있으면(대부분의 경우) 1~N 번호를 탭해서 틀린 것만 고르는 방식 — 콤마로 직접 입력하는 것보다
// 오타 걱정 없이 빠르고, 이미 입력해둔 총 문항수를 그대로 활용할 수 있어서 이 방식으로 만들었습니다.
// 총 문항수를 모르는 경우에만 콤마로 구분해서 직접 입력하는 방식으로 대체됩니다.
export default function WrongNumbersPicker({ totalQuestions, value, onChange }) {
  const wrongSet = new Set(value || []);

  function toggle(n) {
    const next = new Set(wrongSet);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    onChange([...next].sort((a, b) => a - b));
  }

  if (totalQuestions && totalQuestions > 0 && totalQuestions <= 100) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((n) => {
          const wrong = wrongSet.has(n);
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                fontSize: 10.5,
                cursor: "pointer",
                border: `1px solid ${wrong ? C.warn : C.line}`,
                background: wrong ? C.warnSoft : "#fff",
                color: wrong ? C.warn : C.sub,
                fontWeight: wrong ? 700 : 400,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    );
  }

  // 총 문항수를 모를 때의 대체 입력 — 콤마로 구분한 숫자
  return (
    <input
      value={(value || []).join(", ")}
      onChange={(e) => {
        const nums = e.target.value
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        onChange(nums);
      }}
      placeholder="예: 3, 7, 12, 15"
      style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
    />
  );
}
