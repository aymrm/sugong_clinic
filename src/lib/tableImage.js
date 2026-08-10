// 표를 <canvas>로 직접 그려서 PNG 이미지로 다운로드하는 헬퍼. 외부 라이브러리 없이 동작합니다.
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

  const rowHeight = 30;
  const headerHeight = 34;
  const titleHeight = title ? 30 : 0;
  const subtitleHeight = subtitle ? 22 : 0;
  const margin = 20;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const tableHeight = headerHeight + rows.length * rowHeight;
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

  // 헤더 배경
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

  // 본문
  ctx.font = font;
  measure.font = font;
  rows.forEach((r, ri) => {
    if (ri % 2 === 1) {
      ctx.fillStyle = "#F4F6F5";
      ctx.fillRect(margin, y, tableWidth, rowHeight);
    }
    ctx.fillStyle = "#1E2A28";
    let cx = margin;
    r.forEach((cell, ci) => {
      const text = truncateToWidth(measure, String(cell ?? ""), colWidths[ci] - padX * 2);
      ctx.fillText(text, cx + padX, y + rowHeight / 2);
      cx += colWidths[ci];
    });
    y += rowHeight;
  });

  // 테두리
  ctx.strokeStyle = "#E1E6E3";
  ctx.lineWidth = 1;
  const lineYs = [tableTop, tableTop + headerHeight];
  for (let i = 0; i < rows.length; i++) lineYs.push(lineYs[lineYs.length - 1] + rowHeight);
  lineYs.forEach((yy) => {
    ctx.beginPath();
    ctx.moveTo(margin, yy + 0.5);
    ctx.lineTo(margin + tableWidth, yy + 0.5);
    ctx.stroke();
  });
  let vx = margin;
  const bottomY = tableTop + headerHeight + rows.length * rowHeight;
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
