
// Web Audio API based sound effects for timer start/end
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
  if (!audioCtx) return;
  // Resume context if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + duration);
}

/** 테스트 시작 효과음: 상승하는 3연음 "블리프" */
export function playStartSound() {
  playTone(523, 0.15, 'sine', 0.4);      // C5
  setTimeout(() => playTone(659, 0.15, 'sine', 0.4), 150);  // E5
  setTimeout(() => playTone(784, 0.3, 'sine', 0.5), 300);   // G5 (longer)
}

/** 테스트 종료 효과음: 하강하는 2연음 + 낮은 완료음 */
export function playEndSound() {
  playTone(784, 0.2, 'sine', 0.4);      // G5
  setTimeout(() => playTone(523, 0.2, 'sine', 0.4), 200);   // C5
  setTimeout(() => playTone(392, 0.5, 'triangle', 0.5), 400); // G4 (longer, softer)
}

/** 카운트다운 틱 효과음 */
export function playTickSound() {
  playTone(880, 0.08, 'sine', 0.2); // A5 - short tick
}

/** 촬영 효과음: 셔터 같은 클릭 */
export function playCaptureSound() {
  playTone(1200, 0.05, 'square', 0.15);
  setTimeout(() => playTone(800, 0.08, 'square', 0.1), 50);
}
