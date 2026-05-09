import React, { useState, useEffect } from 'react';
import { 
  getRegions, getBranches, getAllDevices, updateDeviceStatus, deleteDevice,
  saveBranch, saveRegion, deleteBranch, deleteRegion, getSystemSettings, updateSystemSettings,
  adminLogin, getAdminUsers, saveAdminUser, deleteAdminUser, AdminUser,
  Region, Branch, DeviceLicense, getAllFeedbacks 
} from '../services/firebaseAuthService';
import { fetchAllMembers, fetchMembersFromCloud, deleteMemberFromCloud } from '../services/cloudSyncService';
import { MemberRecord } from '../types';
import { getDashboardStats } from '../services/statsService';
import { updateDailyLimit, getUsageStatus, UsageStatus } from '../services/usageLimitService';
import * as xlsx from 'xlsx';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { AdminErrorMonitor } from './AdminErrorMonitor';
import FeedbackDashboard from './FeedbackDashboard';

interface AdminDashboardProps {
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'branches' | 'members' | 'feedbacks' | 'errors' | 'settings'>('overview');
  
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

  // AI Feedbacks State
  const [allFeedbacks, setAllFeedbacks] = useState<any[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [r, b, d, s, au, dashStats, feedbacks] = await Promise.all([
        getRegions(), getBranches(), getAllDevices(), getSystemSettings(), getAdminUsers(), getDashboardStats(), getAllFeedbacks()
      ]);
      setRegions(r);
      setBranches(b);
      setDevices(d);
      setSettings((s as any) || { autoApproveCode: '', liteAutoApproveCode: '' });
      setAdminUsers(au);
      setStats(dashStats);
      setAllFeedbacks(feedbacks);

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

  // ─────────────────────────────────────────────────────────────────
  // AI 훈련 센터 탭 (Feedbacks)
  // ─────────────────────────────────────────────────────────────────
  const renderFeedbacksTab = () => {
    return <FeedbackDashboard />;
  };

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
                        type="text" 
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
                        type="text" 
                        className="flex-1 p-3 border border-fuchsia-200 rounded-xl bg-white"
                        placeholder="예: BTCLITE2026 (비워두면 PC 코드 공용)"
                        value={settings.liteAutoApproveCode || ''}
                        onChange={e => setSettings({ ...settings, liteAutoApproveCode: e.target.value })}
                      />
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
