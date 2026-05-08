import { doc, setDoc, getDocs, deleteDoc, query, collection, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { MemberRecord } from '../types';
import logger from '../utils/logger';

const TAG = 'CloudSync';

/**
 * 측정 완료 시 로컬에 저장된 회원을 클라우드(Big Data)에도 동기화합니다.
 * 이미지(base64)는 용량 초과 방지를 위해 제외하고 저장합니다.
 */
export const syncMemberToCloud = async (
  record: MemberRecord,
  branchId: string,
  hardwareId: string,
  regionId?: string
) => {
  logger.debug(TAG, `syncMemberToCloud 시작`, { id: record.id, name: record.name, branchId, hardwareId });
  try {
    // 용량 초과 방지: 이미지는 제외
    const pureRecord = JSON.parse(JSON.stringify(record));
    const imageCount = pureRecord.images?.length || 0;
    delete pureRecord.images;
    logger.debug(TAG, `이미지 ${imageCount}건 제외됨`);

    let finalRegionId = regionId;

    // regionId가 없을 경우 branchId를 통해 조회
    if (!finalRegionId && branchId) {
      const { getDoc } = await import('firebase/firestore');
      const branchRef = doc(db, 'branches', branchId);
      const branchSnap = await getDoc(branchRef);
      if (branchSnap.exists()) {
        finalRegionId = branchSnap.data().regionId;
        logger.debug(TAG, `regionId 조회 완료: ${finalRegionId}`);
      }
    }

    const memberRef = doc(db, 'members_v4', record.id);
    
    // undefined 값이 들어가면 Firebase에서 에러가 발생하므로, 확실한 값만 할당
    const docData: any = {
      ...pureRecord,
      branchId,
      hardwareId,
      syncedAt: serverTimestamp()
    };
    if (finalRegionId) {
      docData.regionId = finalRegionId;
    }

    // 객체 내의 undefined 필드 제거
    Object.keys(docData).forEach(key => {
      if (docData[key] === undefined) {
        delete docData[key];
      }
    });

    logger.apiStart(TAG, `Firestore setDoc: members_v4/${record.id}`);
    await setDoc(memberRef, docData, { merge: true });
    logger.apiEnd(TAG, `Firestore setDoc: members_v4/${record.id}`, true);
    
    return true;
  } catch (e) {
    logger.error(TAG, `syncMemberToCloud 실패: ${record.id}`, e, true);
    return false;
  }
};

/**
 * AI 피드백을 클라우드에 동기화합니다.
 */
export const syncFeedbackToCloud = async (record: any) => {
  logger.debug(TAG, `syncFeedbackToCloud 시작`, { id: record.id, type: record.feedbackType });
  try {
    const rawDevice = localStorage.getItem('currentDevice');
    let branchId = 'unknown';
    let hardwareId = 'unknown';
    let regionId = 'unknown';
    
    if (rawDevice) {
      try {
        const device = JSON.parse(rawDevice);
        branchId = device.branchId || 'unknown';
        hardwareId = device.id || 'unknown';
        regionId = device.regionId || 'unknown';
      } catch (e) {
        // parsing error
      }
    }

    const docData = {
      ...record,
      branchId,
      hardwareId,
      regionId,
      syncedAt: serverTimestamp()
    };

    const feedbackRef = doc(db, 'ai_feedbacks_v1', record.id);
    logger.apiStart(TAG, `Firestore setDoc: ai_feedbacks_v1/${record.id}`);
    await setDoc(feedbackRef, docData, { merge: true });
    logger.apiEnd(TAG, `Firestore setDoc: ai_feedbacks_v1/${record.id}`, true);
    
    return true;
  } catch (e) {
    logger.error(TAG, `syncFeedbackToCloud 실패: ${record.id}`, e, true);
    return false;
  }
};

/**
 * 지점의 모든 회원 기록을 클라우드에서 가져옵니다. (Cross-PC 동기화용)
 */
export const fetchMembersFromCloud = async (branchId: string): Promise<MemberRecord[]> => {
  logger.debug(TAG, `fetchMembersFromCloud 시작: branch=${branchId}`);
  const startTime = Date.now();
  try {
    logger.apiStart(TAG, `Firestore query: members_v4 where branchId==${branchId}`);
    const q = query(collection(db, 'members_v4'), where('branchId', '==', branchId));
    const snap = await getDocs(q);
    const members: MemberRecord[] = [];
    snap.forEach(doc => {
      members.push({ id: doc.id, ...doc.data() } as MemberRecord);
    });
    const elapsed = Date.now() - startTime;
    logger.apiEnd(TAG, 'fetchMembersFromCloud', true, { count: members.length, elapsed: `${elapsed}ms` });
    return members;
  } catch (e) {
    const elapsed = Date.now() - startTime;
    logger.error(TAG, `fetchMembersFromCloud 실패 (${elapsed}ms)`, e, true);
    return [];
  }
};

/**
 * 본사 관리자용: 전체 회원 데이터를 가져옵니다.
 */
export const fetchAllMembers = async (): Promise<MemberRecord[]> => {
  logger.debug(TAG, 'fetchAllMembers 시작');
  try {
    logger.apiStart(TAG, 'Firestore query: members_v4 (ALL)');
    const q = query(collection(db, 'members_v4'));
    const snap = await getDocs(q);
    const members: MemberRecord[] = [];
    snap.forEach(d => {
      members.push({ id: d.id, ...d.data() } as MemberRecord);
    });
    // 최신순 정렬
    members.sort((a, b) => {
      const da = a.lastTestDate || a.report?.date || '';
      const db2 = b.lastTestDate || b.report?.date || '';
      return db2.localeCompare(da);
    });
    logger.apiEnd(TAG, 'fetchAllMembers', true, { count: members.length });
    return members;
  } catch (e) {
    logger.error(TAG, 'fetchAllMembers 실패', e, true);
    return [];
  }
};

/**
 * 본사 관리자용: 지역별 회원 데이터를 가져옵니다.
 */
export const fetchMembersByRegion = async (regionId: string): Promise<MemberRecord[]> => {
  logger.debug(TAG, `fetchMembersByRegion 시작: region=${regionId}`);
  try {
    logger.apiStart(TAG, `Firestore query: members_v4 where regionId==${regionId}`);
    const q = query(collection(db, 'members_v4'), where('regionId', '==', regionId));
    const snap = await getDocs(q);
    const members: MemberRecord[] = [];
    snap.forEach(d => {
      members.push({ id: d.id, ...d.data() } as MemberRecord);
    });
    members.sort((a, b) => {
      const da = a.lastTestDate || '';
      const db2 = b.lastTestDate || '';
      return db2.localeCompare(da);
    });
    logger.apiEnd(TAG, 'fetchMembersByRegion', true, { regionId, count: members.length });
    return members;
  } catch (e) {
    logger.error(TAG, `fetchMembersByRegion 실패: ${regionId}`, e, true);
    return [];
  }
};

/**
 * 클라우드에서 회원 레코드를 삭제합니다.
 */
export const deleteMemberFromCloud = async (memberId: string): Promise<boolean> => {
  logger.debug(TAG, `deleteMemberFromCloud: ${memberId}`);
  try {
    logger.apiStart(TAG, `Firestore deleteDoc: members_v4/${memberId}`);
    await deleteDoc(doc(db, 'members_v4', memberId));
    logger.apiEnd(TAG, `deleteMemberFromCloud`, true);
    return true;
  } catch (e) {
    logger.error(TAG, `deleteMemberFromCloud 실패: ${memberId}`, e, true);
    return false;
  }
};
