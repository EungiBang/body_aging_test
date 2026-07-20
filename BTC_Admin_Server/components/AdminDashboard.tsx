import React, { useState, useEffect } from 'react';
// 타입(AdminUser/Region/Branch/DeviceLicense)은 여전히 firebaseAuthService가 원본(값 함수는 전부 liteAdmin으로 이관됨).
import { AdminUser, Region, Branch, DeviceLicense } from '../services/firebaseAuthService';
// 관리자 데이터 접근은 전부 봉합선(liteAdmin) 경유. P1: adminLogin · P2a: devices/config/users · P2b: stats/members · P2c: events/errorlog/feedbacks.
import {
  adminLogin,
  getRegions, getBranches, getAllDevices, updateDeviceStatus, deleteDevice,
  saveBranch, saveRegion, deleteBranch, deleteRegion, getSystemSettings, updateSystemSettings,
  getAdminUsers, saveAdminUser, deleteAdminUser,
  getUsageStatus, updateDailyLimit,
  getDashboardStats, fetchAllMembers, fetchMembersFromCloud, deleteMemberFromCloud, getMemberDetail, fetchMembersForExcel,
  fetchAllEvents, getAllFeedbacks,
} from '../services/liteAdmin';
import { MemberRecord } from '../types';
// UsageStatus 타입 원본은 usageLimitService(비개발자 파일). 함수(getUsageStatus/updateDailyLimit)는 liteAdmin으로 이관.
import { UsageStatus } from '../services/usageLimitService';
import * as xlsx from 'xlsx';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { AdminErrorMonitor } from './AdminErrorMonitor';

interface AdminDashboardProps {
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'branches' | 'members' | 'events' | 'feedbacks' | 'errors' | 'settings'>('overview');
  
