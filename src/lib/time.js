export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function nowHM() {
  return new Date().toTimeString().slice(0, 5);
}

// "17:20" + 30(분) -> "17:50" 같은 시각 덧셈. 자정 넘어가는 경우도 처리(24시간 내로 wrap).
export function addMinutesToTime(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  let total = h * 60 + m + Number(minutes || 0);
  total = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// "17:20" - "17:00" -> 20(분) 같은 두 시각 사이의 분 차이. 자정을 넘나드는 경우는 고려하지 않음(같은 날 안에서만 사용).
export function timeDiffMinutes(from, to) {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  return th * 60 + tm - (fh * 60 + fm);
}

export function deepClone(obj) {
  return typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
}
