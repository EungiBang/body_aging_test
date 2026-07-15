// 기기 라이센스 관리 도메인 로직 (서버 전용, 관리자 전용). 파일명 '_' 접두사 → Vercel 엔드포인트 아님.
// api/devices.ts(배포)와 vite dev 프록시가 공유. 기존 services/firebaseAuthService.ts의
// getAllDevices/updateDeviceStatus/deleteDevice(클라 직접 접속)를 그대로 Admin SDK로 옮긴 것.
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from './_firebase-admin.js';

export type DeviceType = 'pc' | 'lite';

// devices(pc) + lite_devices 병합, 생성일 내림차순. (기존 getAllDevices 동작 보존)
export async function listDevices(): Promise<any[]> {
  getAdminApp();
  const db = getFirestore();
  const [pcSnap, liteSnap] = await Promise.all([
    db.collection('devices').get(),
    db.collection('lite_devices').get(),
  ]);
  const devices: any[] = [];
  pcSnap.forEach((d) => devices.push({ id: d.id, deviceType: 'pc', ...d.data() }));
  liteSnap.forEach((d) => devices.push({ id: d.id, deviceType: 'lite', ...d.data() }));
  return devices.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() || 0;
    const tb = b.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });
}

export async function setDeviceStatus(hardwareId: string, status: 'active' | 'pending' | 'revoked', deviceType: DeviceType = 'lite'): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  const col = deviceType === 'pc' ? 'devices' : 'lite_devices';
  await db.doc(`${col}/${hardwareId}`).update({ status });
}

export async function removeDevice(hardwareId: string, deviceType: DeviceType = 'lite'): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  const col = deviceType === 'pc' ? 'devices' : 'lite_devices';
  await db.doc(`${col}/${hardwareId}`).delete();
}
