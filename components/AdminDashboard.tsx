import React, { useState, useEffect } from 'react';
import { 
  getRegions, getBranches, getAllDevices, updateDeviceStatus, deleteDevice,
  saveBranch, saveRegion, deleteBranch, deleteRegion, getSystemSettings, updateSystemSettings,
  adminLogin, getAdminUsers, saveAdminUser, deleteAdminUser, AdminUser,
  Region, Branch, DeviceLicense 
} from '../services/firebaseAuthService';
import { fetchAllMembers, fetchMembersFromCloud, deleteMemberFromCloud } from '../services/cloudSyncService';
import { MemberRecord } from '../types';
import { getDashboardStats } from '../services/statsService';
import { updateDailyLimit, getUsageStatus, UsageStatus } from '../services/usageLimitService';
import * as xlsx from 'xlsx';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface AdminDashboardProps {
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'branches' | 'members' | 'settings'>('overview');
  
  // Data State
  const [regions, setRegions] = useState<Region[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [devices, setDevices] = useState<DeviceLicense[]>([]);
  const [settings, setSettings] = useState({ autoApproveCode: '' });
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
  const [newAdmin, setNewAdmin] = useState({ id: '', name: '', password: '', role: 'manager' as const });
  const [branchUsages, setBranchUsages] = useState<Record<string, UsageStatus>>({});

  // Branch Quota 탭 필터 상태
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // 기기 관리 탭 상태
  const [deviceFilterRegion, setDeviceFilterRegion] = useState<string>('all');
  const [deviceFilterBranch, setDeviceFilterBranch] = useState<string>('all');
  const [deviceSearchQuery, setDeviceSearchQuery] = useState<string>('');
  const [deviceSortOrder, setDeviceSortOrder] = useState<'desc' | 'asc'>('desc');
  // 회원관리 탭 상태
  const [cloudMembers, setCloudMembers] = useState<MemberRecord[]>([]);
  const [memberFilterRegion, setMemberFilterRegion] = useState<string>('all');
  const [memberFilterBranch, setMemberFilterBranch] = useState<string>('all');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [r, b, d, s, au, dashStats] = await Promise.all([
        getRegions(), getBranches(), getAllDevices(), getSystemSettings(), getAdminUsers(), getDashboardStats()
      ]);
      setRegions(r);
      setBranches(b);
      setDevices(d);
      setSettings(s || { autoApproveCode: '' });
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

  const handleStatusChange = async (deviceId: string, newStatus: 'active' | 'pending' | 'revoked') => {
    if (window.confirm(`이 기기의 상태를 '${newStatus}'(으)로 변경하시겠습니까?`)) {
      try {
        await updateDeviceStatus(deviceId, newStatus);
        setDevices(devices.map(d => d.id === deviceId ? { ...d, status: newStatus } : d));
      } catch (e) {
        alert('상태 변경 실패');
      }
    }
  };
  const handleDeleteDevice = async (deviceId: string) => {
    if (window.confirm('이 기기를 목록에서 완전히 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) {
      try {
        await deleteDevice(deviceId);
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

  const handleUpdateDailyLimit = async (branch: Branch, type: 'kface' | 'ktarot', newValue: number) => {
    if (isNaN(newValue)) return;
    
    const currentLimit = type === 'kface' ? (branch.kfaceDailyLimit ?? 0) : (branch.ktarotDailyLimit ?? 0);
    if (newValue === currentLimit) return;

    try {
      const kfaceLimit = type === 'kface' ? newValue : (branch.kfaceDailyLimit ?? 0);
      const ktarotLimit = type === 'ktarot' ? newValue : (branch.ktarotDailyLimit ?? 0);
      await updateDailyLimit(branch.id, kfaceLimit, ktarotLimit);
      
      const updated = { ...branch, kfaceDailyLimit: kfaceLimit, ktarotDailyLimit: ktarotLimit };
      setBranches(branches.map(b => b.id === branch.id ? updated : b));
      // 시각적인 방해를 줄이기 위해 alert 제거
    } catch (e) {
      alert('한도 업데이트 실패');
    }
  };

  const handleResetAllLimits = async () => {
    if (!window.confirm('모든 지점의 관상/타로 한도를 0으로 일괄 초기화하시겠습니까?')) return;
    setIsLoading(true);
    try {
      const promises = branches.map(b => updateDailyLimit(b.id, 0, 0));
      await Promise.all(promises);
      const updatedBranches = branches.map(b => ({ ...b, kfaceDailyLimit: 0, ktarotDailyLimit: 0 }));
      setBranches(updatedBranches);
      alert('모든 지점의 한도가 0으로 초기화되었습니다.');
    } catch (e) {
      alert('일괄 초기화 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSystemSettings(settings.autoApproveCode);
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
        <button onClick={() => setActiveTab('settings')} className={`px-6 py-3 font-bold rounded-t-xl transition-colors ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <i className="fas fa-cog mr-2"></i>시스템 설정
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white mx-6 mb-6 rounded-b-xl rounded-tr-xl shadow-sm p-6 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-slate-400">데이터 로딩 중...</div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="h-full flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl text-white shadow-lg">
                    <div className="text-white/80 font-bold mb-1">총 등록 지점</div>
                    <div className="text-4xl font-black">{branches.length} <span className="text-lg font-normal">곳</span></div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-6 rounded-2xl text-white shadow-lg">
                    <div className="text-white/80 font-bold mb-1">등록된 총 PC(기기)</div>
                    <div className="text-4xl font-black">{devices.length} <span className="text-lg font-normal">대</span></div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-2xl text-white shadow-lg">
                    <div className="text-white/80 font-bold mb-1">누적 검사 건수</div>
                    <div className="text-4xl font-black">
                      {stats.dailyStats.reduce((sum, s) => sum + s.count, 0)} <span className="text-lg font-normal">건</span>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-6 rounded-2xl text-white shadow-lg">
                    <div className="text-white/80 font-bold mb-1">오늘 검사 건수</div>
                    <div className="text-4xl font-black">
                      {stats.dailyStats.length > 0 ? stats.dailyStats[stats.dailyStats.length - 1].count : 0} <span className="text-lg font-normal">건</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[400px]">
                  {/* Line Chart */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-6"><i className="fas fa-calendar-alt text-indigo-500 mr-2"></i>일별 측정량 추이 (최근 14일)</h3>
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
              </div>
            )}

            {/* Devices Tab */}
            {activeTab === 'devices' && (() => {
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
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return deviceSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
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
                      
                      <div className="relative">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input 
                          type="text" 
                          placeholder="기기 ID, 지점명, 관리자 검색" 
                          className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm w-full sm:w-64 outline-none focus:border-indigo-500"
                          value={deviceSearchQuery}
                          onChange={e => setDeviceSearchQuery(e.target.value)}
                        />
                      </div>
                      <select 
                        className="px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 bg-white"
                        value={deviceSortOrder}
                        onChange={e => setDeviceSortOrder(e.target.value as 'desc' | 'asc')}
                      >
                        <option value="desc">최신 등록일순</option>
                        <option value="asc">과거 등록일순</option>
                      </select>
                    </div>
                  </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                      <tr>
                        <th className="px-4 py-3">지역</th>
                        <th className="px-4 py-3">지점</th>
                        <th className="px-4 py-3">기기 ID</th>
                        <th className="px-4 py-3">책임자</th>
                        <th className="px-4 py-3">연락처</th>
                        <th className="px-4 py-3">등록일</th>
                        <th className="px-4 py-3">버전</th>
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
                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{d.id.substring(0, 12)}...</td>
                            <td className="px-4 py-3 font-bold text-slate-700">{d.adminName || '-'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{d.contact || '-'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}</td>
                            <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600">{d.appVersion || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                d.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                d.status === 'revoked' ? 'bg-rose-100 text-rose-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>{d.status.toUpperCase()}</span>
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              {d.status !== 'active' && <button onClick={() => handleStatusChange(d.id, 'active')} className="px-3 py-1 bg-emerald-500 text-white rounded text-xs">승인</button>}
                              {d.status !== 'revoked' && <button onClick={() => handleStatusChange(d.id, 'revoked')} className="px-3 py-1 bg-rose-500 text-white rounded text-xs">사용중지(해지)</button>}
                              {d.status === 'revoked' && <button onClick={() => handleDeleteDevice(d.id)} className="px-3 py-1 bg-slate-500 hover:bg-slate-600 text-white rounded text-xs">삭제</button>}
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
                      <button 
                        onClick={handleResetAllLimits} 
                        className="px-4 py-2 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600 shadow-sm mr-2"
                      >
                        <i className="fas fa-undo-alt mr-1"></i>한도 일괄 0 처리
                      </button>
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
                          const activeCount = devices.filter(d => d.branchId === b.id && d.status === 'active').length;
                          return (
                            <div key={b.id} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
                              <div className="text-lg font-black text-slate-800 mb-2">{b.name}</div>
                              
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs text-slate-500">현재 사용 중:</span>
                                <span className={`text-sm font-bold ${activeCount > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>{activeCount}대</span>
                              </div>
                              
                              <div className="flex items-center justify-between pt-3 border-t border-slate-100 mb-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-500">최대:</span>
                                  <input 
                                    type="number" 
                                    className="w-14 p-1 border border-slate-300 rounded text-center font-bold text-sm" 
                                    defaultValue={b.allowedLicenses || 2}
                                    onBlur={(e) => handleUpdateQuota(b, parseInt(e.target.value))}
                                  />
                                  <span className="text-xs text-slate-500">대</span>
                                </div>
                                <button 
                                  onClick={() => handleDeleteBranch(b.id, b.name)}
                                  className="text-slate-300 hover:text-rose-500 text-xs p-1.5 transition-colors"
                                  title="지점 삭제"
                                >
                                  <i className="fas fa-trash-alt"></i>
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
                                      defaultValue={b.kfaceDailyLimit ?? 0}
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
                                      defaultValue={b.ktarotDailyLimit ?? 0}
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
              const filteredMembers = cloudMembers.filter(m => {
                const rpt = m.report;
                const name = m.name || rpt?.userInfo?.name || '';
                
                // [분석 대기] 상태인 미분석 회원 제외 (디폴트)
                if (name.startsWith('[분석 대기]')) return false;

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
                xlsx.writeFile(wb, `회원데이터_${new Date().toISOString().slice(0,10)}.xlsx`);
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
                      <span className="text-4xl">📭</span>
                      <span>등록된 회원이 없습니다</span>
                    </div>
                  ) : (
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

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-lg font-bold mb-6">시스템 환경 설정</h2>
                  
                  <div className="mb-6 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-2">초기 배포용 자동 승인 코드</h3>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      새 지점에서 프로그램 설치 시 이 코드를 입력하면 중앙 관리자의 승인 클릭 없이 
                      지정된 할당량(Quota) 한도 내에서 즉시 라이센스가 승인됩니다.<br/>
                      (배포가 끝난 후에는 코드를 지워서 보안을 유지하세요.)
                    </p>
                    
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="flex-1 p-3 border rounded-xl"
                        placeholder="예: BTCOPEN2026"
                        value={settings.autoApproveCode || ''}
                        onChange={e => setSettings({ ...settings, autoApproveCode: e.target.value })}
                      />
                      <button 
                        onClick={handleSaveSettings}
                        className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl"
                      >저장</button>
                    </div>
                  </div>
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
