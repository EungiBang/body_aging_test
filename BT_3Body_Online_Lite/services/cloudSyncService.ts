import { doc, setDoc, getDocs, deleteDoc, query, collection, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { MemberRecord } from '../types';

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
  try {
    // 용량 초과 방지: 이미지는 제외
    const pureRecord = JSON.parse(JSON.stringify(record));
    delete pureRecord.images;

    let finalRegionId = regionId;

    // regionId가 없을 경우 branchId를 통해 조회
    if (!finalRegionId && branchId) {
      const { getDoc } = await import('firebase/firestore');
      const branchRef = doc(db, 'branches', branchId);
      const branchSnap = await getDoc(branchRef);
      if (branchSnap.exists()) {
        finalRegionId = branchSnap.data().regionId;
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

    await setDoc(memberRef, docData, { merge: true });
    
    return true;
  } catch (e) {
    console.error('Failed to sync member to cloud', e);
    return false;
  }
};

/**
 * 지점의 모든 회원 기록을 클라우드에서 가져옵니다. (Cross-PC 동기화용)
 */
export const fetchMembersFromCloud = async (branchId: string): Promise<MemberRecord[]> => {
  try {
    const q = query(collection(db, 'members_v4'), where('branchId', '==', branchId));
    const snap = await getDocs(q);
    const members: MemberRecord[] = [];
    snap.forEach(doc => {
      members.push({ id: doc.id, ...doc.data() } as MemberRecord);
    });
    return members;
  } catch (e) {
    console.error('Failed to fetch cloud members', e);
    return [];
  }
};

/**
 * 본사 관리자용: 전체 회원 데이터를 가져옵니다.
 */
export const fetchAllMembers = async (): Promise<MemberRecord[]> => {
  try {
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
    return members;
  } catch (e) {
    console.error('Failed to fetch all members', e);
    return [];
  }
};

/**
 * 본사 관리자용: 지역별 회원 데이터를 가져옵니다.
 */
export const fetchMembersByRegion = async (regionId: string): Promise<MemberRecord[]> => {
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
    console.error('Failed to fetch members by region', e);
    return [];
  }
};

/**
 * 클라우드에서 회원 레코드를 삭제합니다.
 */
export const deleteMemberFromCloud = async (memberId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, 'members_v4', memberId));
    return true;
  } catch (e) {
    console.error('Failed to delete member from cloud', e);
    return false;
  }
};
