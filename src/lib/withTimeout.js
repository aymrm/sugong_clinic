// 프로미스가 너무 오래 걸리면(인터넷이 끊겼거나 서버가 응답 없을 때) 무한정 기다리지 않고
// 정해진 시간 후에 에러로 실패 처리하는 헬퍼. "불러오는 중"에 영원히 멈춰있는 것을 방지합니다.
export function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message || `요청이 ${ms / 1000}초 안에 끝나지 않았어요.`)), ms)),
  ]);
}
