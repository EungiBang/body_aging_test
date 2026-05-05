import { MemberRecord, PendingAssessment } from '../types';
import { syncMemberToCloud, fetchMembersFromCloud, deleteMemberFromCloud } from './cloudSyncService';
import logger from '../utils/logger';

const TAG = 'LocalDB';

// V4 전용 DB — V3 데이터(btc_local_db / members-db.json)와 완전 분리
const DB_NAME = 'btc_local_db_v4';
const STORE_NAME = 'member_records_v4';
const PENDING_STORE_NAME = 'pending_assessment_v4'; // 진행 중인 측정 임시 저장

const initDB = (): Promise<IDBDatabase> => {
  logger.debug(TAG, `IndexedDB 열기: ${DB_NAME}`);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); // v2: pending_assessment 스토어 추가
    request.onerror = () => {
      logger.error(TAG, 'IndexedDB 열기 실패', request.error, true);
      reject(request.error);
    };
    request.onsuccess = () => {
      logger.debug(TAG, 'IndexedDB 열기 성공');
      resolve(request.result);
    };
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        logger.info(TAG, `ObjectStore 생성: ${STORE_NAME}`);
      }
      // v2: 진행 중인 측정 데이터 임시 저장용
      if (!db.objectStoreNames.contains(PENDING_STORE_NAME)) {
        db.createObjectStore(PENDING_STORE_NAME, { keyPath: 'id' });
        logger.info(TAG, `ObjectStore 생성: ${PENDING_STORE_NAME}`);
      }
    };
  });
};

export const saveRecordLocally = async (record: MemberRecord): Promise<boolean> => {
  logger.info(TAG, `saveRecordLocally 시작`, { id: record.id, name: record.name });
  // IPC 통신 또는 IndexedDB 저장 시 직렬화(Data Clone) 에러를 방지하기 위해 순수 JSON 객체로 변환
  let pureRecord: MemberRecord;
  try {
    pureRecord = JSON.parse(JSON.stringify(record));
    logger.debug(TAG, `직렬화 성공, 이미지 수: ${pureRecord.images?.length ?? 0}`);
  } catch (e) {
    logger.error(TAG, 'JSON 직렬화 실패 — 원본 레코드 사용', e, true);
    pureRecord = record; // 최후의 수단
  }

  if (window.electronAPI) {
    try {
      logger.apiStart(TAG, 'Electron IPC saveMemberRecord');
      const electronSaveSuccess = await window.electronAPI.saveMemberRecord(pureRecord);
      logger.apiEnd(TAG, 'Electron IPC saveMemberRecord', electronSaveSuccess);
      if (electronSaveSuccess) {
        // 클라우드 동기화
        try {
          const deviceStr = localStorage.getItem('currentDevice');
          if (deviceStr) {
            const device = JSON.parse(deviceStr);
            if (device.branchId && device.id) {
              logger.debug(TAG, `클라우드 동기화 시도: branch=${device.branchId}, hw=${device.id}`);
              syncMemberToCloud(pureRecord, device.branchId, device.id, device.regionId).catch(err => {
                logger.error(TAG, '클라우드 동기화 실패 (비차단)', err);
              });
            }
          }
        } catch (e) {
          logger.error(TAG, '클라우드 동기화 설정 읽기 실패', e);
        }
      }
      return electronSaveSuccess;
    } catch (err) {
      logger.error(TAG, 'Electron DB 저장 실패 → IndexedDB fallback', err, true);
      // 의도적인 런타임 오류 시 fallback 으로 진행
    }
  }
  
  // IndexedDB Fallback (Browser environment or Electron fallback)
  try {
    logger.debug(TAG, 'IndexedDB fallback 저장 시도');
    const db = await initDB();
    const localSaveSuccess = await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(pureRecord);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });

    logger.info(TAG, `IndexedDB 저장 ${localSaveSuccess ? '성공' : '실패'}: ${record.id}`);

    if (localSaveSuccess) {
      // 클라우드 동기화 시도 (Non-blocking)
      try {
        const deviceStr = localStorage.getItem('currentDevice');
        if (deviceStr) {
          const device = JSON.parse(deviceStr);
          if (device.branchId && device.id) {
            logger.debug(TAG, `클라우드 동기화 시도 (IndexedDB경로): branch=${device.branchId}`);
            syncMemberToCloud(pureRecord, device.branchId, device.id, device.regionId).catch(err => {
              logger.error(TAG, '클라우드 동기화 실패 (비차단)', err);
            });
          }
        }
      } catch (e) {
        logger.error(TAG, '클라우드 동기화 설정 읽기 실패', e);
      }
    }

    return localSaveSuccess;

  } catch (error) {
    logger.error(TAG, 'IndexedDB 저장 실패', error, true);
    return false;
  }
};

