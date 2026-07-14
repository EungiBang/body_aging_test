import React, { useState, useEffect } from 'react';
import { getRegions, getBranches, requestDeviceRegistration, Region, Branch } from '../services/liteBranchAuth';
import pkg from '../package.json';

interface BranchAuthProps {
  onVerified: () => void;
}

const BranchAuthScreen: React.FC<BranchAuthProps> = ({ onVerified }) => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<Branch[]>([]);
  
  const [formData, setFormData] = useState({
    regionId: '',
    branchId: '',
    adminName: '',
    contact: '',
    authCode: ''
  });
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [rData, bData] = await Promise.all([getRegions(), getBranches()]);
        setRegions(rData);
        setBranches(bData);
      } catch (err) {
        console.error('Failed to load regions/branches', err);
        setError('서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
      } finally {
        setInitLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (formData.regionId) {
      setFilteredBranches(branches.filter(b => b.regionId === formData.regionId));
      setFormData(prev => ({ ...prev, branchId: '' })); // Reset branch selection
    } else {
      setFilteredBranches([]);
    }
  }, [formData.regionId, branches]);

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 3 && val.length <= 7) {
      val = `${val.slice(0, 3)}-${val.slice(3)}`;
    } else if (val.length > 7) {
      val = `${val.slice(0, 3)}-${val.slice(3, 7)}-${val.slice(7, 11)}`;
    }
    setFormData(prev => ({ ...prev, contact: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.regionId || !formData.branchId || !formData.adminName || !formData.contact || !formData.authCode) {
      setError('모든 항목을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. 기기 하드웨어 고유 번호(UUID) 가져오기
      let hardwareId = 'unknown';
      let appVersion = 'unknown';
      if (window.electronAPI && window.electronAPI.getHardwareId) {
        hardwareId = await window.electronAPI.getHardwareId();
      }
      if (window.electronAPI && window.electronAPI.getAppVersion) {
        appVersion = await window.electronAPI.getAppVersion();
      }

      const result = await requestDeviceRegistration(
        hardwareId, 
        formData.branchId, 
        formData.adminName, 
        formData.contact, 
        formData.authCode,
        appVersion
      );

      if (result.success) {
        // 인증 성공 후, 앱 리로드하여 새로 상태 체크
        window.location.reload();
      } else {
        setError(result.error || '인증에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(`오류가 발생했습니다: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (initLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900">
        <div className="text-indigo-400 font-bold flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          서버와 연결 중입니다...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-indigo-950/20 to-slate-900">
      <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-500"></div>
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-800 border-2 border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <i className="fas fa-shield-alt text-2xl"></i>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">BTC 3바디 7코드 AI건강센터</h2>
          <p className="text-indigo-300 mt-2 text-sm font-medium">v{pkg.version} 기기 인증 및 지점 등록</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">지역 선택</label>
            <select 
              className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-600/50 text-white rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              value={formData.regionId} 
              onChange={e => setFormData({...formData, regionId: e.target.value})}
            >
              <option value="" className="bg-slate-800 text-slate-400">지역을 선택하세요</option>
              {regions.map(r => (
                <option key={r.id} value={r.id} className="bg-slate-800">{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">지점 선택</label>
            <select 
              className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-600/50 text-white rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-30 transition-all"
              value={formData.branchId} 
              onChange={e => setFormData({...formData, branchId: e.target.value})}
              disabled={!formData.regionId}
            >
              <option value="" className="bg-slate-800 text-slate-400">지점을 선택하세요</option>
              {filteredBranches.map(b => (
                <option key={b.id} value={b.id} className="bg-slate-800">{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">책임 관리자 (원장님)</label>
            <input type="text" className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-600/50 text-white rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600" placeholder="예: 홍길동" value={formData.adminName} onChange={e => setFormData({...formData, adminName: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">연락처</label>
            <input type="text" className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-600/50 text-white rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600" placeholder="예: 010-0000-0000" value={formData.contact} onChange={handleContactChange} maxLength={13} />
          </div>
          <div>
            <label className="block text-xs font-bold text-indigo-400 mb-1.5 ml-1">시스템 권한 배포 코드</label>
            <input type="password" className="w-full px-4 py-3.5 bg-indigo-950/30 border border-indigo-500/30 text-white rounded-xl focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none font-bold tracking-widest transition-all placeholder:text-indigo-900/50" placeholder="보안 코드 입력" value={formData.authCode} onChange={e => setFormData({...formData, authCode: e.target.value})} />
          </div>

          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold rounded-xl text-center">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading || !formData.regionId || !formData.branchId || !formData.adminName || !formData.contact || !formData.authCode}
            className="w-full mt-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold rounded-xl hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '암호화 채널 연결 중...' : '시스템 권한 요청'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BranchAuthScreen;
