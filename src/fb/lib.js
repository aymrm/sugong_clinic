import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

export { supabase };
export const BUCKET = "fb-images";

// ------------------------------------------------------------------
// 데이터 조회/저장: 실패하면 반드시 예외를 던집니다(조용히 콘솔에만 남기지 않음).
// ------------------------------------------------------------------
export async function run(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message || "서버 요청에 실패했어요.");
  return data;
}

// 화면에서 쓰는 조회 훅: 필요한 것만 그때그때 불러오고, 앱으로 돌아올 때(탭 전환·화면 켜짐) 다시 불러옵니다.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);
  const load = useCallback(async (quiet = false) => {
    const my = ++seq.current;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (my === seq.current) setState({ data, error: null, loading: false });
    } catch (e) {
      console.error(e);
      if (my === seq.current) setState((s) => ({ ...s, error: e, loading: false }));
    }
  }, []);
  useEffect(() => {
    load();
  }, deps); // eslint-disable-line
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && load(true);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);
  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: typeof d === "function" ? d(s.data) : d })) };
}

// ------------------------------------------------------------------
// 날짜 · 주차
// ------------------------------------------------------------------
const WD = ["일", "월", "화", "수", "목", "금", "토"];
export function todayISO() {
  const d = new Date();
  return iso(d);
}
export function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function weekStartOf(s, dow = 1) {
  const d = parseISO(s);
  const diff = (d.getDay() - dow + 7) % 7;
  d.setDate(d.getDate() - diff);
  return iso(d);
}
export function shortDate(s) {
  const d = parseISO(s);
  return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`;
}
// "11월 2주차" — 주 시작일이 그 달의 몇 번째 주 시작인지로 셉니다(예: 11/2 시작 주 = 11월 1주차).
export function weekLabel(ws) {
  const d = parseISO(ws);
  return `${d.getMonth() + 1}월 ${Math.floor((d.getDate() - 1) / 7) + 1}주차`;
}
export function weekRange(ws) {
  const we = addDays(ws, 6);
  const a = parseISO(ws);
  const b = parseISO(we);
  return `${a.getMonth() + 1}/${a.getDate()} ~ ${b.getMonth() + 1}/${b.getDate()}`;
}
export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

// ------------------------------------------------------------------
// AI 서버 함수 호출
// ------------------------------------------------------------------
export async function callAI(action, payload) {
  const { data, error } = await supabase.functions.invoke("ai", { body: { action, ...payload } });
  if (error) {
    if (error.name === "FunctionsFetchError" || /Failed to send a request/i.test(error.message || "")) {
      throw new Error("AI 서버에 연결하지 못했어요. Supabase → Edge Functions에 'ai' 함수가 배포돼 있는지 확인해주세요. 배포했는데도 같다면 최신 ai 함수 코드로 다시 배포해주세요.");
    }
    let msg = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) msg = body.error;
    } catch {
      /* 무시 */
    }
    throw new Error(msg || "AI 요청에 실패했어요.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ------------------------------------------------------------------
// 사진: 휴대폰 사진(수 MB)을 긴 변 2000px JPEG로 줄여서 올립니다.
// 브라우저가 못 여는 사진(삼성 "고효율 사진" HEIC 등)은 원본 그대로 올리거나, 안 되면 이유를 알려줍니다.
// ------------------------------------------------------------------
const AI_OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function decode(file) {
  // 1) createImageBitmap: 대부분의 안드로이드·데스크톱 크롬에서 가장 잘 열림(사진 회전 정보도 반영)
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* 다음 방법 */
    }
  }
  // 2) <img>로 열기
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("decode"));
      im.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function isHeic(file) {
  return /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || "");
}

export async function compressImage(file, maxSide = 2000, quality = 0.85) {
  if (isHeic(file)) {
    throw new Error("HEIC(고효율 사진) 형식이라 열 수 없어요. 카메라 설정 → '고효율 사진'을 끄고 다시 찍거나, 사진을 캡처해서 올려주세요.");
  }
  let img;
  try {
    img = await decode(file);
  } catch {
    // 열지는 못했지만 AI가 읽을 수 있는 형식이고 크기가 적당하면 원본 그대로 보냅니다.
    if (AI_OK_TYPES.includes(file.type) && file.size <= 3.5 * 1024 * 1024) return file;
    throw new Error(
      `사진을 열지 못했어요${file.type ? ` (${file.type})` : ""}. 갤러리 앱에서 사진을 한 번 열어 원본을 내려받은 뒤 다시 고르거나, 카메라로 바로 찍어서 올려주세요.`
    );
  }
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w0 * scale);
  canvas.height = Math.round(h0 * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close?.();
  const blob = await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", quality));
  if (!blob) throw new Error("사진을 줄이지 못했어요. 다른 사진으로 다시 시도해주세요.");
  return blob;
}

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export async function uploadImages(files, folder) {
  const paths = [];
  for (const f of files) {
    const blob = await compressImage(f);
    const type = AI_OK_TYPES.includes(blob.type) ? blob.type : "image/jpeg";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[type]}`;
    await run(supabase.storage.from(BUCKET).upload(path, blob, { contentType: type }));
    paths.push(path);
  }
  return paths;
}

const urlCache = new Map();
export async function signedUrl(path) {
  const hit = urlCache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const data = await run(supabase.storage.from(BUCKET).createSignedUrl(path, 3600));
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

// ------------------------------------------------------------------
// 기타
// ------------------------------------------------------------------
export function pct(score, total) {
  if (score == null || !total) return null;
  return Math.round((Number(score) / Number(total)) * 100);
}

// 과제 줄 자동 생성: "10/31 미적분 - RPM○, 11/4 미적분 - RPM○"
export function homeworkLine(records, subject) {
  return records
    .filter((r) => r.homework_material || r.homework_status)
    .map((r) => {
      const d = parseISO(r.date);
      return `${d.getMonth() + 1}/${d.getDate()} ${subject ? subject + " - " : ""}${r.homework_material || ""}${r.homework_status || ""}`.trim();
    })
    .join(", ");
}

export function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
}
