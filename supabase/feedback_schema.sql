-- ============================================================
-- 피드백 보조 앱 — 추가 스키마
-- schema.sql을 먼저 실행한 뒤, 이 파일 전체를 Supabase SQL Editor에서 실행하세요.
-- 여러 번 실행해도 안전하도록(if not exists / or replace) 작성했습니다.
-- ============================================================

-- ------------------------------------------------------------
-- 0. 공용 설정 (학원 이름, 캠퍼스, 채점 표시 규칙, 원문 저장 여부 등) — 한 행만 씁니다.
-- ------------------------------------------------------------
create table if not exists fb_settings (
  id text primary key default 'global',
  academy_name text not null default '수학공감',
  campus_name text not null default '',
  report_title text not null default '주간 관리 TEST REPORT',
  grading_mark_rule text not null default '빨간 체크(✓)나 빗금은 오답, 동그라미(○)는 정답 표시로 읽는다.',
  -- 시험지·문제집 원문 텍스트를 DB에 저장할지 여부. 끄면 AI 분석 결과(단원·난이도 등)만 저장합니다.
  store_original_text boolean not null default true,
  -- 학습지 사진 보관 기간(일). null이면 기한 없이 보관.
  worksheet_photo_retention_days int,
  updated_at timestamptz not null default now()
);
insert into fb_settings (id) values ('global') on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 1. 기존 테이블 보강
-- ------------------------------------------------------------
-- 선생님마다 주 시작 요일(0=일 … 6=토, 기본 월요일)과 리포트에 찍힐 표기 이름("홍길동T")
alter table teachers add column if not exists week_start_dow int not null default 1;
alter table teachers add column if not exists report_name text;

create table if not exists schools (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  region text,
  kind text, -- 일반고/자사고/특목고/중학교 등
  created_at timestamptz not null default now()
);
create unique index if not exists schools_name_uidx on schools (name);

-- 담임(메인 선생님)과 학교 연결
alter table students add column if not exists homeroom_teacher_id text references teachers(id) on delete set null;
alter table students add column if not exists school_id text references schools(id) on delete set null;
-- 리포트 머리글에 찍히는 반 이름(예: "2026년 고2-개별지도반"). 비우면 담임 반 이름을 씁니다.
alter table students add column if not exists report_class_label text;

-- ------------------------------------------------------------
-- 2. 접근 권한 도우미
-- ------------------------------------------------------------
create or replace function my_teacher_id()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select id from teachers where auth_user_id = auth.uid() limit 1;
$$;

