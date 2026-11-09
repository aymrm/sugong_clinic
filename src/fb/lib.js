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
// ------------------------------------------------------------------
export async function compressImage(file, maxSide = 2000, quality = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("사진을 읽지 못했어요."));
      im.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadImages(files, folder) {
  const paths = [];
  for (const f of files) {
    const blob = await compressImage(f);
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    await run(supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" }));
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
