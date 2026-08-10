import { useState } from "react";
import Modal from "./Modal.jsx";
import { C } from "../lib/theme.js";
import { inputStyle, btnAccent, btnGhostSm, btnWarnGhostSm } from "../styles/common.js";

// 교재/학습지 이름을 고르거나 새로 등록하는 팝업.
// - 교재: 학원 전체가 공유하는 목록. 새로 입력하면 모든 선생님 화면에 바로 뜹니다.
// - 학습지: 내가 등록한 것이 먼저 보이고, 다른 선생님이 등록한 것도 찾아서 쓸 수 있습니다.
// - "삭제"는 실제로 지우는 게 아니라 목록(팝업)에서만 안 보이게 숨깁니다.
export default function MaterialPickerModal({ data, updateData, currentTeacherId, onPick, onClose }) {
  const [tab, setTab] = useState("교재"); // '교재' | '학습지'
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const q = search.trim().toLowerCase();

  const library = data.materialLibrary || [];
  const visible = library.filter((m) => m.type === tab && !m.hidden && (!q || m.name.toLowerCase().includes(q)));

  const mine = tab === "학습지" ? visible.filter((m) => m.teacherId === currentTeacherId) : visible;
  const others = tab === "학습지" ? visible.filter((m) => m.teacherId !== currentTeacherId) : [];

  function teacherLabel(teacherId) {
    return data.teachers.find((t) => t.id === teacherId)?.name || "다른 선생님";
  }

  function pick(name) {
    onPick(name);
    onClose();
  }

  function hide(id) {
    updateData((next) => {
      const m = next.materialLibrary.find((x) => x.id === id);
      if (m) m.hidden = true;
    });
  }

  function addAndPick() {
    const name = newName.trim();
    if (!name) return;
    const id = "mat_" + Date.now();
    updateData((next) => {
      if (!next.materialLibrary) next.materialLibrary = [];
      next.materialLibrary.push({
        id,
        type: tab,
        name,
        teacherId: tab === "학습지" ? currentTeacherId : null,
        hidden: false,
      });
    });
    pick(name);
  }

  return (
    <Modal title="교재/학습지 선택" onClose={onClose} width={420}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, paddingTop: 4 }}>
        {["교재", "학습지"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              border: `1px solid ${tab === t ? C.accent : C.line}`,
              background: tab === t ? C.accentSoft : "#fff",
              color: tab === t ? C.accentText : C.sub,
              fontWeight: 700,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`${tab} 이름 검색`}
        style={{ ...inputStyle, width: "100%", marginBottom: 12, boxSizing: "border-box" }}
      />

      <div style={{ maxHeight: 280, overflowY: "auto", marginBottom: 14 }}>
        {tab === "학습지" && <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 6 }}>내 학습지 ({mine.length})</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: tab === "학습지" ? 14 : 0 }}>
          {mine.map((m) => (
            <MaterialRow key={m.id} m={m} onPick={() => pick(m.name)} onHide={() => hide(m.id)} />
          ))}
          {mine.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>{tab === "학습지" ? "아직 등록한 학습지가 없어요." : "등록된 교재가 없어요."}</div>}
        </div>

        {tab === "학습지" && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 6 }}>다른 선생님 학습지 ({others.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {others.map((m) => (
                <MaterialRow key={m.id} m={m} onPick={() => pick(m.name)} onHide={() => hide(m.id)} teacherLabel={teacherLabel(m.teacherId)} />
              ))}
              {others.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>다른 선생님이 등록한 학습지가 없어요.</div>}
            </div>
          </>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 6 }}>목록에 없으면 새로 등록 — {tab === "교재" ? "모든 선생님 화면에 바로 추가돼요" : "내 학습지 목록에 추가돼요"}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`새 ${tab} 이름`}
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => e.key === "Enter" && addAndPick()}
          />
          <button onClick={addAndPick} disabled={!newName.trim()} style={btnAccent}>
            등록하고 사용
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MaterialRow({ m, onPick, onHide, teacherLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px" }}>
      <button onClick={onPick} style={{ flex: 1, textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{m.name}</span>
        {teacherLabel && <span style={{ fontSize: 10.5, color: C.sub, marginLeft: 6 }}>{teacherLabel}</span>}
      </button>
      <button onClick={onHide} style={btnWarnGhostSm} title="목록에서 숨기기(실제로 지워지지 않아요)">
        삭제
      </button>
    </div>
  );
}
