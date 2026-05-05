import { doc, setDoc, increment, serverTimestamp, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import logger from '../utils/logger';

const TAG = 'Stats';

/**
 * 리포트가 생성될 때 통계를 증가시킵니다.
 */
export const logUsage = async (branchId: string, hardwareId: string) => {
  const today = new Date();
  // YYYYMMDD 포맷
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  logger.debug(TAG, `logUsage 시작: branch=${branchId}, hw=${hardwareId}, date=${dateStr}`);
  try {
    // 1. 일일 총 사용량 (글로벌)
    const dailyRef = doc(db, 'stats', `daily_${dateStr}`);
    await setDoc(dailyRef, {
      date: dateStr,
      count: increment(1),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 2. 지점 누적 사용량
    const branchStatsRef = doc(db, 'stats', `branch_${branchId}`);
    await setDoc(branchStatsRef, {
      branchId,
      totalCount: increment(1),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 3. 기기 누적 사용량
    const deviceRef = doc(db, 'devices', hardwareId);
    await setDoc(deviceRef, {
      totalUsages: increment(1),
      lastUsage: serverTimestamp()
    }, { merge: true });

    logger.info(TAG, `logUsage 완료: daily=${dateStr}, branch=${branchId}`);
  } catch (e) {
    logger.error(TAG, 'logUsage 실패', e, true);
  }
};

/**
 * 대시보드 표시용 전체 통계 수집
 */
export const getDashboardStats = async () => {
  logger.debug(TAG, 'getDashboardStats 시작');
  const startTime = Date.now();
  try {
    logger.apiStart(TAG, 'Firestore query: stats (last 14 days)');
    const q = query(collection(db, 'stats'), orderBy('date', 'desc'), limit(14));
    const snap = await getDocs(q);
    
    const dailyStats: any[] = [];
    const branchStats: any[] = [];
    
    snap.forEach(doc => {
      const id = doc.id;
      const data = doc.data();
      if (id.startsWith('daily_')) {
        // format date string YYYYMMDD to MM/DD
        const d = data.date;
        const formatted = `${d.substring(4,6)}/${d.substring(6,8)}`;
        dailyStats.push({ name: formatted, count: data.count, raw: data.date });
      } else if (id.startsWith('branch_')) {
        branchStats.push({ branchId: data.branchId, count: data.totalCount });
      }
    });

    // 정렬 (날짜순, 사용량순)
    dailyStats.sort((a, b) => a.raw.localeCompare(b.raw));
    branchStats.sort((a, b) => b.count - a.count);

    const elapsed = Date.now() - startTime;
    logger.apiEnd(TAG, 'getDashboardStats', true, { elapsed: `${elapsed}ms`, dailyCount: dailyStats.length, branchCount: branchStats.length });
    return { dailyStats, branchStats };
  } catch (e) {
    const elapsed = Date.now() - startTime;
    logger.error(TAG, `getDashboardStats 실패 (${elapsed}ms)`, e, true);
    return { dailyStats: [], branchStats: [] };
  }
};
