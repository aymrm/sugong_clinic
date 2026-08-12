export const C = {
  bg: "#F4F6F5",
  panel: "#FFFFFF",
  ink: "#1E2A28",
  sub: "#5C6B68",
  line: "#E1E6E3",
  accent: "#1B6E63",
  accentSoft: "#E6F1EE",
  accentText: "#0F4A42",
  warn: "#B5562B",
  warnSoft: "#FBEAE1",
  gold: "#B58B2E",
  goldSoft: "#F7F0DE",
  seatEmpty: "#EDEFEC",
  seatWait: "#F7F0DE",
  seatDone: "#E6F1EE",
};

export const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export const ASSIGNMENT_TYPES = ["숙제", "공부", "시험", "지시사항"];

export const TYPE_COLOR = {
  "숙제": { bg: "#F7F0DE", fg: "#B58B2E" },
  "공부": { bg: "#E6F1EE", fg: "#0F4A42" },
  "시험": { bg: "#FBEAE1", fg: "#B5562B" },
  "지시사항": { bg: "#E7E3F5", fg: "#5B4B9E" },
};

// 클리닉실에서 해야 하는 일의 타이밍 구분 — 담당 선생님이 학생별로 지정.
// "퇴실" 항목은 클리닉 중 학습을 다 못 끝냈어도 반드시 확인해야 하므로 체크리스트에서 항상 눈에 띄게 따로 보여줍니다.
export const TIMING_OPTIONS = ["입실", "클리닉중", "퇴실"];
export const TIMING_LABELS = { "입실": "입실 시", "클리닉중": "클리닉 중", "퇴실": "퇴실 시" };

// 계정 권한 3단계. admin(사이트 관리자) > (동급) clinic_teacher(클리닉 선생님) · teacher(담당 선생님).
// clinic_teacher와 teacher는 서로 대등한 권한이고, 클리닉 선생님이 담당 선생님의 계정/커리큘럼 템플릿 등을
// 좌우하지 못하도록 "반 관리"(선생님 계정·권한·커리큘럼 템플릿 관리)는 admin만 접근할 수 있습니다.
// 나중에 학생/게스트 같은 권한을 더 추가해도 이 배열/맵에만 더하면 됩니다(role 컬럼은 text라 제약 없음).
export const ROLE_OPTIONS = ["teacher", "clinic_teacher", "admin"];
export const ROLE_LABELS = {
  admin: "관리자",
  clinic_teacher: "클리닉 선생님",
  teacher: "담당 선생님",
};
// 관리자 사이트(오늘의 클리닉/달력/학생 관리/리포트)에 들어올 수 있는 역할.
export const CLINIC_SITE_ROLES = ["admin", "clinic_teacher"];

// 매쓰플랫(등)으로 만든 학습지/시험의 오답 후속 처리 방식 — 담당 선생님이 등록 시 지정.
export const MATHFLAT_FOLLOWUP_OPTIONS = ["none", "wrong_only", "twin", "other"];
export const MATHFLAT_FOLLOWUP_LABELS = {
  none: "오답 진행 안 함",
  wrong_only: "오답만 재풀이",
  twin: "쌍둥이 문제까지 진행",
  other: "기타 (아래 설명 참고)",
};