export const getRecordsLocally = async (): Promise<MemberRecord[]> => {
  logger.info(TAG, 'getRecordsLocally 시작');
  const startTime = Date.now();
  let localRecords: MemberRecord[] = [];

  if (window.electronAPI) {
    try {
      logger.apiStart(TAG, 'Electron IPC getMemberRecords');
      localRecords = await window.electronAPI.getMemberRecords();
      logger.apiEnd(TAG, 'Electron IPC getMemberRecords', true, { count: localRecords.length });
    } catch (err) {
      logger.error(TAG, 'Electron DB 로드 실패', err, true);
    }
  }
  
  if (localRecords.length === 0) {
    try {
      logger.debug(TAG, 'IndexedDB에서 로드 시도');
      const db = await initDB();
      localRecords = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      logger.info(TAG, `IndexedDB 로드 완료: ${localRecords.length}건`);
    } catch (error) {
      logger.error(TAG, 'IndexedDB 로드 실패', error, true);
    }
  }

  // V4 전용 클라우드 동기화 (같은 지점의 다른 PC에서 저장된 V4 데이터만 병합)
  try {
    const deviceStr = localStorage.getItem('currentDevice');
    if (deviceStr) {
      const device = JSON.parse(deviceStr);
      if (device.branchId) {
        logger.apiStart(TAG, `클라우드 동기화: branch=${device.branchId}`);
        const cloudRecords = await fetchMembersFromCloud(device.branchId);
        logger.apiEnd(TAG, '클라우드 동기화', true, { cloudCount: cloudRecords.length, localCount: localRecords.length });
        
        // 로컬 레코드와 V4 클라우드 레코드를 ID 기준으로 병합 (로컬 우선 — 이미지 보존)
        const currentHardwareId = device.id || '';
        const recordMap = new Map<string, MemberRecord>();
        // 클라우드 먼저 넣고 (다른 PC에서 온 것은 _isRemote 표시)
        let remoteCount = 0;
        cloudRecords.forEach(r => {
          const isFromOtherPC = (r as any).hardwareId && (r as any).hardwareId !== currentHardwareId;
          if (isFromOtherPC) remoteCount++;
          recordMap.set(r.id, { 
            ...r, 
            _isRemote: isFromOtherPC,
            _sourceHardwareId: (r as any).hardwareId || ''
          } as any);
        });
        // 로컬로 덮어쓰기 (로컬에 이미지가 있으므로 우선, _isRemote = false)
        localRecords.forEach(r => recordMap.set(r.id, { ...r, _isRemote: false } as any));
        
        localRecords = Array.from(recordMap.values());
        logger.info(TAG, `병합 완료: 총 ${localRecords.length}건 (로컬: ${localRecords.length - remoteCount}, 리모트: ${remoteCount})`);

        // 로컬에만 있고 클라우드에 없는 V4 레코드 → 자동 업로드 (자가 치유)
        let uploadCount = 0;
        localRecords.forEach(local => {
          if (!cloudRecords.some(cr => cr.id === local.id)) {
            uploadCount++;
            syncMemberToCloud(local, device.branchId, device.id, device.regionId).catch(err => {
              logger.error(TAG, `자가 치유 업로드 실패: ${local.id}`, err);
            });
          }
        });
        if (uploadCount > 0) {
          logger.info(TAG, `자가 치유: ${uploadCount}건 클라우드 업로드 시작`);
        }
      }
    }
  } catch (e) {
    logger.error(TAG, '클라우드 병합 실패 (로컬 데이터는 안전)', e, true);
  }

  const elapsed = Date.now() - startTime;
  logger.info(TAG, `getRecordsLocally 완료: ${localRecords.length}건 (${elapsed}ms)`);
  return localRecords;
};

