// 주간 리포트를 <canvas>에 직접 그려 PNG로 만듭니다(외부 라이브러리 없음).
// 레이아웃은 기존 엑셀 양식(머리글 → 주간 관리 TEST REPORT → 수업일 블록 → 피드백 칸)을 따릅니다.
const FONT = "'Pretendard','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
const W = 900;
const M = 28; // 바깥 여백
const IN = W - M * 2;
const C = {
  ink: "#1C1C1E",
  sub: "#4A4A46",
  line: "#9AA3B5",
  head: "#E8EDF7",
  band: "#1F2A55",
  dateFill: "#F3F5FA",
  subjFill: "#FFF4D1",
};

function font(size, weight = 400) {
  return `${weight} ${size}px ${FONT}`;
}

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text ?? "").split("\n")) {
    if (para === "") {
      out.push("");
      continue;
    }
    // 앞쪽 들여쓰기(공백)는 유지합니다.
    const indent = para.match(/^\s*/)[0];
    let line = "";
    for (const ch of para) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line.trim()) {
        out.push(line);
        line = indent + ch.trimStart();
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

function cellText(ctx, text, x, y, w, h, { size = 14, weight = 400, align = "center", color = C.ink } = {}) {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  const lines = wrap(ctx, text, w - 12);
  const lh = size * 1.35;
  const total = lines.length * lh;
  let ty = y + (h - total) / 2 + lh / 2;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  const tx = align === "center" ? x + w / 2 : x + 8;
  for (const l of lines) {
    ctx.fillText(l, tx, ty);
    ty += lh;
  }
}

function box(ctx, x, y, w, h, fill) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function linesHeight(ctx, text, w, size) {
  ctx.font = font(size);
  return wrap(ctx, text, w - 12).length * size * 1.35;
}

// report = { academy, campus, teacherLabel, classLabel, school, name, title, days[], homework, achievement, plan, subs[] }
export function drawReport(report, scale = 2) {
  const measure = document.createElement("canvas").getContext("2d");
  const dateW = 120;
  const colW = (IN - dateW) / 4;

  // 수업일 블록 높이 계산
  const dayBlocks = report.days.map((d) => {
    const vals1 = [d.attendance || "", d.progressUnit || "", d.clinicType || "", d.testName || ""];
    const vals2 = [d.attendanceNote || "", d.progressRange || "", d.clinicDetail || "", d.testScore || ""];
    const h1 = Math.max(30, ...vals1.map((v) => linesHeight(measure, v, colW, 14) + 10));
    const h2 = Math.max(30, ...vals2.map((v) => linesHeight(measure, v, colW, 13) + 10));
    return { d, vals1, vals2, h1, h2, h: 30 + h1 + h2 };
  });

  const fbText = buildFeedbackText(report);
  measure.font = font(14.5);
  const fbLines = wrap(measure, fbText, IN - 40);
  const fbH = Math.max(220, fbLines.length * 14.5 * 1.6 + 40);

  const H =
    M + 64 + 14 + 36 + 12 + 40 + 16 + 40 + 12 + dayBlocks.reduce((a, b) => a + b.h + 10, 0) + 6 + 40 + 34 + fbH + M;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(W * scale);
  canvas.height = Math.ceil(H * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  let y = M;
  // 머리글: 왼쪽 "수학공감 XXXT", 오른쪽 학원명 상자
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = C.ink;
  ctx.font = font(26, 800);
  ctx.fillText(`${report.academy} ${report.teacherLabel || ""}`.trim(), M + 4, y + 32);
  const bw = 200;
  ctx.strokeStyle = C.band;
  ctx.lineWidth = 2;
  roundRect(ctx, W - M - bw, y + 8, bw, 48, 24);
  ctx.stroke();
  ctx.font = font(20, 800);
  ctx.textAlign = "center";
  ctx.fillText(report.academy, W - M - bw / 2, y + 32);
  y += 64 + 14;

  // 반 이름
  box(ctx, M, y, IN, 36, C.head);
  cellText(ctx, report.classLabel || "", M, y, IN, 36, { size: 16, weight: 700 });
  y += 36 + 12;

  // CAMPUS / 학교 / 이름
  const pw = IN / 6;
  const pairs = [
    ["CAMPUS", report.campus || ""],
    ["학 교", report.school || ""],
    ["이 름", report.name || ""],
  ];
  pairs.forEach(([k, v], i) => {
    box(ctx, M + pw * i * 2, y, pw, 40, C.head);
    cellText(ctx, k, M + pw * i * 2, y, pw, 40, { size: 14, weight: 700 });
    box(ctx, M + pw * (i * 2 + 1), y, pw, 40);
    cellText(ctx, v, M + pw * (i * 2 + 1), y, pw, 40, { size: 15, weight: 700 });
  });
  y += 40 + 16;

  // 주간 관리 TEST REPORT
  ctx.fillStyle = C.band;
  ctx.fillRect(M, y, IN, 40);
  cellText(ctx, report.title || "주간 관리 TEST REPORT", M, y, IN, 40, { size: 17, weight: 800, color: "#fff" });
  y += 40 + 12;

  // 수업일 블록
  for (const b of dayBlocks) {
    const x0 = M + dateW;
    box(ctx, M, y, dateW, b.h, b.d.subject ? C.subjFill : C.dateFill);
    cellText(ctx, b.d.subject ? `${b.d.dateLabel}\n[${b.d.subject}]` : b.d.dateLabel, M, y, dateW, b.h, { size: 15, weight: 700 });
    ["출결", "수업 진도", "클리닉", "테스트"].forEach((hname, i) => {
      box(ctx, x0 + colW * i, y, colW, 30, C.head);
      cellText(ctx, hname, x0 + colW * i, y, colW, 30, { size: 13.5, weight: 700 });
      box(ctx, x0 + colW * i, y + 30, colW, b.h1);
      cellText(ctx, b.vals1[i], x0 + colW * i, y + 30, colW, b.h1, { size: 14, weight: 500 });
      box(ctx, x0 + colW * i, y + 30 + b.h1, colW, b.h2);
      cellText(ctx, b.vals2[i], x0 + colW * i, y + 30 + b.h1, colW, b.h2, { size: 13, color: C.sub });
    });
    y += b.h + 10;
  }
  y += 6;

  // 피드백
  ctx.fillStyle = C.band;
  ctx.fillRect(M, y, IN, 40);
  cellText(ctx, "피드백 FEEDBACK", M, y, IN, 40, { size: 17, weight: 800, color: "#fff" });
  y += 40;
  box(ctx, M, y, IN, 34, C.head);
  cellText(ctx, "수업 피드백", M, y, IN, 34, { size: 14, weight: 700 });
  y += 34;
  box(ctx, M, y, IN, fbH);
  ctx.font = font(14.5);
  ctx.fillStyle = C.ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let ty = y + 26;
  for (const l of fbLines) {
    const isHead = /^\s*○/.test(l);
    ctx.font = font(14.5, isHead ? 700 : 400);
    ctx.fillText(l, M + 20, ty);
    ty += 14.5 * 1.6;
  }
  return canvas;
}

export function buildFeedbackText(report) {
  const parts = [];
  if (report.homework) parts.push(`○ 과제\n  ${report.homework}`);
  if (report.achievement) parts.push(`○ 학습 성취도\n${indent(report.achievement)}`);
  if (report.plan) parts.push(`○ 학습계획 및 총평\n${indent(report.plan)}`);
  for (const s of report.subs || []) {
    if (s.text) parts.push(`○ [${s.subject}] ${s.teacher ? s.teacher + " " : ""}피드백\n${indent(s.text)}`);
  }
  return parts.join("\n\n");
}

function indent(t) {
  return String(t)
    .split("\n")
    .map((l) => (l.startsWith(" ") ? l : "  " + l))
    .join("\n");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function canvasToFile(canvas, filename) {
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  return new File([blob], filename, { type: "image/png" });
}

// 휴대폰: 공유 시트(카톡 등)로 바로, 그 외: 파일 저장
export async function shareOrDownload(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