  // Data State
  const [regions, setRegions] = useState<Region[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [devices, setDevices] = useState<DeviceLicense[]>([]);
  const [settings, setSettings] = useState({ autoApproveCode: '', liteAutoApproveCode: '', tempLiteAutoApproveCode: '', tempLiteCodeExpiredAt: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{ dailyStats: any[], branchStats: any[] }>({ dailyStats: [], branchStats: [] });

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Admin Users Management State
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newAdmin, setNewAdmin] = useState<{ id: string; name: string; password: string; role: 'manager' | 'master' }>({ id: '', name: '', password: '', role: 'manager' });
  const [branchUsages, setBranchUsages] = useState<Record<string, UsageStatus>>({});

  // 지역/지점 추가 UI 상태
  const [showAddRegionInput, setShowAddRegionInput] = useState(false);
  const [newRegionName, setNewRegionName] = useState('');
  const [showAddBranchForRegion, setShowAddBranchForRegion] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');

  // Branch Quota 탭 필터 상태
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // 기기 관리 탭 상태
  const [deviceFilterRegion, setDeviceFilterRegion] = useState<string>('all');
  const [deviceFilterBranch, setDeviceFilterBranch] = useState<string>('all');
  const [deviceSearchQuery, setDeviceSearchQuery] = useState<string>('');
  const [deviceSortKey, setDeviceSortKey] = useState<'createdAt' | 'appVersion'>('createdAt');
  const [deviceSortDir, setDeviceSortDir] = useState<'asc' | 'desc'>('desc');
  // 회원관리 탭 상태
  const [cloudMembers, setCloudMembers] = useState<MemberRecord[]>([]);
  const [memberFilterRegion, setMemberFilterRegion] = useState<string>('all');
  const [memberFilterBranch, setMemberFilterBranch] = useState<string>('all');
  const [memberFilterEventCode, setMemberFilterEventCode] = useState<string>('all');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSubTab, setMemberSubTab] = useState<'analyzed' | 'pending'>('analyzed');
  const [memberFilterSource, setMemberFilterSource] = useState<'all' | 'PC' | 'LITE'>('all');

  // 합동 행사 관리 상태
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // AI Feedbacks State
  const [allFeedbacks, setAllFeedbacks] = useState<any[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [rankPeriod, setRankPeriod] = useState<'today' | 'week' | 'month'>('month');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [r, b, d, s, au, dashStats, feedbacks, members] = await Promise.all([
        getRegions(),
        getBranches(),
        getAllDevices(),
        getSystemSettings(),
        getAdminUsers(),
        getDashboardStats(),
        getAllFeedbacks(),
        fetchAllMembers()
      ]);
      setRegions(r);
      setBranches(b);
      setDevices(d);
      setSettings((s as any) || { autoApproveCode: '', liteAutoApproveCode: '', tempLiteAutoApproveCode: '', tempLiteCodeExpiredAt: '' });
      setAdminUsers(au);
      setStats(dashStats);
      setAllFeedbacks(feedbacks);
      setCloudMembers(members);

      const usages: Record<string, UsageStatus> = {};
      await Promise.all(b.map(async (branch) => {
        usages[branch.id] = await getUsageStatus(branch.id);
      }));
      setBranchUsages(usages);
    } catch (e) {
      console.error('Admin load error:', e);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await adminLogin(adminId, adminPassword);
      if (user) {
        setCurrentAdmin(user);
        setIsAuthenticated(true);
      } else {
        alert('아이디 또는 비밀번호가 틀렸습니다.');
      }
    } catch (e) {
      alert('로그인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmin.id || !newAdmin.name || !newAdmin.password) return alert('모든 항목을 입력하세요.');
    if (adminUsers.some(a => a.id === newAdmin.id)) return alert('이미 존재하는 아이디입니다.');
    
    try {
      await saveAdminUser(newAdmin);
      alert('관리자 계정이 추가되었습니다.');
      setNewAdmin({ id: '', name: '', password: '', role: 'manager' });
      setAdminUsers(await getAdminUsers());
    } catch (err) {
      alert('계정 추가 실패');
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (id === currentAdmin?.id) return alert('자기 자신은 삭제할 수 없습니다.');
    if (id === 'admin') return alert('마스터 계정은 삭제할 수 없습니다.');
    if (window.confirm('이 관리자 계정을 삭제하시겠습니까?')) {
      try {
        await deleteAdminUser(id);
        setAdminUsers(adminUsers.filter(a => a.id !== id));
      } catch (err) {
        alert('계정 삭제 실패');
      }
    }
  };

  const handleStatusChange = async (deviceId: string, newStatus: 'active' | 'pending' | 'revoked', deviceType: 'pc' | 'lite' = 'lite') => {
    if (window.confirm(`이 기기의 상태를 '${newStatus}'(으)로 변경하시겠습니까?`)) {
      try {
        await updateDeviceStatus(deviceId, newStatus, deviceType);
        setDevices(devices.map(d => d.id === deviceId ? { ...d, status: newStatus } : d));
      } catch (e) {
        alert('상태 변경 실패');
      }
    }
  };
  const handleDeleteDevice = async (deviceId: string, deviceType: 'pc' | 'lite' = 'lite') => {
    if (window.confirm('이 기기를 목록에서 완전히 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) {
      try {
        await deleteDevice(deviceId, deviceType);
        setDevices(devices.filter(d => d.id !== deviceId));
      } catch (e) {
        alert('기기 삭제 실패');
      }
    }
  };
  const handleUpdateQuota = async (branch: Branch, newQuota: number) => {
    if (isNaN(newQuota)) return;
    if (newQuota === (branch.allowedLicenses || 2)) return;

    try {
      const updated = { ...branch, allowedLicenses: newQuota };
      await saveBranch(updated);
      setBranches(branches.map(b => b.id === branch.id ? updated : b));
      // 시각적인 방해를 줄이기 위해 alert 대신 조용히 업데이트
    } catch (e) {
      alert('업데이트 실패');
    }
  };

  const handleUpdateLiteQuota = async (branch: Branch, newQuota: number) => {
    if (isNaN(newQuota)) return;
    if (newQuota === (branch.liteAllowedLicenses !== undefined ? branch.liteAllowedLicenses : 1)) return;

    try {
      const updated = { ...branch, liteAllowedLicenses: newQuota };
      await saveBranch(updated);
      setBranches(branches.map(b => b.id === branch.id ? updated : b));
    } catch (e) {
      alert('라이트 할당량 업데이트 실패');
    }
  };

  const handleUpdateDailyLimit = async (branch: Branch, type: 'kface' | 'ktarot', newValue: number) => {
    if (isNaN(newValue)) return;
    
    const currentLimit = type === 'kface' ? (branch.kfaceDailyLimit ?? 30) : (branch.ktarotDailyLimit ?? 30);
    if (newValue === currentLimit) return;

    try {
      const kfaceLimit = type === 'kface' ? newValue : (branch.kfaceDailyLimit ?? 30);
      const ktarotLimit = type === 'ktarot' ? newValue : (branch.ktarotDailyLimit ?? 30);
      await updateDailyLimit(branch.id, kfaceLimit, ktarotLimit);
      
      const updated = { ...branch, kfaceDailyLimit: kfaceLimit, ktarotDailyLimit: ktarotLimit };
      setBranches(branches.map(b => b.id === branch.id ? updated : b));
      // 시각적인 방해를 줄이기 위해 alert 제거
    } catch (e) {
      alert('한도 업데이트 실패');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSystemSettings(settings.autoApproveCode, settings.liteAutoApproveCode, settings.tempLiteAutoApproveCode, settings.tempLiteCodeExpiredAt);
      alert('설정이 저장되었습니다.');
    } catch (e: any) {
      console.error('설정 저장 실패:', e);
      alert('설정 저장 실패: ' + (e.message || '알 수 없는 오류'));
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('기존 지역/지점 데이터가 엑셀 데이터로 추가됩니다. 계속하시겠습니까?')) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = xlsx.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet);

        const newRegions = new Map<string, string>(); // name -> id
        const newBranches: Omit<Branch, 'id'>[] = [];

        // 1. 파싱
        jsonData.forEach((row: any) => {
          const regionName = row['지역'];
          const branchName = row['지점'];
          
          if (!regionName || !branchName) return;

          // 기존 리전 확인
          let regionId = regions.find(r => r.name === regionName)?.id;
          
          // 새로 추가될 리전인지 확인
          if (!regionId && !newRegions.has(regionName)) {
            regionId = `region_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            newRegions.set(regionName, regionId);
          } else if (!regionId) {
            regionId = newRegions.get(regionName)!;
          }

          newBranches.push({
            regionId,
            name: branchName,
            allowedLicenses: 2 // 기본값
          });
        });

        // 2. Firebase 저장
        const savePromises: Promise<any>[] = [];
        
        // 새 지역 저장
        newRegions.forEach((id, name) => {
          savePromises.push(saveRegion({ id, name, order: 0 }));
        });

        // 새 지점 저장
        newBranches.forEach(b => {
          // 중복 지점 확인 (동일 지역, 동일 지점명)
          const exists = branches.some(existing => existing.regionId === b.regionId && existing.name === b.name);
          if (!exists) {
            savePromises.push(saveBranch(b));
          }
        });

        await Promise.all(savePromises);
        alert('엑셀 데이터 업로드가 완료되었습니다!');
        loadData(); // 새로고침
      };
      reader.readAsArrayBuffer(file);
    } catch (e) {
      console.error('Excel upload error:', e);
      alert('엑셀 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteBranch = async (branchId: string, branchName: string) => {
    if (window.confirm(`'${branchName}' 지점을 삭제하시겠습니까? (연결된 기기는 유지되나 소속을 잃습니다)`)) {
      try {
        await deleteBranch(branchId);
        setBranches(branches.filter(b => b.id !== branchId));
      } catch (e) {
        alert('삭제 실패');
      }
    }
  };

  // 지역 추가 핸들러
  const handleAddRegion = async () => {
    const name = newRegionName.trim();
    if (!name) { alert('지역 이름을 입력하세요.'); return; }
    if (regions.some(r => r.name === name)) { alert('이미 존재하는 지역 이름입니다.'); return; }
    try {
      const newOrder = regions.length > 0 ? Math.max(...regions.map(r => r.order || 0)) + 1 : 1;
      await saveRegion({ name, order: newOrder });
      setNewRegionName('');
      setShowAddRegionInput(false);
      await loadData();
    } catch (e) {
      alert('지역 추가 실패');
    }
  };

  // 지역 삭제 핸들러 (하위 지점 존재 시 차단)
  const handleDeleteRegion = async (regionId: string, regionName: string) => {
    const childBranches = branches.filter(b => b.regionId === regionId);
    if (childBranches.length > 0) {
      alert(`'${regionName}' 지역에 ${childBranches.length}개의 지점이 남아있습니다.\n먼저 소속 지점을 모두 삭제한 후 지역을 삭제해 주세요.`);
      return;
    }
    if (!window.confirm(`'${regionName}' 지역을 삭제하시겠습니까?`)) return;
    try {
      await deleteRegion(regionId);
      setRegions(regions.filter(r => r.id !== regionId));
    } catch (e) {
      alert('지역 삭제 실패');
    }
  };

  // 지점 개별 추가 핸들러
  const handleAddBranch = async (regionId: string) => {
    const name = newBranchName.trim();
    if (!name) { alert('지점 이름을 입력하세요.'); return; }
    if (branches.some(b => b.regionId === regionId && b.name === name)) {
      alert('해당 지역에 이미 동일한 이름의 지점이 있습니다.');
      return;
    }
    try {
      await saveBranch({ regionId, name, allowedLicenses: 2 });
      setNewBranchName('');
      setShowAddBranchForRegion(null);
      await loadData();
    } catch (e) {
      alert('지점 추가 실패');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
            <i className="fas fa-user-shield text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold mb-6 text-center text-slate-800">중앙 관리자 로그인</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">아이디</label>
              <input 
                type="text" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" 
                placeholder="관리자 아이디 (초기: admin)"
                value={adminId}
                onChange={e => setAdminId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">비밀번호</label>
              <input 
                type="password" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" 
                placeholder="관리자 비밀번호"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300">돌아가기</button>
              <button type="submit" disabled={!adminId || !adminPassword} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50">로그인</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // AI 훈련 센터 탭 (Feedbacks)
  // ─────────────────────────────────────────────────────────────────
  const renderFeedbacksTab = () => {
    if (feedbacksLoading) {
      return <div className="text-center py-20"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-slate-500 font-bold">피드백 데이터를 불러오는 중...</p></div>;
    }

    const totalCount = allFeedbacks.length;
    const satisfiedCount = allFeedbacks.filter(f => f.feedback && (f.feedback.physicalRating?.includes('satisfied') || f.feedback.faceRating?.includes('satisfied') || f.feedback.tarotRating?.includes('satisfied')) && !f.feedback.physicalRating?.includes('dissatisfied') && !f.feedback.faceRating?.includes('dissatisfied') && !f.feedback.tarotRating?.includes('dissatisfied')).length;
    const dissatisfiedCount = allFeedbacks.filter(f => f.feedback && (f.feedback.physicalRating?.includes('dissatisfied') || f.feedback.faceRating?.includes('dissatisfied') || f.feedback.tarotRating?.includes('dissatisfied'))).length;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-800">🧠 AI 훈련 센터 (피드백 취합 현황)</h3>
          <button onClick={() => { setFeedbacksLoading(true); getAllFeedbacks().then(f => { setAllFeedbacks(f); setFeedbacksLoading(false); }).catch(() => setFeedbacksLoading(false)); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold">
            <i className="fas fa-sync-alt"></i> 새로고침
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <p className="text-sm font-bold text-slate-500 mb-1">총 누적 피드백</p>
            <p className="text-3xl font-black text-slate-800">{totalCount}<span className="text-base font-medium text-slate-500 ml-1">건</span></p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 shadow-sm">
            <p className="text-sm font-bold text-emerald-600 mb-1">👍 만족 이상 비율</p>
            <p className="text-3xl font-black text-emerald-700">{totalCount ? Math.round((satisfiedCount / totalCount) * 100) : 0}<span className="text-base font-medium text-emerald-600 ml-1">% ({satisfiedCount}건)</span></p>
          </div>
          <div className="bg-rose-50 rounded-2xl p-6 border border-rose-100 shadow-sm">
            <p className="text-sm font-bold text-rose-600 mb-1">⚠️ 불만족 피드백</p>
            <p className="text-3xl font-black text-rose-700">{dissatisfiedCount}<span className="text-base font-medium text-rose-600 ml-1">건 (지속 학습 대상)</span></p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">구분</th>
                  <th className="px-4 py-3">지점명 / 기기</th>
                  <th className="px-4 py-3">고객 정보</th>
                  <th className="px-4 py-3">평가 요약</th>
                  <th className="px-4 py-3">관리자 메모 (학습 포인트)</th>
                  <th className="px-4 py-3">제출 일시</th>
                </tr>
              </thead>
              <tbody>
                {allFeedbacks.map(f => {
                  const branchName = branches.find(b => b.id === f.branchId)?.name || f.branchId || '-';
                  const typeLabel = f.feedbackType === 'face' ? '👤 관상' : f.feedbackType === 'tarot' ? '🎴 타로' : '🏃 체형';
                  return (
                    <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-700">{typeLabel}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold">{branchName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{(f.hardwareId || '').substring(0, 8)}</div>
                      </td>
                      <td className="px-4 py-3">
                        {f.userInfo?.gender === 'male' ? '남' : '여'}, {f.userInfo?.age}세
                      </td>
                      <td className="px-4 py-3">
                        {f.feedbackType === 'body' && (
                          <div className="text-xs space-y-1">
                            <div>신체: {f.feedback?.physicalRating}</div>
                            <div>얼굴: {f.feedback?.faceRating}</div>
                            <div>두뇌: {f.feedback?.brainRating}</div>
                          </div>
                        )}
                        {f.feedbackType === 'face' && <div className="text-xs">관상: {f.feedback?.faceRating}</div>}
                        {f.feedbackType === 'tarot' && <div className="text-xs">타로: {f.feedback?.tarotRating}</div>}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-xs text-slate-600" title={f.feedback?.notes}>
                        {f.feedback?.notes || '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(f.createdAt || f.syncedAt?.toDate?.() || Date.now()).toLocaleString('ko-KR')}
                      </td>
                    </tr>
                  );
                })}
                {allFeedbacks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">수집된 피드백 데이터가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100 h-screen">
      {/* Header */}
      <div className="bg-white shadow-sm flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-black text-slate-800 flex items-center">
          <i className="fas fa-server text-indigo-600 mr-3"></i>BTC 중앙 관리 서버
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-slate-600">
            <i className="fas fa-user-circle mr-2"></i>{currentAdmin?.name} ({currentAdmin?.role})
          </span>
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-full hover:bg-rose-100 text-slate-600 hover:text-rose-600 flex items-center justify-center transition-colors">
            <i className="fas fa-power-off"></i>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-6 mt-4 gap-2">
        <button onClick={() => setActiveTab('overview')} className={`px-6 py-3 font-bold rounded-t-xl transition-colors ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <i className="fas fa-chart-line mr-2"></i>통계 대시보드
        </button>
        <button onClick={() => setActiveTab('devices')} className={`px-6 py-3 font-bold rounded-t-xl transition-colors ${activeTab === 'devices' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <i className="fas fa-desktop mr-2"></i>기기(라이센스) 관리
        </button>
        <button onClick={() => setActiveTab('branches')} className={`px-6 py-3 font-bold rounded-t-xl transition-colors ${activeTab === 'branches' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <i className="fas fa-building mr-2"></i>지점 할당량(Quota)
        </button>
        <button onClick={() => { 
          setActiveTab('members'); 
          if (cloudMembers.length === 0) { 
            setMembersLoading(true); 
            fetchAllMembers().then(m => { setCloudMembers(m); setMembersLoading(false); }).catch(() => setMembersLoading(false)); 
          } 
          if (events.length === 0) {
            fetchAllEvents().then(setEvents).catch(console.error);
          }
        }} className={`px-6 py-3 font-bold rounded-t-xl transition-colors ${activeTab === 'members' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <i className="fas fa-users mr-2"></i>회원관리
        </button>
        <button onClick={() => { 
          setActiveTab('events'); 
          setEventsLoading(true); 
          fetchAllEvents().then(evs => { setEvents(evs); setEventsLoading(false); }).catch(() => setEventsLoading(false)); 
        }} className={`px-6 py-3 font-bold rounded-t-xl transition-colors ${activeTab === 'events' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <i className="fas fa-handshake mr-2"></i>합동 행사 관리
        </button>
        <button onClick={() => setActiveTab('feedbacks')} className={`px-6 py-3 font-bold rounded-t-xl transition-colors ${activeTab === 'feedbacks' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <i className="fas fa-brain mr-2"></i>AI 피드백 훈련
        </button>
        <button onClick={() => setActiveTab('errors')} className={`px-6 py-3 font-bold rounded-t-xl transition-colors ${activeTab === 'errors' ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <i className="fas fa-exclamation-triangle mr-2"></i>에러 모니터링
        </button>
        {currentAdmin?.role === 'master' && (
        <button onClick={() => setActiveTab('settings')} className={`px-6 py-3 font-bold rounded-t-xl transition-colors ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <i className="fas fa-cog mr-2"></i>시스템 설정
        </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 bg-white mx-6 mb-6 rounded-b-xl rounded-tr-xl shadow-sm p-6 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-slate-400">데이터 로딩 중...</div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (() => {
              // 날짜 기준 계산
              const today = new Date();
              const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

              const yesterday = new Date();
              yesterday.setDate(today.getDate() - 1);
              const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).getTime();
              const yesterdayEnd = todayStart;

              // 이번 주 (월요일 시작 기준)
              const getStartOfWeek = (d: Date): Date => {
                const date = new Date(d);
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                const start = new Date(date.setDate(diff));
                start.setHours(0, 0, 0, 0);
                return start;
              };
              const startOfWeek = getStartOfWeek(today);
              const startOfWeekTime = startOfWeek.getTime();

              // 이번 달
              const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
              const startOfMonthTime = startOfMonth.getTime();

              // 멤버 날짜 파싱 헬퍼
              const getMemberTime = (m: MemberRecord): number => {
                if (m.lastTestDate) {
                  const t = new Date(m.lastTestDate).getTime();
                  if (!isNaN(t)) return t;
                }
                if (m.report?.date) {
                  const t = new Date(m.report.date).getTime();
                  if (!isNaN(t)) return t;
                }
                return 0;
              };

              // 완전히 점검이 완료된 회원만 필터링 (분석 대기 제외)
              const analyzedCloudMembers = cloudMembers.filter(m => {
                const name = m.name || m.report?.userInfo?.name || '';
                return name && !name.startsWith('(분석 대기)');
              });

              // 1. 기간별 점검자 계산
              let todayTestedCount = 0;
              let yesterdayTestedCount = 0;
              let thisMonthTestedCount = 0;

              const todayActiveBranchesSet = new Set<string>();
              const todayActiveRegionsSet = new Set<string>();

              analyzedCloudMembers.forEach(m => {
                const mTime = getMemberTime(m);
                if (mTime === 0) return;

                if (mTime >= todayStart) {
                  todayTestedCount++;
                  if (m.branchId) todayActiveBranchesSet.add(m.branchId);
                  if (m.regionId) todayActiveRegionsSet.add(m.regionId);
                } else if (mTime >= yesterdayStart && mTime < yesterdayEnd) {
                  yesterdayTestedCount++;
                }

                if (mTime >= startOfMonthTime) {
                  thisMonthTestedCount++;
                }
              });

              // 2. 랭킹 기간 선택에 따른 집계
              const rankFiltered = analyzedCloudMembers.filter(m => {
                const mTime = getMemberTime(m);
                if (mTime === 0) return false;
                if (rankPeriod === 'today') return mTime >= todayStart;
                if (rankPeriod === 'week') return mTime >= startOfWeekTime;
                return mTime >= startOfMonthTime;
              });

              const branchCounts: Record<string, number> = {};
              const regionCounts: Record<string, number> = {};

              rankFiltered.forEach(m => {
                if (m.branchId) branchCounts[m.branchId] = (branchCounts[m.branchId] || 0) + 1;
                if (m.regionId) regionCounts[m.regionId] = (regionCounts[m.regionId] || 0) + 1;
              });

              const branchRankList = branches.map(b => {
                const count = branchCounts[b.id] || 0;
                const region = regions.find(r => r.id === b.regionId);
                return {
                  ...b,
                  count,
                  regionName: region ? region.name : '알 수 없음'
                };
              }).sort((a, b) => b.count - a.count);

              const regionRankList = regions.map(r => {
                const count = regionCounts[r.id] || 0;
                return {
                  ...r,
                  count
                };
              }).sort((a, b) => b.count - a.count);

              // 3. 위험 지점 및 지역 (이번 달 실적 기준 저조한 곳)
              const activeBranchIds = new Set(devices.filter(d => d.status === 'active').map(d => d.branchId));
              
              // 기기는 있으나 실적이 극히 저조(이번달 2건 이하)인 곳
              const dangerBranches = branches.filter(b => activeBranchIds.has(b.id)).map(b => {
                const count = branchCounts[b.id] || 0;
                const region = regions.find(r => r.id === b.regionId);
                return {
                  ...b,
                  count,
                  regionName: region ? region.name : '알 수 없음'
                };
              }).sort((a, b) => a.count - b.count)
              .filter(b => b.count <= 2);

              // 실적이 매우 저조한 지역 (이번달 5건 이하)
              const dangerRegions = regions.map(r => {
                const count = regionCounts[r.id] || 0;
                return {
                  ...r,
                  count
                };
              }).sort((a, b) => a.count - b.count)
              .filter(r => r.count <= 5);

              // 4. 설치(활성) 지점 현황 계산 (하단 배치용)
              const installedByRegion = regions.map(r => {
                const branchesInRegion = branches.filter(b => b.regionId === r.id);
                const installedCount = branchesInRegion.filter(b => devices.some(d => d.branchId === b.id && d.status === 'active')).length;
                return { regionName: r.name, total: branchesInRegion.length, installed: installedCount };
              }).sort((a, b) => b.installed - a.installed);

              return (
                <div className="h-full flex flex-col gap-6">
                  {/* Today's Realtime Briefing */}
                  <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border-l-8 border-indigo-500 text-white">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-indigo-400 text-3xl shrink-0">
                        <i className="fas fa-bolt animate-pulse"></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-black">오늘의 실시간 점검 브리핑</h3>
                        <p className="text-sm text-slate-300 mt-1">Firestore 회원DB 기준 실시간 오늘 점검 통계입니다.</p>
                      </div>
                    </div>
                    <div className="flex gap-4 md:gap-8 w-full md:w-auto justify-around bg-white/5 md:bg-transparent p-4 md:p-0 rounded-xl">
                      <div className="text-center">
                        <div className="text-xs font-bold text-slate-400 mb-1">활동 지역</div>
                        <div className="text-3xl font-black text-indigo-400">{todayActiveRegionsSet.size}<span className="text-sm font-bold text-slate-500 ml-1">곳</span></div>
                      </div>
                      <div className="w-px h-10 bg-white/10 hidden md:block mt-2"></div>
                      <div className="text-center">
                        <div className="text-xs font-bold text-slate-400 mb-1">활동 지점</div>
                        <div className="text-3xl font-black text-blue-400">{todayActiveBranchesSet.size}<span className="text-sm font-bold text-slate-500 ml-1">개</span></div>
                      </div>
                      <div className="w-px h-10 bg-white/10 hidden md:block mt-2"></div>
                      <div className="text-center">
                        <div className="text-xs font-bold text-slate-400 mb-1">오늘 총 점검자</div>
                        <div className="text-3xl font-black text-emerald-400">{todayTestedCount}<span className="text-sm font-bold text-slate-500 ml-1">명</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl shadow-inner"><i className="fas fa-calendar-day"></i></div>
                      <div>
                        <div className="text-slate-500 text-xs font-bold mb-1">오늘 점검자</div>
                        <div className="text-2xl font-black text-emerald-600">{todayTestedCount}<span className="text-sm font-normal text-slate-500 ml-1">명</span></div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl shadow-inner"><i className="fas fa-history"></i></div>
                      <div>
                        <div className="text-slate-500 text-xs font-bold mb-1">어제 점검자</div>
                        <div className="text-2xl font-black text-blue-600">{yesterdayTestedCount}<span className="text-sm font-normal text-slate-500 ml-1">명</span></div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xl shadow-inner"><i className="fas fa-calendar-alt"></i></div>
                      <div>
                        <div className="text-slate-500 text-xs font-bold mb-1">이번 달 점검자</div>
                        <div className="text-2xl font-black text-indigo-600">{thisMonthTestedCount}<span className="text-sm font-normal text-slate-500 ml-1">명</span></div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xl shadow-inner"><i className="fas fa-database"></i></div>
                      <div>
                        <div className="text-slate-500 text-xs font-bold mb-1">누적 점검 건수</div>
                        <div className="text-2xl font-black text-purple-600">{analyzedCloudMembers.length}<span className="text-sm font-normal text-slate-500 ml-1">건</span></div>
                      </div>
                    </div>
                  </div>

                  {/* AI 피드백 현황 섹션 */}
                  {allFeedbacks.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="text-lg font-bold text-slate-800 mb-4"><i className="fas fa-brain text-emerald-500 mr-2"></i>AI 훈련(피드백) 현황 요약</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                          <div className="text-sm font-bold text-slate-500 mb-1">총 수집된 피드백</div>
                          <div className="text-2xl font-black text-slate-800">{allFeedbacks.length}<span className="text-sm font-normal text-slate-500 ml-1">건</span></div>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col items-center justify-center text-center">
                          <div className="text-sm font-bold text-emerald-600 mb-1">👍 긍정 평가</div>
                          <div className="text-2xl font-black text-emerald-700">
                            {allFeedbacks.filter(f => f.feedback && (f.feedback.physicalRating?.includes('satisfied') || f.feedback.faceRating?.includes('satisfied') || f.feedback.tarotRating?.includes('satisfied')) && !f.feedback.physicalRating?.includes('dissatisfied') && !f.feedback.faceRating?.includes('dissatisfied') && !f.feedback.tarotRating?.includes('dissatisfied')).length}
                            <span className="text-sm font-normal text-emerald-600 ml-1">건</span>
                          </div>
                        </div>
                        <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-rose-100 transition-colors" onClick={() => setActiveTab('feedbacks')} title="클릭하여 상세 피드백 보기">
                          <div className="text-sm font-bold text-rose-600 mb-1">⚠️ 개선 필요 (학습 대상)</div>
                          <div className="text-2xl font-black text-rose-700">
                            {allFeedbacks.filter(f => f.feedback && (f.feedback.physicalRating?.includes('dissatisfied') || f.feedback.faceRating?.includes('dissatisfied') || f.feedback.tarotRating?.includes('dissatisfied'))).length}
                            <span className="text-sm font-normal text-rose-600 ml-1">건</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 랭킹 섹션 */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <h3 className="text-lg font-black text-slate-800 flex items-center">
                        <i className="fas fa-trophy text-amber-500 mr-2"></i>지역별 / 지점별 점검 랭킹
                      </h3>
                      <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200">
                        <button onClick={() => setRankPeriod('today')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${rankPeriod === 'today' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>오늘</button>
                        <button onClick={() => setRankPeriod('week')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${rankPeriod === 'week' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>이번 주</button>
                        <button onClick={() => setRankPeriod('month')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${rankPeriod === 'month' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>이번 달</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* 지점별 랭킹 */}
                      <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl">
                        <div className="text-sm font-bold text-slate-700 mb-4 flex items-center justify-between">
                          <span>🏢 지점별 순위 (상위 7개)</span>
                          <span className="text-xs text-slate-400 font-normal">측정량 많은 순</span>
                        </div>
                        <div className="space-y-3">
                          {branchRankList.slice(0, 7).map((item, idx) => {
                            const maxVal = Math.max(...branchRankList.map(b => b.count), 1);
                            const badges = ['👑 1위', '🥈 2위', '🥉 3위'];
                            return (
                              <div key={item.id} className="flex items-center gap-3">
                                <div className="w-12 text-xs font-bold text-slate-400 shrink-0">
                                  {idx < 3 ? <span className="text-indigo-600 font-extrabold">{badges[idx]}</span> : `  ${idx + 1}위`}
                                </div>
                                <div className="w-24 text-sm font-bold text-slate-700 truncate shrink-0" title={item.name}>{item.name}</div>
                                <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden relative">
                                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-4 rounded-full transition-all duration-700" style={{ width: `${(item.count / maxVal) * 100}%` }}></div>
                                </div>
                                <div className="w-16 text-right shrink-0 text-sm font-black text-slate-700">{item.count}<span className="text-xs font-normal text-slate-400 ml-0.5">명</span></div>
                              </div>
                            );
                          })}
                          {branchRankList.filter(b => b.count > 0).length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-xs">해당 기간 내 점검 내역이 없습니다.</div>
                          )}
                        </div>
                      </div>

                      {/* 지역별 랭킹 */}
                      <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl">
                        <div className="text-sm font-bold text-slate-700 mb-4 flex items-center justify-between">
                          <span>📍 지역별 순위 (상위 7개)</span>
                          <span className="text-xs text-slate-400 font-normal">지역 통합 측정량</span>
                        </div>
                        <div className="space-y-3">
                          {regionRankList.slice(0, 7).map((item, idx) => {
                            const maxVal = Math.max(...regionRankList.map(r => r.count), 1);
                            const badges = ['👑 1위', '🥈 2위', '🥉 3위'];
                            return (
                              <div key={item.id} className="flex items-center gap-3">
                                <div className="w-12 text-xs font-bold text-slate-400 shrink-0">
                                  {idx < 3 ? <span className="text-blue-600 font-extrabold">{badges[idx]}</span> : `  ${idx + 1}위`}
                                </div>
                                <div className="w-24 text-sm font-bold text-slate-700 truncate shrink-0" title={item.name}>{item.name}</div>
                                <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden relative">
                                  <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-4 rounded-full transition-all duration-700" style={{ width: `${(item.count / maxVal) * 100}%` }}></div>
                                </div>
                                <div className="w-16 text-right shrink-0 text-sm font-black text-slate-700">{item.count}<span className="text-xs font-normal text-slate-400 ml-0.5">명</span></div>
                              </div>
                            );
                          })}
                          {regionRankList.filter(r => r.count > 0).length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-xs">해당 기간 내 점검 내역이 없습니다.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 저조 및 위험 지점/지역 섹션 (최하위권) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 위험 지점 */}
                    <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm border-l-4 border-l-rose-500 flex flex-col">
                      <h3 className="text-base font-black text-rose-800 mb-4 flex items-center gap-1.5">
                        <i className="fas fa-exclamation-triangle text-rose-500"></i> 미점검 및 저조 지점 (위험 지점)
                      </h3>
                      <p className="text-xs text-slate-400 mb-4">기기가 활성화(active)되어 있으나 이번 달 실적이 저조(2건 이하)한 지점들입니다.</p>
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {dangerBranches.map(b => (
                          <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 border border-rose-100/50 hover:bg-rose-50 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">{b.regionName}</span>
                              <span className="text-sm font-black text-slate-800">{b.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-rose-600">{b.count > 0 ? `이번 달 ${b.count}건` : '실적 없음 🚨'}</span>
                            </div>
                          </div>
                        ))}
                        {dangerBranches.length === 0 && (
                          <div className="text-center py-10 text-slate-400 text-xs font-bold">실적이 저조한 활성 지점이 없습니다. 👍</div>
                        )}
                      </div>
                    </div>

                    {/* 위험 지역 */}
                    <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm border-l-4 border-l-amber-500 flex flex-col">
                      <h3 className="text-base font-black text-amber-800 mb-4 flex items-center gap-1.5">
                        <i className="fas fa-chart-line text-amber-500"></i> 측정 저조 지역 (위험 지역)
                      </h3>
                      <p className="text-xs text-slate-400 mb-4">이번 달 총 측정 실적이 5건 이하로 미진한 지역들입니다.</p>
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {dangerRegions.map(r => (
                          <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-100/50 hover:bg-amber-50 transition-colors">
                            <span className="text-sm font-black text-slate-800">{r.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-amber-700">{r.count > 0 ? `이번 달 총 ${r.count}건` : '활동 없음 🚨'}</span>
                            </div>
                          </div>
                        ))}
                        {dangerRegions.length === 0 && (
                          <div className="text-center py-10 text-slate-400 text-xs font-bold">실적이 저조한 지역이 없습니다. 👍</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[400px]">
                    {/* Line Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="text-lg font-bold text-slate-800 mb-6"><i className="fas fa-chart-line text-indigo-500 mr-2"></i>일별 측정량 추이 (최근 14일)</h3>
                      <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={stats.dailyStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                            <RechartsTooltip cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                            <Line type="monotone" dataKey="count" name="검사 건수" stroke="#6366f1" strokeWidth={4} dot={{r: 4, fill: '#6366f1', strokeWidth: 0}} activeDot={{r: 6, strokeWidth: 0}} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="text-lg font-bold text-slate-800 mb-6"><i className="fas fa-trophy text-amber-500 mr-2"></i>지점별 누적 사용량 TOP 10</h3>
                      <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.branchStats.slice(0, 10).map(b => ({
                            name: branches.find(branch => branch.id === b.branchId)?.name || '알 수 없음',
                            count: b.count
                          }))} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 'bold'}} width={100} />
                            <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                            <Bar dataKey="count" name="검사 건수" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* 지점별 오늘/누적 점검 현황 전체 테이블 */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4"><i className="fas fa-list-ol text-purple-500 mr-2"></i>지점별 오늘/누적 점검 현황 (전체)</h3>
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                          <tr>
                            <th className="p-3 text-left font-bold text-slate-600 w-8">#</th>
                            <th className="p-3 text-left font-bold text-slate-600">지역</th>
                            <th className="p-3 text-left font-bold text-slate-600">지점명</th>
                            <th className="p-3 text-center font-bold text-slate-600">오늘</th>
                            <th className="p-3 text-center font-bold text-slate-600">누적</th>
                            <th className="p-3 text-right font-bold text-slate-600">상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {branches.map(b => {
                            const bStat = stats.branchStats.find(s => s.branchId === b.id);
                            const cumCount = bStat?.count || 0;
                            const todayUse = (branchUsages[b.id]?.kfaceUsed || 0) + (branchUsages[b.id]?.ktarotUsed || 0);
                            return { branch: b, cumCount, todayUse };
                          }).sort((a, b) => b.cumCount - a.cumCount).map((item, idx) => (
                            <tr key={item.branch.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                              <td className="p-3 text-xs text-slate-400 font-bold">{idx + 1}</td>
                              <td className="p-3 text-xs text-indigo-500 font-bold">{regions.find(r => r.id === item.branch.regionId)?.name || '-'}</td>
                              <td className="p-3 font-bold text-slate-700">{item.branch.name}</td>
                              <td className="p-3 text-center">
                                {item.todayUse > 0 ? (
                                  <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-black text-xs">{item.todayUse}건</span>
                                ) : (
                                  <span className="text-slate-300 text-xs">-</span>
                                )}
                              </td>
                              <td className="p-3 text-center font-bold text-slate-700">{item.cumCount > 0 ? `${item.cumCount}건` : '-'}</td>
                              <td className="p-3 text-right">
                                {item.todayUse > 0 ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-bold">활동중</span>
                                ) : item.cumCount > 0 ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">오늘 미활동</span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-400 font-bold">미사용</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 지역별 설치 현황 (하단 배치 완료) */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-6"><i className="fas fa-map-marked-alt text-teal-500 mr-2"></i>지역별 설치(활성) 지점 현황</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {installedByRegion.map(item => (
                        <div key={item.regionName} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
                          <div className="font-bold text-slate-700 mb-2 truncate w-full" title={item.regionName}>{item.regionName}</div>
                          <div className="text-2xl font-black text-teal-600">{item.installed}<span className="text-xs text-slate-400 ml-1">/ {item.total}</span></div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-3 overflow-hidden">
                            <div className="bg-teal-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${item.total > 0 ? (item.installed / item.total) * 100 : 0}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Devices Tab */}
            {activeTab === 'devices' && (() => {
              // 타임스탬프를 밀리초로 안전하게 변환
              const getTime = (ts: any): number => {
                if (!ts) return 0;
                if (ts.toMillis) return ts.toMillis();
                if (ts.seconds) return ts.seconds * 1000;
                if (ts instanceof Date) return ts.getTime();
                if (typeof ts === 'number') return ts;
                return 0;
              };

              // 버전 문자열을 비교 가능한 숫자 배열로 변환
              const parseVersion = (v: any): number[] => {
                if (!v || v === '-' || v === 'unknown') return [0, 0, 0];
                return String(v).split('.').map(n => parseInt(n, 10) || 0);
              };
              const compareVersions = (a: string | undefined, b: string | undefined): number => {
                const va = parseVersion(a);
                const vb = parseVersion(b);
                for (let i = 0; i < Math.max(va.length, vb.length); i++) {
                  const diff = (va[i] || 0) - (vb[i] || 0);
                  if (diff !== 0) return diff;
                }
                return 0;
              };

              // 최신 버전 계산 (PC 버전에 대해서만 계산, LITE는 웹이라 항상 최신)
              const pcDevices = devices.filter(d => d.deviceType === 'pc' || !d.deviceType);
              const allVersions = pcDevices.map(d => d.appVersion).filter(v => v && v !== '-' && v !== 'unknown') as string[];
              const latestVersion = allVersions.length > 0 ? allVersions.sort((a, b) => compareVersions(b, a))[0] : null;

              const toggleSort = (key: 'createdAt' | 'appVersion') => {
                if (deviceSortKey === key) {
                  setDeviceSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
                } else {
                  setDeviceSortKey(key);
                  setDeviceSortDir('desc');
                }
              };

              const filteredDevices = devices.filter(d => {
                const branch = branches.find(b => b.id === d.branchId);
                const regionName = regions.find(r => r.id === branch?.regionId)?.name || '';
                
                if (deviceFilterRegion !== 'all' && branch?.regionId !== deviceFilterRegion) return false;
                if (deviceFilterBranch !== 'all' && d.branchId !== deviceFilterBranch) return false;
                
                if (deviceSearchQuery) {
                  const q = deviceSearchQuery.toLowerCase();
                  const bName = branch?.name?.toLowerCase() || '';
                  const rName = regionName.toLowerCase();
                  const adminName = d.adminName?.toLowerCase() || '';
                  const deviceIdStr = d.id ? String(d.id).toLowerCase() : '';
                  if (!bName.includes(q) && !rName.includes(q) && !adminName.includes(q) && !deviceIdStr.includes(q)) {
                    return false;
                  }
                }
                return true;
              }).sort((a, b) => {
                let cmp = 0;
                if (deviceSortKey === 'createdAt') {
                  cmp = getTime(a.createdAt) - getTime(b.createdAt);
                } else {
                  cmp = compareVersions(a.appVersion, b.appVersion);
                }
                return deviceSortDir === 'desc' ? -cmp : cmp;
              });

              return (
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h2 className="text-lg font-bold text-slate-800">등록된 기기 목록 ({filteredDevices.length}대)</h2>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <select 
                        className="px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
                        value={deviceFilterRegion}
                        onChange={e => {
                          setDeviceFilterRegion(e.target.value);
                          setDeviceFilterBranch('all');
                        }}
                      >
                        <option value="all">전체 지역</option>
                        {regions.sort((a,b)=>(a.order||0)-(b.order||0)).map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      
                      <select 
                        className="px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
                        value={deviceFilterBranch}
                        onChange={e => setDeviceFilterBranch(e.target.value)}
                        disabled={deviceFilterRegion === 'all'}
                      >
                        <option value="all">전체 지점</option>
                        {branches.filter(b => b.regionId === deviceFilterRegion).sort((a,b)=>(a.name || '').localeCompare(b.name || '', 'ko')).map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      
                      <div className="relative flex-1 sm:flex-none">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input 
                          type="text" 
                          placeholder="기기 ID, 지점명, 관리자 검색" 
                          className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm w-full sm:w-64 outline-none focus:border-indigo-500"
                          value={deviceSearchQuery}
                          onChange={e => setDeviceSearchQuery(e.target.value)}
                        />
                      </div>
                      <button 
                        onClick={() => loadData()}
                        disabled={isLoading}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 text-sm disabled:opacity-50 whitespace-nowrap"
                        title="최신 기기 데이터 불러오기"
                      >
                        {isLoading ? '로딩...' : '🔄 새로고침'}
                      </button>
                    </div>
                  </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                      <tr>
                        <th className="px-4 py-3">지역</th>
                        <th className="px-4 py-3">지점</th>
                        <th className="px-4 py-3">종류</th>
                        <th className="px-4 py-3">기기 ID</th>
                        <th className="px-4 py-3">책임자</th>
                        <th className="px-4 py-3">연락처</th>
                        <th className="px-4 py-3 cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap" onClick={() => toggleSort('createdAt')}>
                          등록일 {deviceSortKey === 'createdAt' ? (deviceSortDir === 'desc' ? '▼' : '▲') : <span className="text-slate-300">⇅</span>}
                        </th>
                        <th className="px-4 py-3 cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap" onClick={() => toggleSort('appVersion')}>
                          버전 {deviceSortKey === 'appVersion' ? (deviceSortDir === 'desc' ? '▼' : '▲') : <span className="text-slate-300">⇅</span>}
                        </th>
                        <th className="px-4 py-3">상태</th>
                        <th className="px-4 py-3 text-right">제어</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDevices.map(d => {
                        const branch = branches.find(b => b.id === d.branchId);
                        const branchName = branch?.name || '알 수 없음';
                        const regionName = regions.find(r => r.id === branch?.regionId)?.name || '-';
                        return (
                          <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3 text-xs font-bold text-indigo-600">{regionName}</td>
                            <td className="px-4 py-3 font-bold">{branchName}</td>
                            <td className="px-4 py-3">
                              {d.deviceType === 'pc' ? (
                                <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-200">🖥️ PC</span>
                              ) : (
                                <span className="px-2 py-1 rounded bg-fuchsia-100 text-fuchsia-700 text-[10px] font-bold border border-fuchsia-200">📱 LITE</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{String(d.id || '').substring(0, 12)}...</td>
                            <td className="px-4 py-3 font-bold text-slate-700">{d.adminName || '-'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{d.contact || '-'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}</td>
                            <td className="px-4 py-3 font-mono text-xs font-bold">
                              {d.deviceType !== 'pc' && d.deviceType !== undefined ? (
                                <span className="text-fuchsia-600 font-bold bg-fuchsia-50 px-2 py-1 rounded-full text-[10px] border border-fuchsia-100">
                                  🌐 Web
                                </span>
                              ) : latestVersion && d.appVersion && d.appVersion !== 'unknown' && compareVersions(d.appVersion, latestVersion) < 0 ? (
                                <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700" title={`최신: ${latestVersion}`}>
                                  ⚠️ {d.appVersion}
                                </span>
                              ) : (
                                <span className="text-indigo-600">{d.appVersion || '-'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                d.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                d.status === 'revoked' ? 'bg-rose-100 text-rose-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>{(d.status || 'pending').toUpperCase()}</span>
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              {d.status !== 'active' && <button onClick={() => handleStatusChange(d.id, 'active', d.deviceType || 'pc')} className="px-3 py-1 bg-emerald-500 text-white rounded text-xs">승인</button>}
                              {d.status !== 'revoked' && <button onClick={() => handleStatusChange(d.id, 'revoked', d.deviceType || 'pc')} className="px-3 py-1 bg-rose-500 text-white rounded text-xs">사용중지(해지)</button>}
                              {d.status === 'revoked' && <button onClick={() => handleDeleteDevice(d.id, d.deviceType || 'pc')} className="px-3 py-1 bg-slate-500 hover:bg-slate-600 text-white rounded text-xs">삭제</button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })()}

            {/* Branches Tab */}
            {activeTab === 'branches' && (() => {
              // 지역별 그룹핑
              const groupedByRegion = regions
                .slice().sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(region => ({
                  region,
                  branches: branches
                    .filter(b => b.regionId === region.id)
                    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
                }))
                .filter(g => g.branches.length > 0);

              // 필터 적용
              const filteredGroups = groupedByRegion
                .filter(g => filterRegion === 'all' || g.region.id === filterRegion)
                .map(g => ({
                  ...g,
                  branches: searchQuery
                    ? g.branches.filter(b => b.name.includes(searchQuery))
                    : g.branches
                }))
                .filter(g => g.branches.length > 0);

              const totalFiltered = filteredGroups.reduce((sum, g) => sum + g.branches.length, 0);

              return (
              <div>
                {/* 상단 헤더 + 필터 */}
                <div className="flex flex-col gap-4 mb-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-lg font-bold">지점별 설치 허용 대수 (Quota) 관리</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowAddRegionInput(!showAddRegionInput)}
                        className="px-4 py-2.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <i className="fas fa-plus"></i> 지역 추가
                      </button>
                      <div className="flex items-center gap-2 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                        <div className="text-sm font-bold text-indigo-800">
                          <i className="fas fa-file-excel mr-2 text-green-600"></i>엑셀 일괄 추가
                        </div>
                        <label className={`cursor-pointer px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                          {isUploading ? '업로드 중...' : '파일 선택'}
                          <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} disabled={isUploading} />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 필터 바 */}
                  <div className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 flex-1">
                      <i className="fas fa-map-marker-alt text-indigo-500"></i>
                      <select
                        className="flex-1 p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        value={filterRegion}
                        onChange={e => setFilterRegion(e.target.value)}
                      >
                        <option value="all">전체 지역 ({branches.length}개 지점)</option>
                        {groupedByRegion.map(g => (
                          <option key={g.region.id} value={g.region.id}>
                            {g.region.name} ({g.branches.length}개 지점)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="relative flex-1">
                      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                      <input
                        type="text"
                        placeholder="지점명 검색..."
                        className="w-full pl-9 pr-4 p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <i className="fas fa-times text-xs"></i>
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 font-bold flex items-center whitespace-nowrap">
                      검색 결과: <span className="text-indigo-600 ml-1">{totalFiltered}개</span>
                    </div>
                  </div>
                </div>

                {/* 지역 추가 인라인 폼 */}
                {showAddRegionInput && (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200 mb-4">
                    <i className="fas fa-map-marker-alt text-emerald-500"></i>
                    <input
                      type="text"
                      placeholder="새 지역 이름 입력..."
                      className="flex-1 p-2.5 bg-white border border-emerald-300 rounded-lg text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      value={newRegionName}
                      onChange={e => setNewRegionName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddRegion(); }}
                      autoFocus
                    />
                    <button
                      onClick={handleAddRegion}
                      className="px-4 py-2.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600"
                    >
                      추가
                    </button>
                    <button
                      onClick={() => { setShowAddRegionInput(false); setNewRegionName(''); }}
                      className="px-4 py-2.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300"
                    >
                      취소
                    </button>
                  </div>
                )}

                {/* 지역별 그룹 렌더링 */}
                <div className="space-y-8">
                  {filteredGroups.map(group => (
                    <div key={group.region.id}>
                      {/* 지역 헤더 */}
                      <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-indigo-200">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                          <i className="fas fa-map-pin text-sm"></i>
                        </div>
                        <h3 className="text-base font-black text-slate-800">{group.region.name}</h3>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                          {group.branches.length}개 지점
                        </span>
                        <div className="flex-1"></div>
                        <button
                          onClick={() => { setShowAddBranchForRegion(showAddBranchForRegion === group.region.id ? null : group.region.id); setNewBranchName(''); }}
                          className="text-emerald-500 hover:text-emerald-700 text-xs font-bold px-2 py-1 flex items-center gap-1 transition-colors"
                          title="지점 추가"
                        >
                          <i className="fas fa-plus-circle"></i> 지점 추가
                        </button>
                        <button
                          onClick={() => handleDeleteRegion(group.region.id, group.region.name)}
                          className="text-slate-300 hover:text-rose-500 text-xs px-2 py-1 flex items-center gap-1 transition-colors"
                          title="지역 삭제"
                        >
                          <i className="fas fa-trash-alt"></i> 지역 삭제
                        </button>
                      </div>

                      {/* 해당 지역의 지점 카드 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {group.branches.map(b => {
                          const pcActiveCount = devices.filter(d => d.branchId === b.id && d.status === 'active' && d.deviceType === 'pc').length;
                          const liteActiveCount = devices.filter(d => d.branchId === b.id && d.status === 'active' && d.deviceType !== 'pc').length;
                          return (
                            <div key={b.id} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-lg font-black text-slate-800">{b.name}</div>
                                {(() => {
                                  const todayUse = (branchUsages[b.id]?.kfaceUsed || 0) + (branchUsages[b.id]?.ktarotUsed || 0);
                                  return todayUse > 0 ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-bold animate-pulse">활동중</span>
                                  ) : null;
                                })()}
                              </div>

                              {/* 오늘/누적 점검수 */}
                              <div className="flex gap-2 mb-3">
                                <div className="flex-1 bg-emerald-50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-emerald-600 font-bold">오늘 점검</div>
                                  <div className="text-lg font-black text-emerald-700">{(branchUsages[b.id]?.kfaceUsed || 0) + (branchUsages[b.id]?.ktarotUsed || 0)}<span className="text-[10px] text-emerald-500 ml-0.5">건</span></div>
                                </div>
                                <div className="flex-1 bg-violet-50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-violet-600 font-bold">누적 점검</div>
                                  <div className="text-lg font-black text-violet-700">{stats.branchStats.find(s => s.branchId === b.id)?.count || 0}<span className="text-[10px] text-violet-500 ml-0.5">건</span></div>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-slate-500">🖥️ PC 활성:</span>
                                <span className={`text-sm font-bold ${pcActiveCount > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{pcActiveCount}대</span>
                              </div>
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-bold text-slate-500">📱 LITE 활성:</span>
                                <span className={`text-sm font-bold ${liteActiveCount > 0 ? 'text-fuchsia-600' : 'text-slate-400'}`}>{liteActiveCount}대</span>
                              </div>
                              
                              <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 mb-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-blue-600 border border-blue-100">PC 허용</span>
                                  <div className="flex items-center gap-1">
                                    <input 
                                      type="number" 
                                      className="w-12 p-0.5 border border-slate-300 rounded text-center font-bold text-xs" 
                                      defaultValue={b.allowedLicenses || 2}
                                      onBlur={(e) => handleUpdateQuota(b, parseInt(e.target.value))}
                                    />
                                    <span className="text-xs text-slate-500">대</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-500 font-bold bg-fuchsia-50 px-1.5 py-0.5 rounded text-fuchsia-600 border border-fuchsia-100">LITE 허용</span>
                                  <div className="flex items-center gap-1">
                                    <input 
                                      type="number" 
                                      className="w-12 p-0.5 border border-slate-300 rounded text-center font-bold text-xs" 
                                      defaultValue={b.liteAllowedLicenses !== undefined ? b.liteAllowedLicenses : 1}
                                      onBlur={(e) => handleUpdateLiteQuota(b, parseInt(e.target.value))}
                                    />
                                    <span className="text-xs text-slate-500">대</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                                <button 
                                  onClick={() => handleDeleteBranch(b.id, b.name)}
                                  className="text-slate-300 hover:text-rose-500 text-[10px] px-2 py-1 transition-colors flex items-center gap-1"
                                  title="지점 삭제"
                                >
                                  <i className="fas fa-trash-alt"></i> 지점 삭제
                                </button>
                              </div>
                              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between bg-fuchsia-50/50 px-2 py-1.5 rounded-lg border border-fuchsia-100">
                                  <div className="flex flex-col">
                                    <span className="text-[11px] text-fuchsia-700 font-bold">관상 한도</span>
                                    <span className="text-[10px] text-fuchsia-600/70">사용: {branchUsages[b.id]?.kfaceUsed || 0}회</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <input 
                                      type="number" 
                                      className="w-12 p-1 border border-fuchsia-200 rounded text-center font-bold text-[11px] bg-white text-fuchsia-700" 
                                      defaultValue={b.kfaceDailyLimit ?? 30}
                                      onBlur={(e) => handleUpdateDailyLimit(b, 'kface', parseInt(e.target.value))}
                                    />
                                    <span className="text-[10px] text-fuchsia-700">회</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between bg-indigo-50/50 px-2 py-1.5 rounded-lg border border-indigo-100">
                                  <div className="flex flex-col">
                                    <span className="text-[11px] text-indigo-700 font-bold">타로 한도</span>
                                    <span className="text-[10px] text-indigo-600/70">사용: {branchUsages[b.id]?.ktarotUsed || 0}회</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <input 
                                      type="number" 
                                      className="w-12 p-1 border border-indigo-200 rounded text-center font-bold text-[11px] bg-white text-indigo-700" 
                                      defaultValue={b.ktarotDailyLimit ?? 30}
                                      onBlur={(e) => handleUpdateDailyLimit(b, 'ktarot', parseInt(e.target.value))}
                                    />
                                    <span className="text-[10px] text-indigo-700">회</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* 지점 추가 카드 */}
                        {showAddBranchForRegion === group.region.id && (
                          <div className="border-2 border-dashed border-emerald-300 rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-emerald-50/50">
                            <div className="text-sm font-bold text-emerald-700">
                              <i className="fas fa-store mr-1"></i> 새 지점 추가
                            </div>
                            <input
                              type="text"
                              placeholder="지점 이름 입력..."
                              className="w-full p-2.5 border border-emerald-300 rounded-lg text-sm text-center font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                              value={newBranchName}
                              onChange={e => setNewBranchName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleAddBranch(group.region.id); }}
                              autoFocus
                            />
                            <div className="flex gap-2 w-full">
                              <button
                                onClick={() => { setShowAddBranchForRegion(null); setNewBranchName(''); }}
                                className="flex-1 py-2 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300"
                              >
                                취소
                              </button>
                              <button
                                onClick={() => handleAddBranch(group.region.id)}
                                className="flex-1 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600"
                              >
                                추가
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {filteredGroups.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <i className="fas fa-search text-3xl mb-3"></i>
                      <p className="font-bold">검색 결과가 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>
              );
            })()}

            {/* Members Tab */}
            {activeTab === 'members' && (() => {
              // cloudMembers에서 고유한 eventCode 목록 추출
              const uniqueEventCodes = Array.from(
                new Set(
                  cloudMembers
                    .map(m => m.eventCode)
                    .filter((code): code is string => !!code)
                )
              );

              // 분석 완료 회원 vs 분석 대기 회원 분리
              const analyzedMembers = cloudMembers.filter(m => {
                const name = m.name || m.report?.userInfo?.name || '';
                return !name.startsWith('(분석 대기)');
              });
              const pendingMembers = cloudMembers.filter(m => {
                const name = m.name || m.report?.userInfo?.name || '';
                return name.startsWith('(분석 대기)');
              });

              // 현재 서브탭에 따라 필터링 대상 결정
              const currentList = memberSubTab === 'analyzed' ? analyzedMembers : pendingMembers;

              const filteredMembers = currentList.filter(m => {
                const rpt = m.report;
                const name = m.name || rpt?.userInfo?.name || '';

                if (memberFilterRegion !== 'all' && (m as any).regionId !== memberFilterRegion) return false;
                if (memberFilterBranch !== 'all' && (m as any).branchId !== memberFilterBranch) return false;
                if (memberFilterEventCode !== 'all' && m.eventCode !== memberFilterEventCode) return false;
                if (memberFilterSource !== 'all') {
                  const src = (m as any).sourceType || 'PC';
                  if (memberFilterSource === 'LITE' && src !== 'LITE') return false;
                  if (memberFilterSource === 'PC' && src === 'LITE') return false;
                }
                if (memberSearch && !name.includes(memberSearch)) return false;
                return true;
              });

              // 출처별 카운트 (현재 서브탭 기준)
              const pcCount = currentList.filter(m => (m as any).sourceType !== 'LITE').length;
              const liteCount = currentList.filter(m => (m as any).sourceType === 'LITE').length;

              const handleDeleteMember = async (mid: string) => {
                if (currentAdmin?.role !== 'master') {
                  alert('마스터 관리자만 회원 데이터를 삭제할 수 있습니다.');
                  return;
                }
                if (!confirm('정말 이 회원을 삭제하시겠습니까? 클라우드에서 영구 삭제됩니다.')) return;
                const ok = await deleteMemberFromCloud(mid);
                if (ok) setCloudMembers(prev => prev.filter(m => m.id !== mid));
                else alert('삭제 실패');
              };

              const handleExportExcel = async () => {
                // 목록(cloudMembers)은 slim이라 report 무거운 필드가 없음 → 엑셀 필드만 프로젝션해 전량 조회 후,
                // 현재 필터(filteredMembers)에 해당하는 회원만 추려 기존 시트 생성 코드로 내보낸다.
                setMembersLoading(true);
                try {
                  const excelMembers = await fetchMembersForExcel();
                  const excelById = new Map(excelMembers.map(em => [em.id, em]));
                  const rows = filteredMembers.map(fm => {
                    const m: any = excelById.get(fm.id) || fm;
                    const r = m.report;
                    return {
                      '이름': m.name || r?.userInfo?.name || '-',
                      '연락처': r?.userInfo?.phone || m.phone || m.phoneNumber || '-',
                      '나이': r?.userInfo?.age || '-',
                      '성별': r?.userInfo?.gender === 'male' ? '남' : r?.userInfo?.gender === 'female' ? '여' : '-',
                      '출처': m.sourceType === 'LITE' ? '온라인 LITE' : 'PC',
                      '지역': m.regionId || '-',
                      '지점': m.branchId || '-',
                      '합동코드': m.eventCode || '-',
                      '측정일': m.lastTestDate ? new Date(m.lastTestDate).toLocaleDateString() : '-',
                      '신체나이': r?.physicalAge || '-',
                      '뇌나이': r?.brainAge || '-',
                      '얼굴나이': r?.faceAgeEstimate || '-',
                      '종합나이': r?.comprehensiveAge || '-',
                      '종합점수': r?.overallScore || '-',
                      '종합평가': r?.summary || '-',
                      '체형분석': r?.bodyTypeAnalysis || '-',
                      '뇌테스트상세': r?.brainTestEvaluation || '-',
                    };
                  });
                  const ws = xlsx.utils.json_to_sheet(rows);
                  const wb = xlsx.utils.book_new();
                  xlsx.utils.book_append_sheet(wb, ws, '회원데이터');
                  xlsx.writeFile(wb, `회원데이터_${memberSubTab === 'analyzed' ? '분석완료' : '분석대기'}_${new Date().toISOString().slice(0,10)}.xlsx`);
                } finally {
                  setMembersLoading(false);
                }
              };

              const handleRefresh = async () => {
                setMembersLoading(true);
                try {
                  const m = await fetchAllMembers();
                  setCloudMembers(m);
                } finally { setMembersLoading(false); }
              };

              // 상세 모달: 목록은 slim이라 무거운 report가 없음 → 즉시 모달을 열고(가벼운 필드), 전체 문서를 받아 교체.
              const openMemberDetail = async (m: MemberRecord) => {
                setSelectedMember(m);
                const full = await getMemberDetail(m.id);
                if (full) setSelectedMember(prev => (prev && prev.id === m.id ? full : prev));
              };

              return (
                <div className="h-full flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">👥 본사 회원 데이터</h2>
                      <p className="text-xs text-slate-400">전체 지점 측정 결과 통합 조회 (총 {cloudMembers.length}명)</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleRefresh} disabled={membersLoading} className="px-4 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 text-sm disabled:opacity-50">
                        {membersLoading ? '로딩...' : '🔄 새로고침'}
                      </button>
                      <button onClick={handleExportExcel} disabled={filteredMembers.length === 0} className="px-4 py-2 bg-emerald-50 text-emerald-600 font-bold rounded-xl hover:bg-emerald-100 text-sm disabled:opacity-50">
                        📥 Excel 내보내기 ({filteredMembers.length}건)
                      </button>
                    </div>
                  </div>

                  {/* Sub Tabs: 분석 완료 vs 분석 대기 */}
                  <div className="flex gap-2 border-b border-slate-200 pb-0">
                    <button
                      onClick={() => setMemberSubTab('analyzed')}
                      className={`px-5 py-2.5 text-sm font-bold rounded-t-xl border border-b-0 transition-colors ${
                        memberSubTab === 'analyzed'
                          ? 'bg-white text-indigo-700 border-slate-200 -mb-px z-10'
                          : 'bg-slate-50 text-slate-400 border-transparent hover:text-slate-600'
                      }`}
                    >
                      ✅ AI 분석 완료 <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-black ${memberSubTab === 'analyzed' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>{analyzedMembers.length}</span>
                    </button>
                    <button
                      onClick={() => setMemberSubTab('pending')}
                      className={`px-5 py-2.5 text-sm font-bold rounded-t-xl border border-b-0 transition-colors ${
                        memberSubTab === 'pending'
                          ? 'bg-white text-amber-700 border-slate-200 -mb-px z-10'
                          : 'bg-slate-50 text-slate-400 border-transparent hover:text-slate-600'
                      }`}
                    >
                      ⏳ 분석 대기 <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-black ${memberSubTab === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>{pendingMembers.length}</span>
                    </button>
                  </div>

                  {/* Filters */}
                  <div className="flex gap-3 flex-wrap items-center">
                    <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm">
                      <button
                        onClick={() => setMemberFilterSource('all')}
                        className={`px-3 py-2 font-bold transition-colors ${memberFilterSource === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                      >
                        🌐 전체 <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${memberFilterSource === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{currentList.length}</span>
                      </button>
                      <button
                        onClick={() => setMemberFilterSource('PC')}
                        className={`px-3 py-2 font-bold transition-colors border-x border-slate-200 ${memberFilterSource === 'PC' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                      >
                        🖥️ PC <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${memberFilterSource === 'PC' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}>{pcCount}</span>
                      </button>
                      <button
                        onClick={() => setMemberFilterSource('LITE')}
                        className={`px-3 py-2 font-bold transition-colors ${memberFilterSource === 'LITE' ? 'bg-fuchsia-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                      >
                        📱 LITE <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${memberFilterSource === 'LITE' ? 'bg-white/20 text-white' : 'bg-fuchsia-100 text-fuchsia-600'}`}>{liteCount}</span>
                      </button>
                    </div>
                    <select value={memberFilterRegion} onChange={e => { setMemberFilterRegion(e.target.value); setMemberFilterBranch('all'); }} className="px-3 py-2 border rounded-xl text-sm font-bold bg-white text-slate-600 border-slate-200">
                      <option value="all">전체 지역</option>
                      {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <select value={memberFilterBranch} onChange={e => setMemberFilterBranch(e.target.value)} className="px-3 py-2 border rounded-xl text-sm font-bold bg-white text-slate-600 border-slate-200">
                      <option value="all">전체 지점</option>
                      {branches.filter(b => memberFilterRegion === 'all' || b.regionId === memberFilterRegion).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select value={memberFilterEventCode} onChange={e => setMemberFilterEventCode(e.target.value)} className="px-3 py-2 border rounded-xl text-sm font-bold bg-indigo-50 text-indigo-700 border-indigo-200">
                      <option value="all">전체 행사 코드</option>
                      {uniqueEventCodes.map(code => <option key={code} value={code}>{code}</option>)}
                    </select>
                    <input type="text" placeholder="이름 검색..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} className="px-3 py-2 border rounded-xl text-sm flex-1 min-w-[150px]" />
                  </div>

                  {/* Table */}
                  {membersLoading ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400">회원 데이터 로딩 중...</div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-2">
                      <span className="text-4xl">{memberSubTab === 'analyzed' ? '📭' : '⏳'}</span>
                      <span>{memberSubTab === 'analyzed' ? '분석 완료된 회원이 없습니다' : '분석 대기 중인 회원이 없습니다'}</span>
                    </div>
                  ) : memberSubTab === 'analyzed' ? (
                    /* 분석 완료 테이블 */
                    <div className="flex-1 overflow-auto border rounded-2xl">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                          <tr>
                            <th className="p-3 text-left font-bold text-slate-600">이름</th>
                            <th className="p-3 text-left font-bold text-slate-600">연락처</th>
                            <th className="p-3 text-center font-bold text-slate-600">나이</th>
                            <th className="p-3 text-center font-bold text-slate-600">성별</th>
                            <th className="p-3 text-center font-bold text-slate-600">출처</th>
                            <th className="p-3 text-left font-bold text-slate-600">지점</th>
                            <th className="p-3 text-left font-bold text-slate-600">합동코드</th>
                            <th className="p-3 text-center font-bold text-slate-600">측정일</th>
                            <th className="p-3 text-center font-bold text-slate-600">신체나이</th>
                            <th className="p-3 text-center font-bold text-slate-600">뇌나이</th>
                            <th className="p-3 text-center font-bold text-slate-600">마음나이</th>
                            <th className="p-3 text-center font-bold text-slate-600">종합점수</th>
                            <th className="p-3 text-center font-bold text-slate-600">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMembers.map(m => {
                            const r = m.report;
                            const branchName = branches.find(b => b.id === (m as any).branchId)?.name || (m as any).branchId || '-';
                            return (
                              <tr key={m.id} className="border-t hover:bg-indigo-50/50 cursor-pointer transition-colors" onClick={() => openMemberDetail(m)}>
                                <td className="p-3 font-bold text-slate-800">{m.name || r?.userInfo?.name || '-'}</td>
                                <td className="p-3 text-slate-600">{r?.userInfo?.phone || (m as any).phone || (m as any).phoneNumber || '-'}</td>
                                <td className="p-3 text-center">{r?.userInfo?.age || '-'}</td>
                                <td className="p-3 text-center">{r?.userInfo?.gender === 'male' ? '남' : r?.userInfo?.gender === 'female' ? '여' : '-'}</td>
                                <td className="p-3 text-center">
                                  {(m as any).sourceType === 'LITE' ? (
                                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200">📱 LITE</span>
                                  ) : (
                                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">🖥️ PC</span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-600">{branchName}</td>
                                <td className="p-3">
                                  {m.eventCode ? (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">{m.eventCode}</span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                                <td className="p-3 text-center text-slate-500">
                                  {m.lastTestDate ? new Date(m.lastTestDate).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                                </td>
                                <td className="p-3 text-center font-black text-indigo-600">{r?.physicalAge || '-'}</td>
                                <td className="p-3 text-center font-black text-amber-500">{r?.brainAge || '-'}</td>
                                <td className="p-3 text-center font-black text-fuchsia-500">{(r as any)?.mindAge || '-'}</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-1 rounded-lg text-xs font-black ${(r?.overallScore || 0) >= 70 ? 'bg-emerald-100 text-emerald-700' : (r?.overallScore || 0) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{r?.overallScore || '-'}점</span>
                                </td>
                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                  {currentAdmin?.role === 'master' && <button onClick={() => handleDeleteMember(m.id)} className="text-rose-400 hover:text-rose-600 text-xs font-bold">삭제</button>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* 분석 대기 테이블 */
                    <div className="flex-1 overflow-auto border border-amber-200 rounded-2xl bg-amber-50/30">
                      <table className="w-full text-sm">
                        <thead className="bg-amber-50 sticky top-0 z-10">
                          <tr>
                            <th className="p-3 text-left font-bold text-amber-700">이름</th>
                            <th className="p-3 text-left font-bold text-amber-700">연락처</th>
                            <th className="p-3 text-center font-bold text-amber-700">나이</th>
                            <th className="p-3 text-center font-bold text-amber-700">성별</th>
                            <th className="p-3 text-center font-bold text-amber-700">출처</th>
                            <th className="p-3 text-left font-bold text-amber-700">지점</th>
                            <th className="p-3 text-left font-bold text-amber-700">합동코드</th>
                            <th className="p-3 text-center font-bold text-amber-700">등록일</th>
                            <th className="p-3 text-center font-bold text-amber-700">상태</th>
                            <th className="p-3 text-center font-bold text-amber-700">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMembers.map(m => {
                            const r = m.report;
                            const rawName = m.name || r?.userInfo?.name || '-';
                            const displayName = rawName.replace('(분석 대기) ', '');
                            const branchName = branches.find(b => b.id === (m as any).branchId)?.name || (m as any).branchId || '-';
                            return (
                              <tr key={m.id} className="border-t border-amber-100 hover:bg-amber-50/50 transition-colors">
                                <td className="p-3 font-bold text-slate-700">{displayName}</td>
                                <td className="p-3 text-slate-600">{r?.userInfo?.phone || (m as any).phone || (m as any).phoneNumber || '-'}</td>
                                <td className="p-3 text-center">{r?.userInfo?.age || '-'}</td>
                                <td className="p-3 text-center">{r?.userInfo?.gender === 'male' ? '남' : r?.userInfo?.gender === 'female' ? '여' : '-'}</td>
                                <td className="p-3 text-center">
                                  {(m as any).sourceType === 'LITE' ? (
                                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200">📱 LITE</span>
                                  ) : (
                                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">🖥️ PC</span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-600">{branchName}</td>
                                <td className="p-3">
                                  {m.eventCode ? (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">{m.eventCode}</span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                                <td className="p-3 text-center text-slate-500">
                                  {m.lastTestDate ? new Date(m.lastTestDate).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                                </td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 animate-pulse">⏳ 대기중</span>
                                </td>
                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                  {currentAdmin?.role === 'master' && <button onClick={() => handleDeleteMember(m.id)} className="text-rose-400 hover:text-rose-600 text-xs font-bold">삭제</button>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Detail Modal */}
                  {selectedMember && (() => {
                    const r = selectedMember.report;
                    const branchName = branches.find(b => b.id === (selectedMember as any).branchId)?.name || (selectedMember as any).branchId || '-';
                    const codeColors = [
                      { label: '기초 에너지', color: 'from-red-500 to-red-600', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
                      { label: '감정 흐름', color: 'from-orange-500 to-orange-600', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                      { label: '추진력', color: 'from-yellow-500 to-yellow-600', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
                      { label: '정서 안정', color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
                      { label: '소통', color: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
                      { label: '집중·통찰', color: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
                      { label: '삶의 방향', color: 'from-violet-500 to-violet-600', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' }
                    ];
                    const sevenCodes = r?.sevenCodeAnalysis ? [
                      r.sevenCodeAnalysis.code1, r.sevenCodeAnalysis.code2, r.sevenCodeAnalysis.code3,
                      r.sevenCodeAnalysis.code4, r.sevenCodeAnalysis.code5, r.sevenCodeAnalysis.code6, r.sevenCodeAnalysis.code7
                    ] : [];
                    return (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedMember(null)}>
                        <div className="bg-white rounded-3xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                          {/* 헤더 */}
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-800">👤 {selectedMember.name || r?.userInfo?.name}</h3>
                            <button onClick={() => setSelectedMember(null)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
                          </div>

                          {/* 기본 정보 */}
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs text-slate-400">나이</span><div className="font-bold">{r?.userInfo?.age}세</div></div>
                            <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs text-slate-400">성별</span><div className="font-bold">{r?.userInfo?.gender === 'male' ? '남성' : '여성'}</div></div>
                            <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs text-slate-400">지점</span><div className="font-bold">{branchName}</div></div>
                            <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs text-slate-400">측정일</span><div className="font-bold">
                              {selectedMember.lastTestDate ? new Date(selectedMember.lastTestDate).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                            </div></div>
                            <div className="bg-slate-50 rounded-xl p-3 col-span-2"><span className="text-xs text-slate-400">연락처</span><div className="font-bold">{r?.userInfo?.phone || (selectedMember as any).phone || (selectedMember as any).phoneNumber || '-'}</div></div>
                            {selectedMember.eventCode && (
                              <div className="bg-indigo-50 rounded-xl p-3 col-span-2 border border-indigo-100 flex justify-between items-center">
                                <div>
                                  <span className="text-xs text-indigo-500 font-bold">합동 행사 코드</span>
                                  <div className="font-bold text-indigo-700">{selectedMember.eventCode}</div>
                                </div>
                                <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-sm">합동 측정 대상자</span>
                              </div>
                            )}
                          </div>

                          {/* 나이 카드 (5개 + 통합나이, 종합점수) */}
                          <div className="grid grid-cols-4 gap-2 mb-2">
                            <div className="bg-indigo-50 rounded-xl p-3 text-center"><span className="text-[10px] text-indigo-400 font-bold">신체나이</span><div className="text-xl font-black text-indigo-600">{r?.physicalAge || '-'}</div></div>
                            <div className="bg-amber-50 rounded-xl p-3 text-center"><span className="text-[10px] text-amber-400 font-bold">뇌나이</span><div className="text-xl font-black text-amber-500">{r?.brainAge || '-'}</div></div>
                            <div className="bg-rose-50 rounded-xl p-3 text-center"><span className="text-[10px] text-rose-400 font-bold">얼굴나이</span><div className="text-xl font-black text-rose-500">{r?.faceAgeEstimate || '-'}</div></div>
                            <div className="bg-fuchsia-50 rounded-xl p-3 text-center"><span className="text-[10px] text-fuchsia-400 font-bold">마음나이</span><div className="text-xl font-black text-fuchsia-500">{(r as any)?.mindAge || '-'}</div></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-emerald-600 rounded-xl p-3 text-center text-white"><span className="text-[10px] text-emerald-100 font-bold">3바디 통합 나이</span><div className="text-xl font-black">{(r as any)?.comprehensiveAge || r?.physicalAge || '-'}</div></div>
                            <div className="bg-indigo-600 rounded-xl p-3 text-center text-white"><span className="text-[10px] text-indigo-200 font-bold">3바디 코어 점수</span><div className="text-xl font-black">{r?.overallScore || '-'}</div></div>
                          </div>

                          {/* 종합 평가 */}
                          {r?.summary && <div className="bg-slate-50 rounded-xl p-4 mb-3"><span className="text-xs text-slate-400 font-bold">종합 평가</span><p className="text-sm text-slate-700 mt-1 leading-relaxed">{r.summary}</p></div>}

                          {/* 체형 분석 */}
                          {r?.bodyTypeAnalysis && <div className="bg-indigo-50 rounded-xl p-4 mb-3"><span className="text-xs text-indigo-400 font-bold">체형 분석</span><p className="text-sm text-indigo-800 mt-1">{r.bodyTypeAnalysis}</p></div>}

                          {/* 뇌 건강 분석 */}
                          {r?.brainTestEvaluation && <div className="bg-amber-50 rounded-xl p-4 mb-3 border border-amber-100"><span className="text-xs text-amber-500 font-bold">🧠 뇌 건강 분석</span><p className="text-sm text-amber-800 mt-1 leading-relaxed">{r.brainTestEvaluation}</p></div>}

                          {/* 얼굴 분석 */}
                          {r?.faceAnalysis && (
                            <div className="bg-rose-50 rounded-xl p-4 mb-3 border border-rose-100">
                              <span className="text-xs text-rose-500 font-bold">😊 입체 안면 노화 분석</span>
                              <div className="mt-2 space-y-2">
                                {r.faceAnalysis.skinTone && <div className="text-sm text-slate-700"><span className="font-bold text-rose-600 mr-1">피부 톤/밝기.</span>{r.faceAnalysis.skinTone}</div>}
                                <div className="text-sm text-slate-700"><span className="font-bold text-rose-600 mr-1">탄력도.</span>{r.faceAnalysis.elasticity}</div>
                                <div className="text-sm text-slate-700"><span className="font-bold text-rose-600 mr-1">주름/굴곡.</span>{r.faceAnalysis.wrinkles}</div>
                                <div className="bg-white rounded-lg p-2 mt-2 border border-rose-100"><span className="text-xs text-rose-500 font-bold">종합 평가.</span><span className="text-sm text-slate-700 ml-1">{r.faceAnalysis.summary}</span></div>
                                {r.faceAnalysis.recommendation && <div className="bg-white rounded-lg p-2 border border-rose-100"><span className="text-xs text-rose-500 font-bold">개선 솔루션.</span><span className="text-sm text-slate-700 ml-1">{r.faceAnalysis.recommendation}</span></div>}
                              </div>
                            </div>
                          )}

                          {/* 3바디 균형 분석 */}
                          {r?.threeBodyAnalysis && (
                            <div className="bg-gradient-to-br from-slate-800 via-indigo-900 to-slate-800 rounded-2xl p-5 mb-3 text-white">
                              <div className="text-center mb-4">
                                <span className="text-cyan-400 text-[10px] font-bold uppercase tracking-[0.2em]">3BODY ANALYSIS</span>
                                <h4 className="text-lg font-black mt-1">3바디 균형 분석</h4>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                {[
                                  { key: 'body', icon: '🏃', title: 'BODY (신체)', data: r.threeBodyAnalysis.body, color: 'from-emerald-400 to-teal-500' },
                                  { key: 'mind', icon: '💚', title: 'ENERGY (마음)', data: r.threeBodyAnalysis.mind, color: 'from-violet-400 to-purple-500' },
                                  { key: 'brain', icon: '🧠', title: 'BRAIN (두뇌)', data: r.threeBodyAnalysis.brain, color: 'from-amber-400 to-orange-500' }
                                ].map(item => (
                                  <div key={item.key} className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
                                    <div className="text-2xl mb-1">{item.icon}</div>
                                    <div className="text-[10px] font-bold text-white/70 mb-1">{item.title}</div>
                                    <div className={`text-2xl font-black bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}>{item.data?.score || 0}점</div>
                                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2 mb-2">
                                      <div className={`h-full bg-gradient-to-r ${item.color} rounded-full`} style={{ width: `${item.data?.score || 0}%` }} />
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-relaxed">{item.data?.description || ''}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 7코드 에너지 분석 */}
                          {r?.sevenCodeAnalysis && sevenCodes.length > 0 && (
                            <div className="bg-gradient-to-br from-slate-800 to-indigo-900 rounded-2xl p-5 mb-3 text-white">
                              <div className="text-center mb-4">
                                <span className="text-amber-400 text-[10px] font-bold uppercase tracking-[0.2em]">7CODE ENERGY</span>
                                <h4 className="text-lg font-black mt-1">7코드 에너지 분석</h4>
                              </div>
                              <div className="space-y-2">
                                {sevenCodes.map((code, idx) => {
                                  const cc = codeColors[idx];
                                  return (
                                    <div key={idx} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cc.color} flex items-center justify-center font-black text-white text-sm shrink-0`}>{idx + 1}</div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-sm text-white">{code?.label || cc.label}</span>
                                            <span className="text-sm font-black text-white">{code?.score || 0}점</span>
                                          </div>
                                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
                                            <div className={`h-full bg-gradient-to-r ${cc.color} rounded-full`} style={{ width: `${code?.score || 0}%` }} />
                                          </div>
                                          <p className="text-[11px] text-slate-300 leading-snug">{code?.description || ''}</p>
                                          {code?.evidence && code.evidence.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {code.evidence.map((ev: string, eidx: number) => (
                                                <span key={eidx} className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-emerald-200 border border-emerald-500/30">🔍 {ev}</span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 자세 분석 상세 */}
                          {r?.postureMetrics && r.postureMetrics.length > 0 && (
                            <div className="bg-slate-50 rounded-xl p-4 mb-3 border border-slate-200">
                              <span className="text-xs text-slate-500 font-bold">🦴 자세 분석 상세</span>
                              <div className="mt-2 space-y-1.5">
                                {r.postureMetrics.map((item: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between bg-white rounded-lg p-2 border border-slate-100">
                                    <div className="flex-1">
                                      <span className="text-sm font-bold text-slate-700">{item?.name}</span>
                                      <span className="text-xs text-slate-500 ml-2">{item?.description}</span>
                                    </div>
                                    <span className={`px-2 py-1 rounded-lg text-xs font-black ${
                                      item?.status === 'Good' ? 'bg-emerald-100 text-emerald-700' :
                                      item?.status === 'Fair' ? 'bg-amber-100 text-amber-700' :
                                      'bg-rose-100 text-rose-700'
                                    }`}>{item?.score}점</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 기능적 수행 능력 */}
                          {r?.strengthMetrics && r.strengthMetrics.length > 0 && (
                            <div className="bg-indigo-50/50 rounded-xl p-4 mb-3 border border-indigo-100">
                              <span className="text-xs text-indigo-500 font-bold">💪 기능적 수행 능력</span>
                              <div className="mt-2 space-y-1.5">
                                {r.strengthMetrics.map((item: any, i: number) => (
                                  <div key={i} className="bg-white rounded-lg p-2 border border-indigo-100">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-sm font-bold text-indigo-900">{item?.exercise}</span>
                                      <div className="text-right">
                                        <span className="text-xs font-black text-indigo-600">자세 {item?.formScore}점</span>
                                        {item?.reps > 0 && <span className="text-xs font-bold text-indigo-500 ml-2">{item?.reps}회</span>}
                                      </div>
                                    </div>
                                    <p className="text-xs text-indigo-800">{item?.performance}</p>
                                    <p className="text-xs text-indigo-600 font-medium mt-1">💡 {item?.recommendation}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 3바디 솔루션 가이드 */}
                          {r?.recommendations && (
                            <div className="bg-teal-50 rounded-xl p-4 mb-3 border border-teal-200">
                              <span className="text-xs text-teal-600 font-bold">🌿 3바디 통합 솔루션 가이드</span>
                              <div className="mt-2 grid grid-cols-3 gap-2">
                                <div className="bg-white rounded-lg p-3 border border-emerald-100">
                                  <div className="text-[10px] font-bold text-emerald-600 mb-1">🏃 몸(Body)</div>
                                  <p className="text-xs text-slate-700 leading-relaxed">{r.recommendations.gymnastics}</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-violet-100">
                                  <div className="text-[10px] font-bold text-violet-600 mb-1">💚 마음(Mind)</div>
                                  <p className="text-xs text-slate-700 leading-relaxed">{r.recommendations.meditation}</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-amber-100">
                                  <div className="text-[10px] font-bold text-amber-600 mb-1">🧠 뇌(Brain)</div>
                                  <p className="text-xs text-slate-700 leading-relaxed">{r.recommendations.brainTraining}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 맞춤 프로그램 추천 */}
                          {r?.programRecommendation && (
                            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 mb-3 text-white">
                              <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">RECOMMENDED PROGRAM</span>
                              <div className="text-xl font-black mt-1">{r.programRecommendation.recommended}</div>
                              <p className="text-sm text-indigo-100 mt-2 leading-relaxed">{r.programRecommendation.reason}</p>
                              <div className="bg-white/10 rounded-lg p-2 mt-2 text-sm font-bold text-white">{r.programRecommendation.duration}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Events Tab */}
            {activeTab === 'events' && (() => {
              if (eventsLoading) {
                return (
                  <div className="text-center py-20">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500 font-bold">합동 행사 데이터를 불러오는 중입니다.</p>
                  </div>
                );
              }

              return (
                <div className="h-full flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">🤝 본사 합동 행사(이벤트) 관리</h2>
                      <p className="text-xs text-slate-400">전국 지점의 합동 행사 코드 현황 (총 {events.length}개)</p>
                    </div>
                    <button 
                      onClick={async () => {
                        setEventsLoading(true);
                        try {
                          const evs = await fetchAllEvents();
                          setEvents(evs);
                        } finally { setEventsLoading(false); }
                      }} 
                      className="px-4 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 text-sm"
                    >
                      🔄 새로고침
                    </button>
                  </div>

                  {/* Table */}
                  <div className="flex-1 overflow-auto border rounded-2xl">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="p-3 text-left font-bold text-slate-600">행사 코드</th>
                          <th className="p-3 text-left font-bold text-slate-600">주관 지점</th>
                          <th className="p-3 text-center font-bold text-slate-600">개설 일시</th>
                          <th className="p-3 text-center font-bold text-slate-600">누적 측정 인원</th>
                          <th className="p-3 text-center font-bold text-slate-600">상태</th>
                          <th className="p-3 text-center font-bold text-slate-600">액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map(ev => {
                          const memberCount = cloudMembers.filter(m => m.eventCode === ev.eventCode).length;
                          const createdDate = ev.createdAt ? new Date(ev.createdAt).toLocaleString('ko-KR') : '-';
                          return (
                            <tr key={ev.id} className="border-t hover:bg-indigo-50/30 transition-colors">
                              <td className="p-3 font-mono font-bold text-indigo-700">{ev.eventCode}</td>
                              <td className="p-3 font-bold text-slate-700">{ev.branchName || '알 수 없음'}</td>
                              <td className="p-3 text-center text-slate-500">{createdDate}</td>
                              <td className="p-3 text-center">
                                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-black rounded-full text-xs">
                                  {memberCount}명
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  ev.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {ev.status === 'active' ? '진행중' : '종료'}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <button 
                                  onClick={() => {
                                    setMemberFilterEventCode(ev.eventCode);
                                    setActiveTab('members');
                                    if (cloudMembers.length === 0) {
                                      setMembersLoading(true);
                                      fetchAllMembers().then(m => { setCloudMembers(m); setMembersLoading(false); }).catch(() => setMembersLoading(false));
                                    }
                                  }}
                                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs font-bold shadow-sm transition-colors"
                                >
                                  참여 회원 보기
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {events.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">등록된 합동 행사 코드가 없습니다.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {activeTab === 'feedbacks' && (() => {
              return renderFeedbacksTab();
            })()}

            {/* Errors Tab */}
            {activeTab === 'errors' && (
              <AdminErrorMonitor branches={branches} regions={regions} />
            )}

            {/* Settings Tab - Master Only */}
            {activeTab === 'settings' && currentAdmin?.role === 'master' && (
              <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-lg font-bold mb-6">시스템 환경 설정</h2>
                  
                  <div className="mb-6 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-2">🖥️ PC 버전 배포 승인 코드</h3>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      새 지점에서 PC 버전 프로그램 설치 시 이 코드를 입력하면 중앙 관리자의 승인 클릭 없이 
                      지정된 할당량(Quota) 한도 내에서 즉시 라이센스가 승인됩니다.<br/>
                      (배포가 끝난 후에는 코드를 지워서 보안을 유지하세요.)
                    </p>
                    
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        className="flex-1 p-3 border rounded-xl"
                        placeholder="예: BTCOPEN2026"
                        value={settings.autoApproveCode || ''}
                        onChange={e => setSettings({ ...settings, autoApproveCode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-6 p-6 bg-fuchsia-50 rounded-2xl border border-fuchsia-200">
                    <h3 className="font-bold text-fuchsia-800 mb-2">📱 Online LITE 버전 배포 승인 코드</h3>
                    <p className="text-xs text-fuchsia-600 mb-4 leading-relaxed">
                      야외 행사용 Online Lite 버전 전용 승인 코드입니다.<br/>
                      PC 코드와 완전히 분리되어 PC 코드로는 LITE 등록이 불가합니다.<br/>
                      <strong>비워두면 LITE 신규 등록이 차단됩니다.</strong>
                    </p>
                    
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        className="flex-1 p-3 border border-fuchsia-200 rounded-xl bg-white"
                        placeholder="예: BTCLITE2026 (비워두면 PC 코드 공용)"
                        value={settings.liteAutoApproveCode || ''}
                        onChange={e => setSettings({ ...settings, liteAutoApproveCode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-6 p-6 bg-violet-50 rounded-2xl border border-violet-200">
                    <h3 className="font-bold text-violet-800 mb-2">🎓 Online LITE 버전 임시 배포 승인 코드</h3>
                    <p className="text-xs text-violet-600 mb-4 leading-relaxed">
                      교육 및 테스트용 임시 코드입니다. 만료시간이 지나거나 이 필드를 비워두면 임시 코드로 인증받은 기기들의 사용 권한이 자동으로 즉시 소멸 및 차단됩니다.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-violet-500 mb-1">임시 승인 코드</label>
                        <input
                          type="text"
                          className="w-full p-3 border border-violet-200 rounded-xl bg-white focus:border-violet-400 outline-none"
                          placeholder="예: TEMPLITE2026"
                          value={settings.tempLiteAutoApproveCode || ''}
                          onChange={e => setSettings({ ...settings, tempLiteAutoApproveCode: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-violet-500 mb-1">만료 일시</label>
                        <input
                          type="datetime-local"
                          className="w-full p-3 border border-violet-200 rounded-xl bg-white focus:border-violet-400 outline-none"
                          value={settings.tempLiteCodeExpiredAt || ''}
                          onChange={e => setSettings({ ...settings, tempLiteCodeExpiredAt: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    className="w-full px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                  >💾 승인 코드 저장</button>
                </div>

                <div>
                  <h2 className="text-lg font-bold mb-6">관리자 계정 관리</h2>
                  <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm mb-6">
                    <h3 className="font-bold text-slate-800 mb-4">새 관리자 추가</h3>
                    <form onSubmit={handleAddAdmin} className="space-y-3">
                      <div className="flex gap-3">
                        <input type="text" placeholder="아이디" className="flex-1 p-3 border rounded-xl" value={newAdmin.id} onChange={e => setNewAdmin({...newAdmin, id: e.target.value})} />
                        <input type="text" placeholder="이름 (직급)" className="flex-1 p-3 border rounded-xl" value={newAdmin.name} onChange={e => setNewAdmin({...newAdmin, name: e.target.value})} />
                      </div>
                      <div className="flex gap-3">
                        <input type="password" placeholder="비밀번호" className="flex-1 p-3 border rounded-xl" value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} />
                        <select className="p-3 border rounded-xl bg-white" value={newAdmin.role} onChange={e => setNewAdmin({...newAdmin, role: e.target.value as 'manager'|'master'})}>
                          <option value="manager">일반 관리자</option>
                          <option value="master">마스터 관리자</option>
                        </select>
                        <button type="submit" className="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl">추가</button>
                      </div>
                    </form>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-bold">
                        <tr>
                          <th className="p-4">아이디</th>
                          <th className="p-4">이름</th>
                          <th className="p-4">권한</th>
                          <th className="p-4 text-right">삭제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map(user => (
                          <tr key={user.id} className="border-t border-slate-100">
                            <td className="p-4 font-mono font-bold text-slate-700">{user.id}</td>
                            <td className="p-4">{user.name}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 text-xs font-bold rounded-md ${user.role === 'master' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                {user.role.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              {user.id !== 'admin' && user.id !== currentAdmin?.id && (
                                <button onClick={() => handleDeleteAdmin(user.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg">
                                  <i className="fas fa-trash-alt"></i>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
