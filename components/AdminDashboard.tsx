import React, { useState, useEffect } from 'react';
import { 
  getRegions, getBranches, getAllDevices, updateDeviceStatus, deleteDevice,
  saveBranch, saveRegion, deleteBranch, deleteRegion, getSystemSettings, updateSystemSettings,
  adminLogin, getAdminUsers, saveAdminUser, deleteAdminUser, changeAdminPassword, AdminUser,
  Region, Branch, DeviceLicense 
} from '../services/firebaseAuthService';
import { fetchAllMembers, fetchMembersFromCloud, deleteMemberFromCloud } from '../services/cloudSyncService';
import { MemberRecord } from '../types';
import { getDashboardStats } from '../services/statsService';
import { updateDailyLimit, getUsageStatus, UsageStatus } from '../services/usageLimitService';
import * as xlsx from 'xlsx';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { AdminErrorMonitor } from './AdminErrorMonitor';

interface AdminDashboardProps {
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'branches' | 'members' | 'errors' | 'settings'>('overview');
  
  // Data State
  const [regions, setRegions] = useState<Region[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [devices, setDevices] = useState<DeviceLicense[]>([]);
  const [settings, setSettings] = useState({ autoApproveCode: '', liteAutoApproveCode: '' });
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

  // 비밀번호 변경 상태
  const [pwChange, setPwChange] = useState({ current: '', new: '', confirm: '' });
  const [pwChangeLoading, setPwChangeLoading] = useState(false);

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
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSubTab, setMemberSubTab] = useState<'analyzed' | 'pending'>('analyzed');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [r, b, d, s, au, dashStats] = await Promise.all([
        getRegions(), getBranches(), getAllDevices(), getSystemSettings(), getAdminUsers(), getDashboardStats()
      ]);
      setRegions(r);
      setBranches(b);
      setDevices(d);
      setSettings((s as any) || { autoApproveCode: '' });
      setAdminUsers(au);
      setStats(dashStats);

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdmin) return;
    if (pwChange.new !== pwChange.confirm) {
      alert('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (pwChange.new.length < 6) {
      alert('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setPwChangeLoading(true);
    try {
      const result = await changeAdminPassword(currentAdmin.id, pwChange.current, pwChange.new);
      if (result.success) {
        alert('비밀번호가 성공적으로 변경되었습니다.');
        setPwChange({ current: '', new: '', confirm: '' });
      } else {
        alert(result.error || '비밀번호 변경에 실패했습니다.');
      }
    } catch (err) {
      alert('비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setPwChangeLoading(false);
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
      await updateSystemSettings(settings.autoApproveCode, settings.liteAutoApproveCode);
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
        <button onClick={() => { setActiveTab('members'); if (cloudMembers.length === 0) { setMembersLoading(true); fetchAllMembers().then(m => { setCloudMembers(m); setMembersLoading(false); }).catch(() => setMembersLoading(false)); } }} className={`px-6 py-3 font-bold rounded-t-xl transition-colors ${activeTab === 'members' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <i className="fas fa-users mr-2"></i>회원관리
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
              // 1. 오늘의 점검 현황 계산
              const todayActiveBranches = branches.filter(b => (branchUsages[b.id]?.kfaceUsed || 0) + (branchUsages[b.id]?.ktarotUsed || 0) > 0);
              const todayActiveRegionsCount = new Set(todayActiveBranches.map(b => b.regionId)).size;
              const todayTestedCount = todayActiveBranches.reduce((sum, b) => sum + (branchUsages[b.id]?.kfaceUsed || 0) + (branchUsages[b.id]?.ktarotUsed || 0), 0);

              // 2. 지역별 설치 완료 지점 현황 계산
              const installedByRegion = regions.map(r => {
                const branchesInRegion = branches.filter(b => b.regionId === r.id);
                const installedCount = branchesInRegion.filter(b => devices.some(d => d.branchId === b.id && d.status === 'active')).length;
                return { regionName: r.name, total: branchesInRegion.length, installed: installedCount };
              }).sort((a, b) => b.installed - a.installed);

              return (
                <div className="h-full flex flex-col gap-6">
                  {/* Today's Briefing */}
                  <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-md flex flex-col md:flex-row items-center justify-between gap-6 border-l-4 border-l-indigo-500">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-2xl shrink-0">
                        <i className="fas fa-bolt"></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800">오늘의 실시간 점검 브리핑</h3>
                        <p className="text-sm text-slate-500 mt-1">현재 전국 지점에서 수행 중인 AI 측정 현황입니다.</p>
                      </div>
                    </div>
                    <div className="flex gap-4 md:gap-8 w-full md:w-auto justify-around bg-slate-50 md:bg-transparent p-4 md:p-0 rounded-xl">
                      <div className="text-center">
                        <div className="text-xs font-bold text-slate-500 mb-1">활동 지역</div>
                        <div className="text-3xl font-black text-indigo-600">{todayActiveRegionsCount}<span className="text-sm font-bold text-slate-400 ml-1">곳</span></div>
                      </div>
                      <div className="w-px h-10 bg-slate-200 hidden md:block mt-2"></div>
                      <div className="text-center">
                        <div className="text-xs font-bold text-slate-500 mb-1">활동 지점</div>
                        <div className="text-3xl font-black text-blue-600">{todayActiveBranches.length}<span className="text-sm font-bold text-slate-400 ml-1">개</span></div>
                      </div>
                      <div className="w-px h-10 bg-slate-200 hidden md:block mt-2"></div>
                      <div className="text-center">
                        <div className="text-xs font-bold text-slate-500 mb-1">오늘 총 점검자</div>
                        <div className="text-3xl font-black text-emerald-600">{todayTestedCount}<span className="text-sm font-bold text-slate-400 ml-1">명</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xl"><i className="fas fa-building"></i></div>
                      <div>
                        <div className="text-slate-500 text-xs font-bold mb-1">총 등록 지점</div>
                        <div className="text-2xl font-black text-slate-800">{branches.length}<span className="text-sm font-normal text-slate-500 ml-1">곳</span></div>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 bg-cyan-100 text-cyan-600 rounded-full flex items-center justify-center text-xl"><i className="fas fa-desktop"></i></div>
                      <div>
                        <div className="text-slate-500 text-xs font-bold mb-1">설치된 총 PC</div>
                        <div className="text-2xl font-black text-slate-800">{devices.length}<span className="text-sm font-normal text-slate-500 ml-1">대</span></div>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-xl"><i className="fas fa-clipboard-check"></i></div>
                      <div>
                        <div className="text-slate-500 text-xs font-bold mb-1">누적 검사 건수</div>
                        <div className="text-2xl font-black text-slate-800">{stats.dailyStats.reduce((sum, s) => sum + s.count, 0)}<span className="text-sm font-normal text-slate-500 ml-1">건</span></div>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xl"><i className="fas fa-calendar-day"></i></div>
                      <div>
                        <div className="text-slate-500 text-xs font-bold mb-1">오늘 DB 저장 건수</div>
                        <div className="text-2xl font-black text-slate-800">{stats.dailyStats.length > 0 ? stats.dailyStats[stats.dailyStats.length - 1].count : 0}<span className="text-sm font-normal text-slate-500 ml-1">건</span></div>
                      </div>
                    </div>
                  </div>

                  {/* 지역별 설치 현황 */}
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

                  {/* 운영 인사이트 섹션 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 지역별 오늘 활동량 비교 */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="text-lg font-bold text-slate-800 mb-4"><i className="fas fa-chart-bar text-blue-500 mr-2"></i>지역별 오늘 점검 현황</h3>
                      <div className="space-y-2 max-h-[320px] overflow-y-auto">
                        {(() => {
                          const regionTodayStats = regions.map(r => {
                            const rBranches = branches.filter(b => b.regionId === r.id);
                            const todayCount = rBranches.reduce((sum, b) => sum + (branchUsages[b.id]?.kfaceUsed || 0) + (branchUsages[b.id]?.ktarotUsed || 0), 0);
                            const cumCount = rBranches.reduce((sum, b) => {
                              const bStat = stats.branchStats.find(s => s.branchId === b.id);
                              return sum + (bStat?.count || 0);
                            }, 0);
                            return { name: r.name, todayCount, cumCount, branchCount: rBranches.length };
                          }).filter(r => r.branchCount > 0).sort((a, b) => b.todayCount - a.todayCount);
                          const maxToday = Math.max(...regionTodayStats.map(r => r.todayCount), 1);
                          return regionTodayStats.map(r => (
                            <div key={r.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                              <div className="w-20 text-sm font-bold text-slate-700 truncate shrink-0" title={r.name}>{r.name}</div>
                              <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-5 rounded-full flex items-center justify-end pr-2 transition-all duration-700" style={{ width: `${Math.max((r.todayCount / maxToday) * 100, r.todayCount > 0 ? 15 : 0)}%` }}>
                                  {r.todayCount > 0 && <span className="text-[10px] font-bold text-white">{r.todayCount}</span>}
                                </div>
                              </div>
                              <div className="text-xs text-slate-400 w-16 text-right shrink-0">누적 {r.cumCount}</div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* 관리 주의 지점 (설치완료 but 미사용) */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="text-lg font-bold text-slate-800 mb-4"><i className="fas fa-exclamation-circle text-amber-500 mr-2"></i>관리 주의 지점</h3>
                      <div className="space-y-1 max-h-[320px] overflow-y-auto">
                        {(() => {
                          // 기기가 active이지만 오늘 사용량 0인 지점
                          const installedButIdle = branches.filter(b => {
                            const hasActive = devices.some(d => d.branchId === b.id && d.status === 'active');
                            const todayUse = (branchUsages[b.id]?.kfaceUsed || 0) + (branchUsages[b.id]?.ktarotUsed || 0);
                            return hasActive && todayUse === 0;
                          });
                          // 누적 사용량이 0인 지점 (설치만 해두고 한 번도 안 쓴 곳)
                          const neverUsed = installedButIdle.filter(b => {
                            const bStat = stats.branchStats.find(s => s.branchId === b.id);
                            return !bStat || bStat.count === 0;
                          });
                          const idleOnly = installedButIdle.filter(b => {
                            const bStat = stats.branchStats.find(s => s.branchId === b.id);
                            return bStat && bStat.count > 0;
                          });
                          return (
                            <>
                              {neverUsed.length > 0 && (
                                <div className="mb-3">
                                  <div className="text-xs font-bold text-rose-600 mb-2 flex items-center gap-1">
                                    <i className="fas fa-ban"></i> 설치 후 미사용 ({neverUsed.length}곳)
                                  </div>
                                  {neverUsed.map(b => (
                                    <div key={b.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-rose-50/50 mb-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-rose-400">{regions.find(r => r.id === b.regionId)?.name}</span>
                                        <span className="text-sm font-bold text-rose-700">{b.name}</span>
                                      </div>
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 font-bold">누적 0건</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {idleOnly.length > 0 && (
                                <div>
                                  <div className="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1">
                                    <i className="fas fa-clock"></i> 오늘 미활동 ({idleOnly.length}곳)
                                  </div>
                                  {idleOnly.slice(0, 10).map(b => {
                                    const bStat = stats.branchStats.find(s => s.branchId === b.id);
                                    return (
                                      <div key={b.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-amber-50/50 mb-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-slate-400">{regions.find(r => r.id === b.regionId)?.name}</span>
                                          <span className="text-sm font-bold text-slate-600">{b.name}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400">누적 {bStat?.count || 0}건</span>
                                      </div>
                                    );
                                  })}
                                  {idleOnly.length > 10 && <div className="text-xs text-slate-400 text-center mt-2">... 외 {idleOnly.length - 10}곳</div>}
                                </div>
                              )}
                              {installedButIdle.length === 0 && (
                                <div className="text-center py-8 text-slate-400">
                                  <i className="fas fa-check-circle text-3xl text-emerald-400 mb-3"></i>
                                  <p className="font-bold">모든 지점이 오늘 활동 중입니다! 🎉</p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* 지점별 누적 사용량 전체 테이블 */}
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
              const parseVersion = (v: string | undefined): number[] => {
                if (!v || v === '-' || v === 'unknown') return [0, 0, 0];
                return v.split('.').map(n => parseInt(n, 10) || 0);
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

              // 최신 버전 계산
              const allVersions = devices.map(d => d.appVersion).filter(v => v && v !== '-' && v !== 'unknown') as string[];
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
                  if (!bName.includes(q) && !rName.includes(q) && !adminName.includes(q) && !d.id.toLowerCase().includes(q)) {
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
                        {branches.filter(b => b.regionId === deviceFilterRegion).sort((a,b)=>a.name.localeCompare(b.name, 'ko')).map(b => (
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
                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{d.id.substring(0, 12)}...</td>
                            <td className="px-4 py-3 font-bold text-slate-700">{d.adminName || '-'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{d.contact || '-'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}</td>
                            <td className="px-4 py-3 font-mono text-xs font-bold">
                              {latestVersion && d.appVersion && d.appVersion !== 'unknown' && compareVersions(d.appVersion, latestVersion) < 0 ? (
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
                              }`}>{d.status.toUpperCase()}</span>
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
                if (memberSearch && !name.includes(memberSearch)) return false;
                return true;
              });

              const handleDeleteMember = async (mid: string) => {
                if (!confirm('정말 이 회원을 삭제하시겠습니까? 클라우드에서 영구 삭제됩니다.')) return;
                const ok = await deleteMemberFromCloud(mid);
                if (ok) setCloudMembers(prev => prev.filter(m => m.id !== mid));
                else alert('삭제 실패');
              };

              const handleExportExcel = () => {
                const rows = filteredMembers.map(m => {
                  const r = m.report;
                  return {
                    '이름': m.name || r?.userInfo?.name || '-',
                    '나이': r?.userInfo?.age || '-',
                    '성별': r?.userInfo?.gender === 'male' ? '남' : r?.userInfo?.gender === 'female' ? '여' : '-',
                    '지역': (m as any).regionId || '-',
                    '지점': (m as any).branchId || '-',
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
              };

              const handleRefresh = async () => {
                setMembersLoading(true);
                try {
                  const m = await fetchAllMembers();
                  setCloudMembers(m);
                } finally { setMembersLoading(false); }
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
                  <div className="flex gap-3 flex-wrap">
                    <select value={memberFilterRegion} onChange={e => { setMemberFilterRegion(e.target.value); setMemberFilterBranch('all'); }} className="px-3 py-2 border rounded-xl text-sm">
                      <option value="all">전체 지역</option>
                      {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <select value={memberFilterBranch} onChange={e => setMemberFilterBranch(e.target.value)} className="px-3 py-2 border rounded-xl text-sm">
                      <option value="all">전체 지점</option>
                      {branches.filter(b => memberFilterRegion === 'all' || b.regionId === memberFilterRegion).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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
                            <th className="p-3 text-center font-bold text-slate-600">나이</th>
                            <th className="p-3 text-center font-bold text-slate-600">성별</th>
                            <th className="p-3 text-left font-bold text-slate-600">지점</th>
                            <th className="p-3 text-center font-bold text-slate-600">측정일</th>
                            <th className="p-3 text-center font-bold text-slate-600">신체나이</th>
                            <th className="p-3 text-center font-bold text-slate-600">뇌나이</th>
                            <th className="p-3 text-center font-bold text-slate-600">종합점수</th>
                            <th className="p-3 text-center font-bold text-slate-600">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMembers.map(m => {
                            const r = m.report;
                            const branchName = branches.find(b => b.id === (m as any).branchId)?.name || (m as any).branchId || '-';
                            return (
                              <tr key={m.id} className="border-t hover:bg-indigo-50/50 cursor-pointer transition-colors" onClick={() => setSelectedMember(m)}>
                                <td className="p-3 font-bold text-slate-800">{m.name || r?.userInfo?.name || '-'}</td>
                                <td className="p-3 text-center">{r?.userInfo?.age || '-'}</td>
                                <td className="p-3 text-center">{r?.userInfo?.gender === 'male' ? '남' : r?.userInfo?.gender === 'female' ? '여' : '-'}</td>
                                <td className="p-3 text-slate-600">{branchName}</td>
                                <td className="p-3 text-center text-slate-500">{m.lastTestDate ? new Date(m.lastTestDate).toLocaleDateString() : '-'}</td>
                                <td className="p-3 text-center font-black text-indigo-600">{r?.physicalAge || '-'}</td>
                                <td className="p-3 text-center font-black text-amber-500">{r?.brainAge || '-'}</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-1 rounded-lg text-xs font-black ${(r?.overallScore || 0) >= 70 ? 'bg-emerald-100 text-emerald-700' : (r?.overallScore || 0) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{r?.overallScore || '-'}점</span>
                                </td>
                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => handleDeleteMember(m.id)} className="text-rose-400 hover:text-rose-600 text-xs font-bold">삭제</button>
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
                            <th className="p-3 text-center font-bold text-amber-700">나이</th>
                            <th className="p-3 text-center font-bold text-amber-700">성별</th>
                            <th className="p-3 text-left font-bold text-amber-700">지점</th>
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
                                <td className="p-3 text-center">{r?.userInfo?.age || '-'}</td>
                                <td className="p-3 text-center">{r?.userInfo?.gender === 'male' ? '남' : r?.userInfo?.gender === 'female' ? '여' : '-'}</td>
                                <td className="p-3 text-slate-600">{branchName}</td>
                                <td className="p-3 text-center text-slate-500">{m.lastTestDate ? new Date(m.lastTestDate).toLocaleDateString() : '-'}</td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 animate-pulse">⏳ 대기중</span>
                                </td>
                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => handleDeleteMember(m.id)} className="text-rose-400 hover:text-rose-600 text-xs font-bold">삭제</button>
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
                    return (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedMember(null)}>
                        <div className="bg-white rounded-3xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-800">👤 {selectedMember.name || r?.userInfo?.name}</h3>
                            <button onClick={() => setSelectedMember(null)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs text-slate-400">나이</span><div className="font-bold">{r?.userInfo?.age}세</div></div>
                            <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs text-slate-400">성별</span><div className="font-bold">{r?.userInfo?.gender === 'male' ? '남성' : '여성'}</div></div>
                            <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs text-slate-400">지점</span><div className="font-bold">{branchName}</div></div>
                            <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs text-slate-400">측정일</span><div className="font-bold">{selectedMember.lastTestDate ? new Date(selectedMember.lastTestDate).toLocaleDateString() : '-'}</div></div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 mb-4">
                            <div className="bg-indigo-50 rounded-xl p-3 text-center"><span className="text-[10px] text-indigo-400 font-bold">신체나이</span><div className="text-xl font-black text-indigo-600">{r?.physicalAge || '-'}</div></div>
                            <div className="bg-amber-50 rounded-xl p-3 text-center"><span className="text-[10px] text-amber-400 font-bold">뇌나이</span><div className="text-xl font-black text-amber-500">{r?.brainAge || '-'}</div></div>
                            <div className="bg-rose-50 rounded-xl p-3 text-center"><span className="text-[10px] text-rose-400 font-bold">얼굴나이</span><div className="text-xl font-black text-rose-500">{r?.faceAgeEstimate || '-'}</div></div>
                            <div className="bg-emerald-50 rounded-xl p-3 text-center"><span className="text-[10px] text-emerald-400 font-bold">종합점수</span><div className="text-xl font-black text-emerald-600">{r?.overallScore || '-'}</div></div>
                          </div>
                          {r?.summary && <div className="bg-slate-50 rounded-xl p-4 mb-3"><span className="text-xs text-slate-400 font-bold">종합 평가</span><p className="text-sm text-slate-700 mt-1 leading-relaxed">{r.summary}</p></div>}
                          {r?.bodyTypeAnalysis && <div className="bg-indigo-50 rounded-xl p-4 mb-3"><span className="text-xs text-indigo-400 font-bold">체형 분석</span><p className="text-sm text-indigo-800 mt-1">{r.bodyTypeAnalysis}</p></div>}
                          {r?.brainTestEvaluation && <div className="bg-amber-50 rounded-xl p-4 mb-3"><span className="text-xs text-amber-400 font-bold">뇌 건강 분석</span><p className="text-sm text-amber-800 mt-1">{r.brainTestEvaluation}</p></div>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
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
                    <h3 className="font-bold text-slate-800 mb-2"><i className="fas fa-desktop text-blue-500 mr-2"></i>PC버전 인증 암호</h3>
                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                      PC 버전 프로그램 설치 시 이 코드를 입력하면 자동 승인됩니다.
                    </p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="flex-1 p-3 border rounded-xl"
                        placeholder="예: BTCPC2026"
                        value={settings.autoApproveCode || ''}
                        onChange={e => setSettings({ ...settings, autoApproveCode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-6 p-6 bg-emerald-50 rounded-2xl border border-emerald-200">
                    <h3 className="font-bold text-emerald-800 mb-2"><i className="fas fa-mobile-alt text-emerald-500 mr-2"></i>라이트버전 인증 암호</h3>
                    <p className="text-xs text-emerald-600 mb-3 leading-relaxed">
                      온라인 라이트 버전 설치 시 이 코드를 입력하면 자동 승인됩니다.
                    </p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="flex-1 p-3 border border-emerald-200 rounded-xl bg-white"
                        placeholder="예: BTCLITE2026"
                        value={settings.liteAutoApproveCode || ''}
                        onChange={e => setSettings({ ...settings, liteAutoApproveCode: e.target.value })}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveSettings}
                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                  ><i className="fas fa-save mr-2"></i>인증 암호 저장</button>
                </div>

                <div>
                  <h2 className="text-lg font-bold mb-6">관리자 계정 관리</h2>

                  {/* 비밀번호 변경 섹션 */}
                  <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm mb-6">
                    <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                      <i className="fas fa-key"></i> 내 비밀번호 변경
                    </h3>
                    <p className="text-xs text-amber-600 mb-4">보안을 위해 주기적으로 비밀번호를 변경해주세요.</p>
                    <form onSubmit={handleChangePassword} className="space-y-3">
                      <input
                        type="password"
                        placeholder="현재 비밀번호"
                        className="w-full p-3 border border-amber-200 rounded-xl bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                        value={pwChange.current}
                        onChange={e => setPwChange({...pwChange, current: e.target.value})}
                        required
                      />
                      <div className="flex gap-3">
                        <input
                          type="password"
                          placeholder="새 비밀번호 (6자 이상)"
                          className="flex-1 p-3 border border-amber-200 rounded-xl bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                          value={pwChange.new}
                          onChange={e => setPwChange({...pwChange, new: e.target.value})}
                          minLength={6}
                          required
                        />
                        <input
                          type="password"
                          placeholder="새 비밀번호 확인"
                          className="flex-1 p-3 border border-amber-200 rounded-xl bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                          value={pwChange.confirm}
                          onChange={e => setPwChange({...pwChange, confirm: e.target.value})}
                          minLength={6}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={pwChangeLoading || !pwChange.current || !pwChange.new || !pwChange.confirm}
                        className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors"
                      >
                        {pwChangeLoading ? '변경 중...' : '비밀번호 변경'}
                      </button>
                    </form>
                  </div>
                  <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm mb-6">
                    <h3 className="font-bold text-slate-800 mb-4">새 관리자 추가</h3>
                    <form onSubmit={handleAddAdmin} className="space-y-3">
                      <div className="flex gap-3">
                        <input type="text" placeholder="아이디" className="flex-1 p-3 border rounded-xl" value={newAdmin.id} onChange={e => setNewAdmin({...newAdmin, id: e.target.value})} />
                        <input type="text" placeholder="이름 (직급)" className="flex-1 p-3 border rounded-xl" value={newAdmin.name} onChange={e => setNewAdmin({...newAdmin, name: e.target.value})} />
                      </div>
                      <div className="flex gap-3">
                        <input type="text" placeholder="비밀번호" className="flex-1 p-3 border rounded-xl" value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} />
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
