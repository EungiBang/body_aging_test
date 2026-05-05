/**
 * Timer Worker — 메인 스레드와 독립적으로 동작하는 타이머
 * 
 * 메인 스레드가 TF.js estimatePoses()로 블로킹되어도
 * 이 Worker의 타이머는 정확하게 동작합니다.
 * 
 * Messages IN:
 *   { type: 'startCountdown', duration: number }  — 카운트다운 시작
 *   { type: 'startTest', duration: number }        — 테스트 타이머 시작
 *   { type: 'stop' }                               — 타이머 중지
 * 
 * Messages OUT:
 *   { type: 'countdown', remaining: number }       — 카운트다운 남은 초
 *   { type: 'countdownComplete' }                  — 카운트다운 완료
 *   { type: 'testTick', remaining: number }        — 테스트 남은 초
 *   { type: 'testComplete' }                       — 테스트 완료
 */

let intervalId: ReturnType<typeof setInterval> | null = null;
let startTime = 0;
let duration = 0;
let mode: 'countdown' | 'test' | null = null;

const clearTimer = () => {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  mode = null;
};

const tick = () => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const remaining = Math.max(0, duration - elapsed);

  if (mode === 'countdown') {
    self.postMessage({ type: 'countdown', remaining });
    if (remaining <= 0) {
      clearTimer();
      self.postMessage({ type: 'countdownComplete' });
    }
  } else if (mode === 'test') {
    self.postMessage({ type: 'testTick', remaining });
    if (remaining <= 0) {
      clearTimer();
      self.postMessage({ type: 'testComplete' });
    }
  }
};

self.onmessage = (e: MessageEvent) => {
  const { type } = e.data;

  if (type === 'startCountdown') {
    clearTimer();
    mode = 'countdown';
    duration = e.data.duration;
    startTime = Date.now();
    // 100ms 간격으로 체크 — Worker에서는 정확하게 실행됨
    intervalId = setInterval(tick, 100);
    // 즉시 첫 번째 틱
    tick();
  } else if (type === 'startTest') {
    clearTimer();
    mode = 'test';
    duration = e.data.duration;
    startTime = Date.now();
    intervalId = setInterval(tick, 100);
    tick();
  } else if (type === 'stop') {
    clearTimer();
  }
};
