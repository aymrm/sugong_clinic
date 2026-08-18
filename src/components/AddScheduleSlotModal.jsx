import { useState } from "react";
import Modal from "./Modal.jsx";
import WeekdayPicker from "./ui/WeekdayPicker.jsx";
import { C, WEEKDAY } from "../lib/theme.js";
import { inputStyle, btnAccent, btnGhostSm } from "../styles/common.js";

// 반에 학생의 요일/시간을 등록하는 팝업.
// 같은 반이어도 학생마다 다른 요일에 클리닉 하는 경우가 있어서, 이 반에 등록된 클리닉 시간대(반 관리에서
// 설정)와 학생들이 이미 많이 쓰는 시간을 우선적으로 보여주고 그대로 고르거나, 다른 시간으로 직접 설정할 수 있게 했습니다.
// (이미 소속된 학생에게 시간대를 "추가"할 때도 같은 팝업을 써서, 한 학생이 같은 반을 여러 요일/시간에 나눠 들을 수도 있어요.)
export default function AddScheduleSlotModal({ data, course, onPick, onClose }) {
  const courseSlots = [{ dayOfWeek: course.dayOfWeek, start: course.start, end: course.end }, ...(course.extraTimeSlots || [])];

  const slots = data.scheduleEntries.filter((e) => e.courseId === course.id && e.recurrence === "weekly");
  const freq = new Map();
  slots.forEach((s) => {
    const key = s.dayOfWeek + "|" + s.start + "|" + s.end;
    if (!freq.has(key)) freq.set(key, { dayOfWeek: s.dayOfWeek, start: s.start, end: s.end, count: 0 });
    freq.get(key).count++;
  });
  const popular = [...freq.values()].sort((a, b) => b.count - a.count || a.dayOfWeek - b.dayOfWeek);

  const [dayOfWeek, setDayOfWeek] = useState(course.dayOfWeek);
  const [start, setStart] = useState(course.start);
  const [end, setEnd] = useState(course.end);

  return (
    <Modal
      title={`${course.name} · 요일/시간 선택`}
      onClose={onClose}
      width={380}
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ ...btnGhostSm, flex: 1, padding: "9px 0" }}>
            취소
          </button>
          <button onClick={() => onPick(Number(dayOfWeek), start, end)} style={{ ...btnAccent, flex: 1 }}>
            이 시간으로 추가
          </button>
        </div>
      }
    >
      <div style={{ marginBottom: 16, paddingTop: 4 }}>
        <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 700, marginBottom: 6 }}>이 반에 등록된 클리닉 시간대</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {courseSlots.map((p, i) => (
            <button
              key={i}
              onClick={() => onPick(p.dayOfWeek, p.start, p.end)}
              style={{ textAlign: "left", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", background: "#fff", cursor: "pointer" }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                {WEEKDAY[p.dayOfWeek]}요일 {p.start}~{p.end}
              </span>
            </button>
          ))}
        </div>
      </div>

      {popular.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 700, marginBottom: 6 }}>이 반 학생들이 많이 듣는 시간</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {popular.map((p, i) => (
              <button
                key={i}
                onClick={() => onPick(p.dayOfWeek, p.start, p.end)}
                style={{
                  textAlign: "left",
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  padding: "9px 11px",
                  background: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {WEEKDAY[p.dayOfWeek]}요일 {p.start}~{p.end}
                </span>
                <span style={{ fontSize: 11, color: C.sub }}>{p.count}명</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 700, marginBottom: 6 }}>다른 시간으로 직접 설정</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <WeekdayPicker value={Number(dayOfWeek)} onChange={setDayOfWeek} size={30} />
        <div style={{ display: "flex", gap: 6 }}>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
          <span style={{ color: C.sub, fontSize: 12, alignSelf: "center" }}>~</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
        </div>
      </div>
    </Modal>
  );
}
