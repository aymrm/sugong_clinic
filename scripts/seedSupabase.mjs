// Supabase 프로젝트에 데모 데이터를 한 번에 채워 넣는 스크립트.
// src/lib/seed.js의 샘플 데이터를, 이미 검증된 동기화 로직(src/lib/sync.js)을 그대로 재사용해서 밀어넣습니다.
//
// 사용법:
//   1) Supabase 대시보드 → Project Settings → API에서 "service_role" 키를 복사 (anon 키 아님! 절대 커밋/공유 금지)
//   2) 아래처럼 환경변수를 주고 실행 (Node 20+ 기준):
//        SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxx node scripts/seedSupabase.mjs
//      또는 .env.seed 파일을 만들어두고:
//        node --env-file=.env.seed scripts/seedSupabase.mjs
//   3) 이미 데이터가 있는 프로젝트에서 실행하면 id가 같은 행은 덮어쓰고(upsert), 새 행은 추가됩니다.

import { seedState } from "../src/lib/seed.js";
import { syncDiff } from "../src/lib/sync.js";

const EMPTY = {
  teachers: [], students: [], courses: [], enrollments: [], studentAssignments: [],
  assignmentTemplates: [], courseCurriculum: [], materialLibrary: [], teacherNotes: [], examSessions: [],
  seats: [], roomMarkers: [], scheduleEntries: [], scheduleSkips: [], sessions: [],
};

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다. 스크립트 상단 주석을 참고하세요.");
  process.exit(1);
}

console.log("Supabase에 데모 데이터를 넣는 중...");
await syncDiff(EMPTY, seedState());
console.log("완료! 이제 앱에 로그인해서 데모 데이터를 확인해보세요.");