-- 이 학생을 볼 수 있는가: 관리자 / 담임 / 이 학생이 듣는 반의 담당 선생님
create or replace function can_access_student(sid text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_admin()
    or exists (select 1 from students s where s.id = sid and s.homeroom_teacher_id = my_teacher_id())
    or exists (
      select 1 from enrollments e join courses c on c.id = e.course_id
      where e.student_id = sid and c.teacher_id = my_teacher_id()
    );
$$;

-- ------------------------------------------------------------
-- 3. 수업일 기록 · 주간 피드백 · 주간 리포트
-- ------------------------------------------------------------
create table if not exists daily_records (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references students(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  date date not null,
  attendance text not null default '출석', -- 출석 | 지각 | 결석 | 조퇴 | 보강
  attendance_note text,
  progress_unit text,       -- 수업 진도 단원명
  progress_material text,   -- 교재명
  progress_range text,      -- 예: p.38-p.50
  clinic_type text,         -- 교재 메우기 | 테스트 | 오답 | 기타
  clinic_detail text,
  test_name text,
  test_score numeric,
  test_total numeric,
  homework_material text,
  homework_status text,     -- ○ | △ | X
  memo text,
  updated_by text references teachers(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (student_id, course_id, date)
);
create index if not exists daily_records_student_date on daily_records (student_id, date);

create table if not exists weekly_feedback (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references students(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  week_start date not null,
  teacher_id text references teachers(id) on delete set null,
  memo text,                 -- 선생님이 AI에게 주는 짧은 메모
  homework_text text,        -- ○ 과제 줄 (비우면 수업일 기록에서 자동 생성)
  achievement_draft text,
  achievement text,
  plan_draft text,
  plan text,
  include_in_report boolean not null default true, -- 서브 과목: 피드백을 리포트에 붙일지
  status text not null default 'draft',            -- draft | submitted | confirmed
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (student_id, course_id, week_start)
);

create table if not exists weekly_reports (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references students(id) on delete cascade,
  week_start date not null,
  confirmed_by text references teachers(id) on delete set null,
  confirmed_at timestamptz,
  sent_at timestamptz,
  snapshot jsonb, -- 확정 당시 리포트 내용
  unique (student_id, week_start)
);

-- 앱 도입 전 엑셀 피드백을 붙여넣어 이력·문체 예시로 씁니다.
create table if not exists past_feedback (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references students(id) on delete cascade,
  teacher_id text references teachers(id) on delete set null,
  week_label text,  -- 예: "26.10.4주차"
  week_start date,
  body text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. 학생 · 학부모 메모, 상담
-- ------------------------------------------------------------
create table if not exists student_notes (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references students(id) on delete cascade,
  author_id text references teachers(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists parent_notes (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references students(id) on delete cascade,
  author_id text references teachers(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists counseling_logs (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references students(id) on delete cascade,
  teacher_id text references teachers(id) on delete set null,
  date date not null default current_date,
  target text not null default '학부모', -- 학부모 | 학생
  content text not null,
  reaction text,
  follow_up text,
  created_at timestamptz not null default now()
);
create table if not exists counseling_suggestions (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references students(id) on delete cascade,
  week_start date not null,
  reasons jsonb,  -- [{code, label, detail}]
  result jsonb,   -- {talking_points[], script, avoid[]}
  created_by text references teachers(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. 학습지 분석
-- ------------------------------------------------------------
create table if not exists answer_keys (
  id text primary key default gen_random_uuid()::text,
  material text not null,
  range_text text,
  answers jsonb,      -- [{num, answer}]
  image_paths jsonb,  -- 정답지 사진(Storage 경로)
  created_at timestamptz not null default now()
);

create table if not exists worksheet_uploads (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references students(id) on delete cascade,
  course_id text references courses(id) on delete set null,
  teacher_id text references teachers(id) on delete set null,
  date date not null default current_date,
  material text,
  range_text text,
  answer_key_id text references answer_keys(id) on delete set null,
  image_paths jsonb not null default '[]'::jsonb,
  status text not null default 'pending', -- pending | processing | done | error
  error text,
  summary text,
  patterns jsonb, -- ["조건 해석", ...]
  created_at timestamptz not null default now(),
  analyzed_at timestamptz
);
create index if not exists worksheet_uploads_student on worksheet_uploads (student_id, date desc);

create table if not exists worksheet_problems (
  id text primary key default gen_random_uuid()::text,
  upload_id text not null references worksheet_uploads(id) on delete cascade,
  student_id text not null references students(id) on delete cascade,
  num text,
  page_index int not null default 0,
  bbox jsonb,            -- {x,y,w,h} 0~1 비율, 사진에서 이 문제가 있는 영역
  ai_verdict text,       -- right | wrong | partial | unknown
  verdict text,          -- 선생님이 확정한 값(처음엔 ai_verdict와 같음)
  summary text,
  student_answer text,
  correct_answer text,
  reading text,
  evidence jsonb,        -- [{obs, judge}]
  understood text,
  suggest text,
  uncertain text,
  reviewed boolean not null default false,
  include_in_feedback boolean not null default true,
  teacher_note text,
  sort int not null default 0
);
create index if not exists worksheet_problems_upload on worksheet_problems (upload_id, sort);

-- ------------------------------------------------------------
-- 6. 학교 · 시험 · 문제집
-- ------------------------------------------------------------
create table if not exists school_profiles (
  id text primary key default gen_random_uuid()::text,
  school_id text not null references schools(id) on delete cascade,
  year int not null,
  grade text not null,   -- 고1/고2/...
  subject text not null, -- 수학/수학Ⅰ/미적분 ...
  exam_tendency text,    -- 출제 경향
  source_ratio text,     -- 교과서/부교재/외부 비중
  essay_ratio text,      -- 서술형 비중
  difficulty text,       -- 체감 난이도
  exam_dates jsonb,      -- [{label:"1학기 기말", date:"2026-07-01"}]
  teacher_change text,   -- 출제 선생님 변동 등
  notes text,
  trend_summary text,    -- AI 경향 분석 결과 저장
  updated_by text references teachers(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (school_id, year, grade, subject)
);

-- 시험지: 학교 내신 / 모의고사 / 수능을 한 테이블에서 다룹니다.
--   source_type = '학교'    → school_id, semester, exam_type(중간/기말) 사용
--   source_type = '모의고사' → exam_org(교육청/평가원/사설), exam_month(3·6·9·11월 등) 사용
--   source_type = '수능'     → year, subject만 있으면 됨
-- 경향 비교는 "같은 계열"끼리 합니다: 학교는 학교+학년+과목, 모의고사는 주관+월+학년+과목, 수능은 과목.
create table if not exists exam_papers (
  id text primary key default gen_random_uuid()::text,
  source_type text not null default '학교', -- 학교 | 모의고사 | 수능
  school_id text references schools(id) on delete cascade,
  exam_org text,          -- 교육청 | 평가원 | 사설(출판사명)
  exam_month int,         -- 모의고사 시행 월
  exam_name text,         -- 표시용 이름(예: "2026 6월 평가원 모의평가")
  year int not null,
  semester int not null default 1,
  exam_type text not null default '중간', -- 학교: 중간 | 기말 | 기타
  grade text,
  subject text,
  image_paths jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  error text,
  summary text,
  created_by text references teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  analyzed_at timestamptz
);
-- 이전 버전 스키마를 이미 실행했던 경우를 위한 보강
alter table exam_papers add column if not exists source_type text not null default '학교';
alter table exam_papers add column if not exists exam_org text;
alter table exam_papers add column if not exists exam_month int;
alter table exam_papers add column if not exists exam_name text;
alter table exam_papers alter column school_id drop not null;
-- 모의고사·수능: 등급컷(예: {"1":92,"2":84,...})과 문항별 정답률을 알고 있으면 넣어둡니다.
alter table exam_papers add column if not exists grade_cuts jsonb;

-- 학생의 목표(내신/수능/둘 다)와 현재 수준 — 문제집 추천과 상담에 씁니다.
alter table students add column if not exists track text;          -- 내신 | 수능 | 내신+수능
alter table students add column if not exists current_level text;  -- 예: 내신 3등급, 모의 4등급
alter table students add column if not exists goal text;           -- 예: 수능 2등급, 미적분 선택

create table if not exists exam_items (
  id text primary key default gen_random_uuid()::text,
  paper_id text not null references exam_papers(id) on delete cascade,
  num text,
  unit text,
  item_type text,
  difficulty int,        -- 1(쉬움) ~ 5(최고난도)
  points numeric,
  is_essay boolean,
  source_kind text,      -- 교과서 | 교과서 변형 | 부교재 | 외부 | 신유형
  concepts jsonb,        -- ["미분계수", ...]
  original_text text,    -- fb_settings.store_original_text가 꺼져 있으면 비워둡니다
  answer_rate numeric,   -- 정답률(%) — 모의고사·수능에서 공개된 값이 있으면
  sort int not null default 0
);
alter table exam_items add column if not exists answer_rate numeric;

create table if not exists materials (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  publisher text,
  subject text,
  target_level text,     -- 예: 3~5등급, 1~2등급
  units jsonb,           -- [{unit, difficulty, notes}]
  item_types text,       -- 다루는 유형 설명
  teacher_rating text,
  notes text,
  content_text text,     -- 원문(선택). store_original_text가 꺼져 있으면 저장하지 않습니다
  created_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 6-1. 교육과정(개정) · 과목 · 풀이 규칙
-- ------------------------------------------------------------
-- 같은 문제라도 학생이 배운 교육과정·과목에 따라 "써도 되는 풀이"가 다릅니다.
-- 예) 22개정 기하에는 공간벡터가 있지만 15개정 기하에는 없음, 삼각함수 덧셈정리는 대수(수학Ⅰ) 범위에서 쓰지 않음.
-- AI가 학습지 분석·피드백·추천을 할 때 이 표를 함께 봅니다. 선생님은 앱의 AI 도우미에게 말로 알려주면 됩니다.
create table if not exists curricula (
  id text primary key,          -- '2015', '2022'
  name text not null,           -- '2015 개정'
  applies_from text,            -- 적용 대상 설명(예: 2025년 고1 입학생부터)
  notes text,
  sort int not null default 0
);

create table if not exists curriculum_subjects (
  id text primary key default gen_random_uuid()::text,
  curriculum_id text not null references curricula(id) on delete cascade,
  name text not null,           -- 공통수학1, 대수, 미적분Ⅰ, 수학Ⅰ ...
  kind text,                    -- 공통 | 일반선택 | 진로선택 | 융합선택
  usual_grade text,             -- 보통 배우는 학년(예: 고1)
  units jsonb,                  -- [{name, topics:[...]}] 배우는 순서대로
  in_suneung boolean,           -- 이 교육과정 대상 수능 출제 범위인지
  notes text,
  source text,                  -- 출처(교육과정 문서, 기사, 선생님 입력 등)
  sort int not null default 0,
  unique (curriculum_id, name)
);

create table if not exists method_rules (
  id text primary key default gen_random_uuid()::text,
  curriculum_id text references curricula(id) on delete cascade, -- 비우면 모든 교육과정에 적용
  subject text not null,        -- 이 규칙이 적용되는 과목(이 과목 문제를 풀 때)
  kind text not null default '금지', -- 금지 | 주의 | 허용
  rule text not null,           -- 예: 삼각함수 덧셈정리를 쓰지 않는다
  reason text,                  -- 예: 덧셈정리는 미적분Ⅱ에서 배움
  source text,
  created_by text references teachers(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table students add column if not exists curriculum_id text references curricula(id) on delete set null;
alter table exam_papers add column if not exists curriculum_id text references curricula(id) on delete set null;

-- 확인된 내용만 기본값으로 넣어 둡니다. 나머지는 AI 도우미로 채워주세요.
insert into curricula (id, name, applies_from, notes, sort) values
  ('2015', '2015 개정', '2024년 이전 고1 입학생', null, 1),
  ('2022', '2022 개정', '2025년 고1 입학생부터 (2028학년도 수능부터)', '고1 내신 5등급제', 2)
on conflict (id) do nothing;

insert into curriculum_subjects (curriculum_id, name, kind, usual_grade, in_suneung, notes, source, sort) values
  ('2022', '공통수학1', '공통', '고1', null, '행렬(기본 연산, 역행렬 제외) 재도입, 경우의 수·순열·조합 포함', '내일신문 2022 개정 수학 기사', 1),
  ('2022', '공통수학2', '공통', '고1', null, '도형의 방정식 포함', '내일신문 2022 개정 수학 기사', 2),
  ('2022', '대수', '일반선택', '고2', true, '2015 개정 수학Ⅰ에 해당', '내일신문 기사, 교육부 2028 대입 개편안', 3),
  ('2022', '미적분Ⅰ', '일반선택', '고2', true, '2015 개정 수학Ⅱ에 해당', '내일신문 기사, 교육부 2028 대입 개편안', 4),
  ('2022', '확률과 통계', '일반선택', '고2', true, '원순열 제외, 모비율 재도입', '내일신문 기사, 교육부 2028 대입 개편안', 5),
  ('2022', '미적분Ⅱ', '진로선택', '고3', false, '삼각함수 덧셈정리 포함(선생님 입력)', '교육부 2028 대입 개편안(수능 제외), 선생님 입력', 6),
  ('2022', '기하', '진로선택', '고3', false, '공간벡터 재도입, 벡터를 공간도형 뒤에 배움(선생님 입력)', '내일신문 기사, 선생님 입력', 7),
  ('2015', '수학(상)', '공통', '고1', null, null, null, 1),
  ('2015', '수학(하)', '공통', '고1', null, null, null, 2),
  ('2015', '수학Ⅰ', '일반선택', '고2', true, null, null, 3),
  ('2015', '수학Ⅱ', '일반선택', '고2', true, null, null, 4),
  ('2015', '확률과 통계', '일반선택', '고2', true, null, null, 5),
  ('2015', '미적분', '일반선택', '고2~3', true, '삼각함수 덧셈정리 포함', null, 6),
  ('2015', '기하', '진로선택', '고3', true, '평면벡터 다음 공간도형·공간좌표, 공간벡터 없음(선생님 입력)', '선생님 입력', 7)
on conflict (curriculum_id, name) do nothing;

insert into method_rules (curriculum_id, subject, kind, rule, reason, source)
select * from (values
  ('2015', '기하', '금지', '공간도형·공간좌표 문제에서 공간벡터(내적·성분)를 쓰지 않는다', '15개정 기하에는 공간벡터가 없음', '선생님 입력'),
  ('2022', '대수', '금지', '삼각함수 덧셈정리를 쓰지 않는다', '덧셈정리는 미적분Ⅱ에서 배움', '선생님 입력'),
  ('2015', '수학Ⅰ', '금지', '삼각함수 덧셈정리를 쓰지 않는다', '덧셈정리는 미적분에서 배움', '선생님 입력')
) as v(curriculum_id, subject, kind, rule, reason, source)
where not exists (select 1 from method_rules);

create table if not exists recommendations (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references students(id) on delete cascade,
  created_by text references teachers(id) on delete set null,
  input jsonb,
  result jsonb,  -- {summary, materials:[{name, focus, reason}], steps[], cautions[]}
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. RLS
-- ------------------------------------------------------------
-- 학생에 딸린 정보: 그 학생의 담임·담당 선생님·관리자만
do $$
declare t text;
begin
  for t in select unnest(array[
    'daily_records','weekly_feedback','weekly_reports','past_feedback',
    'student_notes','parent_notes','counseling_logs','counseling_suggestions',
    'worksheet_uploads','worksheet_problems','recommendations'
  ]) loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "student scoped" on %I;', t);
    execute format(
      'create policy "student scoped" on %I for all using (can_access_student(student_id)) with check (can_access_student(student_id));',
      t
    );
  end loop;
end $$;

-- 학원 공용 자료: 온보딩된 선생님이면 누구나
do $$
declare t text;
begin
  for t in select unnest(array[
    'schools','school_profiles','exam_papers','exam_items','materials','answer_keys',
    'curricula','curriculum_subjects','method_rules'
  ]) loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "onboarded full access" on %I;', t);
    execute format(
      'create policy "onboarded full access" on %I for all using (is_onboarded()) with check (is_onboarded());',
      t
    );
  end loop;
end $$;

-- 설정: 읽기는 누구나(온보딩), 수정은 관리자만
alter table fb_settings enable row level security;
drop policy if exists "settings read" on fb_settings;
drop policy if exists "settings write" on fb_settings;
create policy "settings read" on fb_settings for select using (is_onboarded());
create policy "settings write" on fb_settings for all using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- 8. 사진 저장소 (학습지·시험지·정답지)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fb-images', 'fb-images', false)
on conflict (id) do nothing;

drop policy if exists "fb images read" on storage.objects;
drop policy if exists "fb images write" on storage.objects;
drop policy if exists "fb images delete" on storage.objects;
create policy "fb images read" on storage.objects for select
  using (bucket_id = 'fb-images' and is_onboarded());
create policy "fb images write" on storage.objects for insert
  with check (bucket_id = 'fb-images' and is_onboarded());
create policy "fb images delete" on storage.objects for delete
  using (bucket_id = 'fb-images' and is_onboarded());

-- 서브 선생님이 제출하면 담임 화면에 바로 반영되도록 실시간 변경 알림을 켭니다.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'weekly_feedback') then
    alter publication supabase_realtime add table weekly_feedback;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'worksheet_uploads') then
    alter publication supabase_realtime add table worksheet_uploads;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'exam_papers') then
    alter publication supabase_realtime add table exam_papers;
  end if;
end $$;

-- ------------------------------------------------------------
-- 9. 개선 요청함: 선생님 요청 중 DB 구조나 앱 기능을 바꿔야 해결되는 것을 모아둡니다.
--    AI 도우미가 스스로 남기거나, 선생님이 직접 남깁니다. 관리자(개발 담당)가 보고 반영합니다.
-- ------------------------------------------------------------
create table if not exists dev_requests (
  id text primary key default gen_random_uuid()::text,
  created_by text references teachers(id) on delete set null,
  source text not null default 'manual',   -- assistant | manual
  category text not null default '기타',    -- DB 구조 | 앱 기능 | AI 동작 | 기타
  title text not null,
  problem text,        -- 선생님이 하려던 것
  why_blocked text,    -- 지금 구조로 안 되는 이유
  suggestion text,     -- 제안하는 변경(표·칸·화면 등)
  example text,        -- 원래 요청 문장
  status text not null default 'new',      -- new | reviewing | done | rejected
  admin_note text,
  count int not null default 1,            -- 같은 요청이 반복된 횟수
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table dev_requests enable row level security;
drop policy if exists "dev req insert" on dev_requests;
drop policy if exists "dev req select" on dev_requests;
drop policy if exists "dev req update" on dev_requests;
drop policy if exists "dev req delete" on dev_requests;
create policy "dev req insert" on dev_requests for insert with check (is_onboarded());
-- 본인이 남긴 것과 관리자는 전체를 봅니다(AI가 같은 요청을 찾아 횟수를 올릴 수 있게 온보딩된 사람은 읽기 허용).
create policy "dev req select" on dev_requests for select using (is_onboarded());
create policy "dev req update" on dev_requests for update using (is_admin() or created_by = my_teacher_id()) with check (is_admin() or created_by = my_teacher_id());
create policy "dev req delete" on dev_requests for delete using (is_admin());
