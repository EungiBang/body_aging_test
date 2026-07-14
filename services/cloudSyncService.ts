// R2: 회원·피드백 클라우드 동기화를 서버 api(/api/sync, 대량 전체는 /api/admin-members) 뒤로 이관.
// 브라우저 직접 Firestore(members_v4 / ai_feedbacks_v1) 접근 제거. 로컬우선 계층(localDb)은 손대지 않고,
// 여기(클라우드 미러 경로)만 서버 경유로 바꾼다. 지점/기기/지역은 서버가 토큰·branches에서 유도(위조 방지).
// 시그니처는 그대로 유지 → 소비처(localDb/backupService/feedbackService) 무수정. 라이트 cloudSyncService와 같은 패턴.
//
// 예외: fetchMembersByRegion(호출처 0, 죽은 코드)만 아직 브라우저 직접 Firestore 조회 유지 → firestore import 존치.
import { getDocs, query, collection, where } from 'firebase/firestore';
import { db } from '../firebase';
import { apiPost } from './apiClient';
import { MemberRecord } from '../types';
import logger from '../utils/logger';

const TAG = 'CloudSync';

// 공통 실패 처리: 인증 미통과(401/403)는 warn만(로그 오염 방지), 그 외는 서버로 로깅. 동작 보존 위해 기본값 반환.
const logSyncFail = (fn: string, e: any) => {
  if (e && (e.status === 401 || e.status === 403)) console.warn(`[${TAG}] ${fn} 인증 미통과: ${e.status}`);
  else logger.error(TAG, `${fn} 실패`, e, true);
};

/**
 * 측정 완료 시 로컬에 저장된 회원을 클라우드(Big Data)에도 동기화합니다.
 * 이미지(base64)는 용량 초과 방지를 위해 제외하고 저장합니다.
 */
export const syncMemberToCloud = async (
  record: MemberRecord,
  branchId: string,   // 서버가 토큰에서 유도 → 전송 안 함(시그니처는 호출부 호환 위해 유지)
  hardwareId: string, // 동일 — 서버가 토큰 uid로 유도
  regionId?: string,  // 동일 — 서버가 branches에서 조회
) => {
  try {
    // 용량 초과(4.5MB) 방지: 이미지는 서버로 보내기 전에 제거(기존 동작 보존).
    const pureRecord = JSON.parse(JSON.stringify(record));
    delete pureRecord.images;
    await apiPost('/api/sync', { action: 'syncMember', record: pureRecord });
    return true;
  } catch (e) {
    logSyncFail('syncMemberToCloud', e);
    return false;
  }
};

/**
 * AI 피드백을 클라우드에 동기화합니다.
 */
export const syncFeedbackToCloud = async (record: any) => {
  try {
    // branchId/hardwareId/regionId는 서버가 토큰·branches 조회로 유도(기존엔 localStorage에서 읽어 위조 가능).
    await apiPost('/api/sync', { action: 'syncFeedback', record });
    return true;
  } catch (e) {
    logSyncFail('syncFeedbackToCloud', e);
    return false;
  }
};

/**
 * AI 학습(Few-Shot)을 위해 클라우드에서 최신 피드백을 가져옵니다.
 */
export const fetchFeedbacksFromCloud = async (feedbackType: 'body' | 'face' | 'tarot', maxLimit = 100): Promise<any[]> => {
  try {
    const res = await apiPost<{ list: any[] }>('/api/sync', { action: 'fetchFeedbacks', feedbackType, maxLimit });
    const feedbacks = res.list || [];
    // 서버는 복합 인덱스 회피 위해 정렬 없이 반환 → 클라에서 최신순 정렬(기존 동작 보존).
    feedbacks.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return feedbacks;
  } catch (e) {
    logSyncFail('fetchFeedbacksFromCloud', e);
    return [];
  }
};

/**
 * 관리자 대시보드용: 클라우드의 전체 피드백 데이터를 가져옵니다.
 * 서버에 "전체" 액션이 없어, 세 타입(body/face/tarot) 풀을 합쳐 전체와 동치로 만든다.
 * (모든 피드백은 이 셋 중 하나의 feedbackType을 가진다.)
 */
export const fetchAllFeedbacksFromCloud = async (): Promise<any[]> => {
  try {
    const [body, face, tarot] = await Promise.all([
      fetchFeedbacksFromCloud('body', 100000),
      fetchFeedbacksFromCloud('face', 100000),
      fetchFeedbacksFromCloud('tarot', 100000),
    ]);
    const all = [...body, ...face, ...tarot];
    all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return all;
  } catch (e) {
    logSyncFail('fetchAllFeedbacksFromCloud', e);
    return [];
  }
};

/**
 * 지점의 모든 회원 기록을 클라우드에서 가져옵니다. (Cross-PC 동기화용)
 */
export const fetchMembersFromCloud = async (branchId: string): Promise<MemberRecord[]> => {
  try {
    // 서버가 토큰서 지점을 유도하므로 branchId는 관리자 경로용으로만 전달(기기는 무시됨).
    const res = await apiPost<{ members: MemberRecord[] }>('/api/sync', { action: 'fetchMembersByBranch', branchId });
    return res.members || [];
  } catch (e) {
    logSyncFail('fetchMembersFromCloud', e);
    return [];
  }
};

/**
 * 본사 관리자용: 전체 회원 데이터를 가져옵니다. (커서 페이지네이션, 관리자 전용)
 */
export const fetchAllMembers = async (): Promise<MemberRecord[]> => {
  logger.debug(TAG, 'fetchAllMembers 시작(페이지 순회)');
  try {
    const members: MemberRecord[] = [];
    let cursor: string | undefined;
    do {
      const res = await apiPost<{ members: MemberRecord[]; nextCursor: string | null }>('/api/admin-members', { action: 'list', cursor, limit: 500 });
      members.push(...((res.members || []) as MemberRecord[]));
      cursor = res.nextCursor || undefined;
    } while (cursor);
    // 최신순 정렬(서버는 문서ID 순으로 페이징하므로 여기서 lastTestDate로 재정렬 — 기존 동작 보존).
    members.sort((a, b) => {
      const da = a.lastTestDate || a.report?.date || '';
      const db2 = b.lastTestDate || b.report?.date || '';
      return db2.localeCompare(da);
    });
    return members;
  } catch (e) {
    logSyncFail('fetchAllMembers', e);
    return [];
  }
};

/**
 * 본사 관리자용: 지역별 회원 데이터를 가져옵니다.
 * (죽은 코드 — 호출처 0. 라이트와 동일하게 직접 Firestore 조회 유지, 삭제 후보.)
 */
export const fetchMembersByRegion = async (regionId: string): Promise<MemberRecord[]> => {
  logger.debug(TAG, `fetchMembersByRegion 시작: region=${regionId}`);
  try {
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
  try {
    // 서버가 소유권 확인(기기는 자기 지점 문서만). 없는 문서는 서버가 성공 처리(기존 동작 보존).
    await apiPost('/api/sync', { action: 'deleteMember', memberId });
    return true;
  } catch (e) {
    logSyncFail('deleteMemberFromCloud', e);
    return false;
  }
};
