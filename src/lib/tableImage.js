// 표를 <canvas>로 직접 그려서 PNG 이미지로 다운로드하는 헬퍼. 외부 라이브러리 없이 동작합니다.
// 칸 너비를 넘는 긴 텍스트(예: 특이사항 메모)는 예전엔 "..."으로 잘라서 내용이 사라졌는데,
// 지금은 줄바꿈해서 여러 줄로 표시하고 행 높이도 그만큼 늘어나서 누락되는 내용이 없습니다.
export function exportTableAsImage({ title, subtitle, headers, rows, filename }) {
  const scale = 2; // 레티나 대응
  const font = "13px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  const headerFont = "bold 13px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  const titleFont = "bold 17px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  const subtitleFont = "13px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

  const measure = document.createElement("canvas").getContext("2d");

  const padX = 12;
  const minColWidth = 64;
  const maxColWidth = 260;
  const colWidths = headers.map((h, i) => {
    measure.font = headerFont;
    let max = measure.measureText(h).width;
    measure.font = font;
    rows.forEach((r) => {
      const w = measure.measureText(String(r[i] ?? "")).width;
      if (w > max) max = w;
    });
    return Math.min(Math.max(max + padX * 2, minColWidth), maxColWidth);
  });

  const lineHeight = 18;
  const rowVPad = 8; // 줄바꿈된 셀 위아래 여백
  const minRowHeight = 30;
  const headerHeight = 34;
  const titleHeight = title ? 30 : 0;
  const subtitleHeight = subtitle ? 22 : 0;
  const margin = 20;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  measure.font = font;
  // 각 행을 실제로 그리기 전에, 셀마다 줄바꿈된 텍스트와 그로 인해 필요한 행 높이를 미리 계산합니다.
  const wrappedRows = rows.map((r) => {
    const cells = r.map((cell, ci) => wrapToWidth(measure, String(cell ?? ""), colWidths[ci] - padX * 2));
    const maxLines = Math.max(1, ...cells.map((lines) => lines.length));
    const height = Math.max(minRowHeight, maxLines * lineHeight + rowVPad);
    return { cells, height };
  });

  const tableHeight = headerHeight + wrappedRows.reduce((sum, r) => sum + r.height, 0);
  const width = tableWidth + margin * 2;
  const height = titleHeight + subtitleHeight + tableHeight + margin * 2;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  let y = margin;
  if (title) {
    ctx.fillStyle = "#1E2A28";
    ctx.font = titleFont;
    ctx.fillText(title, margin, y + titleHeight / 2);
    y += titleHeight;
  }
  if (subtitle) {
    ctx.fillStyle = "#5C6B68";
    ctx.font = subtitleFont;
    ctx.fillText(subtitle, margin, y + subtitleHeight / 2);
    y += subtitleHeight;
  }
  const tableTop = y;

  // 헤더 배경 (헤더는 한 줄 고정 — 열 이름이 아주 길면 여기서만 예전처럼 말줄임표 처리)
  ctx.fillStyle = "#E6F1EE";
  ctx.fillRect(margin, y, tableWidth, headerHeight);
  ctx.fillStyle = "#0F4A42";
  ctx.font = headerFont;
  measure.font = headerFont;
  let x = margin;
  headers.forEach((h, i) => {
    ctx.fillText(truncateToWidth(measure, h, colWidths[i] - padX * 2), x + padX, y + headerHeight / 2);
    x += colWidths[i];
  });
  y += headerHeight;

  // 본문 — 줄바꿈된 각 셀을 여러 줄로, 행 높이는 그 행에서 가장 많이 줄바꿈된 셀 기준으로 맞춤
  ctx.font = font;
  wrappedRows.forEach((row, ri) => {
    if (ri % 2 === 1) {
      ctx.fillStyle = "#F4F6F5";
      ctx.fillRect(margin, y, tableWidth, row.height);
    }
    ctx.fillStyle = "#1E2A28";
    let cx = margin;
    row.cells.forEach((lines, ci) => {
      const blockHeight = lines.length * lineHeight;
      const startY = y + (row.height - blockHeight) / 2 + lineHeight / 2;
      lines.forEach((line, li) => {
        ctx.fillText(line, cx + padX, startY + li * lineHeight);
      });
      cx += colWidths[ci];
    });
    y += row.height;
  });

  // 테두리
  ctx.strokeStyle = "#E1E6E3";
  ctx.lineWidth = 1;
  const lineYs = [tableTop, tableTop + headerHeight];
  wrappedRows.forEach((row) => lineYs.push(lineYs[lineYs.length - 1] + row.height));
  lineYs.forEach((yy) => {
    ctx.beginPath();
    ctx.moveTo(margin, yy + 0.5);
    ctx.lineTo(margin + tableWidth, yy + 0.5);
    ctx.stroke();
  });
  let vx = margin;
  const bottomY = lineYs[lineYs.length - 1];
  ctx.beginPath();
  ctx.moveTo(vx + 0.5, tableTop);
  ctx.lineTo(vx + 0.5, bottomY);
  ctx.stroke();
  colWidths.forEach((w) => {
    vx += w;
    ctx.beginPath();
    ctx.moveTo(vx + 0.5, tableTop);
    ctx.lineTo(vx + 0.5, bottomY);
    ctx.stroke();
  });

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

// 긴 텍스트를 칸 너비에 맞게 여러 줄로 쪼갭니다(자르지 않고 전부 보존).
// 공백 기준으로 먼저 나누고, 공백 없이 긴 단어(또는 한국어처럼 띄어쓰기가 적은 문장)는 글자 단위로 추가로 쪼갭니다.
function wrapToWidth(ctx, text, maxWidth) {
  if (text === "") return [""];
  const words = text.split(/(\s+)/).filter((w) => w !== "");
  const rawLines = [];
  let current = "";
  words.forEach((word) => {
    const test = current + word;
    if (current === "" || ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      rawLines.push(current.trimEnd());
      current = word;
    }
  });
  if (current) rawLines.push(current.trimEnd());

  const result = [];
  rawLines.forEach((line) => {
    if (ctx.measureText(line).width <= maxWidth) {
      result.push(line);
      return;
    }
    let chunk = "";
    for (const ch of line) {
      const test = chunk + ch;
      if (chunk === "" || ctx.measureText(test).width <= maxWidth) {
        chunk = test;
      } else {
        result.push(chunk);
        chunk = ch;
      }
    }
    if (chunk) result.push(chunk);
  });
  return result.length ? result : [""];
}