export const deleteRecordLocally = async (id: string): Promise<boolean> => {
  logger.info(TAG, `deleteRecordLocally 시작: ${id}`);
  
  // 1. 클라우드에서도 삭제 (재병합 방지)
  try {
    logger.apiStart(TAG, `클라우드 삭제: ${id}`);
    await deleteMemberFromCloud(id);
    logger.apiEnd(TAG, '클라우드 삭제', true);
  } catch (e) {
    logger.error(TAG, '클라우드 삭제 실패 (비차단)', e);
  }

  // 2. Electron 로컬 DB 삭제
  if (window.electronAPI) {
    try {
      logger.apiStart(TAG, `Electron IPC deleteMemberRecord: ${id}`);
      const result = await window.electronAPI.deleteMemberRecord(id);
      logger.apiEnd(TAG, 'Electron IPC deleteMemberRecord', result);
      return result;
    } catch (err) {
      logger.error(TAG, 'Electron DB 삭제 실패', err, true);
    }
  }
  
  // 3. IndexedDB Fallback
  try {
    logger.debug(TAG, `IndexedDB 삭제 시도: ${id}`);
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => {
        logger.info(TAG, `IndexedDB 삭제 성공: ${id}`);
        resolve(true);
      };
      req.onerror = () => {
        logger.error(TAG, `IndexedDB 삭제 실패: ${id}`, req.error, true);
        reject(req.error);
      };
    });
  } catch (error) {
    logger.error(TAG, 'IndexedDB 삭제 예외', error, true);
    return false;
  }
};

// ============================================================
// Pending Assessment (진행 중인 측정 임시 저장) CRUD
// ============================================================

/**
 * 진행 중인 측정 데이터를 IndexedDB에 저장/업데이트합니다.
 * 각 단계 완료 시마다 호출되어 크래시 복구를 가능하게 합니다.
 */
export const savePendingAssessment = async (pending: PendingAssessment): Promise<boolean> => {
  logger.debug(TAG, `savePendingAssessment: ${pending.id}, step=${pending.currentStep}, images=${pending.capturedImages.length}`);
  try {
    const purePending = JSON.parse(JSON.stringify(pending));
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PENDING_STORE_NAME);
      const req = store.put(purePending);
      req.onsuccess = () => {
        logger.debug(TAG, `pending 저장 성공: ${pending.id}`);
        resolve(true);
      };
      req.onerror = () => {
        logger.error(TAG, `pending 저장 실패: ${pending.id}`, req.error);
        reject(req.error);
      };
    });
  } catch (error) {
    logger.error(TAG, 'savePendingAssessment 예외', error);
    return false;
  }
};

/**
 * 가장 최근의 미완료 측정 데이터를 가져옵니다.
 * 앱 시작 시 이어하기 가능 여부를 판단합니다.
 */
export const getLatestPendingAssessment = async (): Promise<PendingAssessment | null> => {
  logger.debug(TAG, 'getLatestPendingAssessment 시작');
  try {
    const db = await initDB();
    const allPending: PendingAssessment[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE_NAME, 'readonly');
      const store = tx.objectStore(PENDING_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (allPending.length === 0) {
      logger.debug(TAG, 'pending 데이터 없음');
      return null;
    }

    // 가장 최근 것 반환 (updatedAt 기준 정렬)
    allPending.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const latest = allPending[0];
    
    // 24시간 이상 경과한 pending은 무시 (너무 오래된 데이터)
    const elapsed = Date.now() - new Date(latest.updatedAt).getTime();
    if (elapsed > 24 * 60 * 60 * 1000) {
      logger.info(TAG, `pending 만료 (${(elapsed / 3600000).toFixed(1)}시간 경과), 자동 삭제`);
      await deletePendingAssessment(latest.id);
      return null;
    }

    logger.info(TAG, `pending 발견: ${latest.id}, step=${latest.currentStep}, images=${latest.capturedImages.length}, 경과=${(elapsed / 60000).toFixed(0)}분`);
    return latest;
  } catch (error) {
    logger.error(TAG, 'getLatestPendingAssessment 실패', error);
    return null;
  }
};

/**
 * 완료된 pending 데이터를 삭제합니다.
 * AI 분석 완료 후 또는 사용자가 이어하기를 거부할 때 호출됩니다.
 */
export const deletePendingAssessment = async (id: string): Promise<boolean> => {
  logger.debug(TAG, `deletePendingAssessment: ${id}`);
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PENDING_STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => {
        logger.info(TAG, `pending 삭제 성공: ${id}`);
        resolve(true);
      };
      req.onerror = () => {
        logger.error(TAG, `pending 삭제 실패: ${id}`, req.error);
        reject(req.error);
      };
    });
  } catch (error) {
    logger.error(TAG, 'deletePendingAssessment 예외', error);
    return false;
  }
};

/**
 * 모든 pending 데이터를 삭제합니다 (정리용).
 */
export const clearAllPendingAssessments = async (): Promise<boolean> => {
  logger.debug(TAG, 'clearAllPendingAssessments 시작');
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PENDING_STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => {
        logger.info(TAG, 'pending 전체 삭제 성공');
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    logger.error(TAG, 'clearAllPendingAssessments 예외', error);
    return false;
  }
};
