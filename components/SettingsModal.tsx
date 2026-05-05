import React, { useState, useEffect } from 'react';
import { getActiveApiKey, setCustomApiKey, isUsingCustomKey } from '../services/geminiService';
import { getBranches } from '../services/firebaseAuthService';
import { getUsageStatus, updateDailyLimit, UsageStatus } from '../services/usageLimitService';
import { performFullBackup, getLastBackupTime, getLastBackupCount } from '../services/backupService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [usingCustom, setUsingCustom] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [branchInfo, setBranchInfo] = useState<any>(null);
  
  // 카메라 상태
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // 사용 한도 상태
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [hardwareId, setHardwareId] = useState<string>('알 수 없음');
  const [appVersion, setAppVersion] = useState<string>('알 수 없음');
  
  // 백업 상태
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [lastBackupCount, setLastBackupCount] = useState<number>(0);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupResult, setBackupResult] = useState<string | null>(null);

  // Auto Updater 상태
  const [updaterStatus, setUpdaterStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updaterVersion, setUpdaterVersion] = useState<string>('');
  const [updaterPercent, setUpdaterPercent] = useState<number>(0);
  const [updaterError, setUpdaterError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setUsingCustom(isUsingCustomKey());
      const currentKey = getActiveApiKey();
      if (isUsingCustomKey()) {
        setApiKey(currentKey);
      } else {
        setApiKey('');
      }
      setSaved(false);
      
      // Load branch info (v4 currentDevice 활용)
      const loadBranchAndUsage = async () => {
        let branch: any = null;
        
        // 1. V4 currentDevice 로컬 스토리지 확인
        const currentDeviceJson = localStorage.getItem('currentDevice');
        if (currentDeviceJson) {
          try {
            branch = JSON.parse(currentDeviceJson);
            setHardwareId(branch.id || '알 수 없음');
            
            if (window.electronAPI && window.electronAPI.getAppVersion) {
              window.electronAPI.getAppVersion().then((ver: string) => {
                setAppVersion(ver);
              });
            }
            if (window.electronAPI && window.electronAPI.getHardwareId) {
              window.electronAPI.getHardwareId().then((id: string) => {
                if (id) setHardwareId(id);
              });
            }
            
            // v4는 branchId만 있으므로, 실제 지점명(name)을 DB에서 가져와 매핑
            let actualBranchName = branch.branchId;
            try {
              const branches = await getBranches();
              const matched = branches.find(b => b.id === branch.branchId);
              if (matched) actualBranchName = matched.name;
            } catch (err) {
              console.error("Failed to fetch branch name", err);
            }

            // v4 스키마 매핑
            branch = {
              ...branch,
              branchName: actualBranchName || '알 수 없는 지점',
              adminName: branch.adminName || '알 수 없음',
              contact: branch.contact || '등록되지 않음',
              createdAt: branch.createdAt
            };
          } catch(e) {}
        }
        
        // 2. 하위 호환성 (V3 branchAuth) - v4 기기가 없을 때만
        if (!branch) {
          if (window.electronAPI) {
            branch = await window.electronAPI.loadAuthToken();
          } else {
            const local = localStorage.getItem('branchAuth');
            if (local) branch = JSON.parse(local);
          }
        }
        
        if (branch) {
          setBranchInfo(branch);
          const branchId = branch.branchId || branch.id;
          if (branchId) {
            const status = await getUsageStatus(branchId);
            setUsageStatus(status);
          }
        }
      };
      
      loadBranchAndUsage();
      
      // 카메라 목록 로드
      const fetchCameras = async () => {
        try {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
          setDevices(videoDevices);
          const savedId = localStorage.getItem('selectedCameraId');
          if (savedId && videoDevices.some(d => d.deviceId === savedId)) {
            setSelectedCameraId(savedId);
          } else if (videoDevices.length > 0) {
            setSelectedCameraId(videoDevices[0].deviceId);
          }
        } catch (err) {
          console.error("Failed to enumerate cameras in settings", err);
        }
      };
      fetchCameras();

      // 백업 정보 로드
      setLastBackup(getLastBackupTime());
      setLastBackupCount(getLastBackupCount());
      setBackupResult(null);
    }

    if (window.electronAPI && window.electronAPI.onUpdaterMessage) {
      window.electronAPI.onUpdaterMessage((msg: any) => {
        setUpdaterStatus(msg.status);
        if (msg.version) setUpdaterVersion(msg.version);
        if (msg.error) setUpdaterError(msg.error);
      });
      window.electronAPI.onUpdaterProgress((progress: any) => {
        setUpdaterStatus('downloading');
        setUpdaterPercent(Math.floor(progress.percent));
      });
      
      // 모달 열릴 때 자동 체크
      if (isOpen) {
        window.electronAPI.checkForUpdates();
      }
    }
  }, [isOpen]);


  const handleSave = () => {
    setCustomApiKey(apiKey);
    setUsingCustom(isUsingCustomKey());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setCustomApiKey('');
    setApiKey('');
    setUsingCustom(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedCameraId(deviceId);
    localStorage.setItem('selectedCameraId', deviceId);
    window.dispatchEvent(new CustomEvent('camera:change', { detail: { deviceId } }));
  };

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    setBackupResult(null);
    try {
      const result = await performFullBackup();
      setLastBackup(getLastBackupTime());
      setLastBackupCount(getLastBackupCount());
      if (result.synced > 0) {
        setBackupResult(`✅ ${result.synced}건 새로 동기화 (총 ${result.total}건)`);
      } else {
        setBackupResult(`✅ 모든 데이터가 이미 동기화 완료 (총 ${result.total}건)`);
      }
    } catch (e) {
      setBackupResult('❌ 백업 중 오류가 발생했습니다.');
    } finally {
      setIsBackingUp(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
              <i className="fas fa-cog text-lg"></i>
            </div>
            <h2 className="text-xl font-bold text-slate-800">설정</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* API Key Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2">
              <i className="fas fa-key text-amber-500 mr-2"></i>
              Gemini API 키
            </label>
            <p className="text-xs text-slate-400 mb-3">
              기본 API 키가 설정되어 있습니다. 개인 API 키를 사용하려면 아래에 입력하세요.
            </p>
            
            {/* Current status */}
            <div className={`mb-3 p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
              usingCustom 
                ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <i className={`fas ${usingCustom ? 'fa-user-edit' : 'fa-shield-alt'}`}></i>
              {usingCustom ? '커스텀 API 키 사용 중' : '기본 API 키 사용 중'}
            </div>

            {/* Input */}
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="커스텀 API 키 입력 (선택 사항)"
                className="w-full px-4 py-3 pr-12 border-2 border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-none transition-all text-sm bg-slate-50"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <i className={`fas ${showKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {usingCustom && (
              <button
                onClick={handleReset}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all text-sm"
              >
                기본 키로 복원
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!apiKey.trim() && !usingCustom}
              className={`flex-1 py-3 font-bold rounded-xl transition-all text-sm ${
                saved 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400'
              }`}
            >
              {saved ? '✅ 저장됨' : '저장'}
            </button>
          </div>
        </div>

        {/* Camera Selection Section */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <label className="block text-sm font-bold text-slate-600 mb-2">
            <i className="fas fa-camera text-indigo-500 mr-2"></i>
            카메라 선택
          </label>
          <p className="text-xs text-slate-400 mb-3">
            사용할 웹캠을 선택하세요. (기기를 변경한 경우 다시 선택해야 합니다.)
          </p>
          <select
            value={selectedCameraId}
            onChange={handleCameraChange}
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-none transition-all text-sm bg-slate-50 font-medium text-slate-700"
          >
            {devices.length === 0 && <option value="">카메라를 찾는 중이거나 없습니다</option>}
            {devices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera (${device.deviceId.substring(0, 5)}...)`}
              </option>
            ))}
          </select>
        </div>

        {/* Branch Info Section */}
        {branchInfo && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fas fa-store-alt text-indigo-500"></i>
              지점 등록 정보
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">지점명</span>
                <span className="text-slate-800 font-black">{branchInfo.branchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">책임 관리자</span>
                <span className="text-slate-800 font-black">{branchInfo.adminName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">연락처</span>
                <span className="text-slate-800 font-black">{branchInfo.contact || '알 수 없음'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">인증 상태</span>
                <span className="text-emerald-600 font-black">
                  {branchInfo.status === 'active' ? '정상 활성화 (v4)' : '로컬 인증 (v3)'}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200/60 mt-1">
                <span className="text-slate-400 font-medium text-xs">최초 개통일</span>
                <span className="text-slate-500 font-medium text-xs">
                  {branchInfo.createdAt 
                    ? new Date(
                        branchInfo.createdAt.seconds 
                        ? branchInfo.createdAt.seconds * 1000 
                        : branchInfo.createdAt
                      ).toLocaleDateString()
                    : branchInfo.verifiedAt ? new Date(branchInfo.verifiedAt).toLocaleDateString() : '알 수 없음'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-slate-100 mt-1 pt-2">
                <span className="text-slate-500 font-medium">기기 ID</span>
                <span className="font-mono text-xs text-slate-400 max-w-[150px] truncate" title={hardwareId}>
                  {hardwareId}
                </span>
              </div>
            </div>
            
            {/* K관상/K타로 일일 사용 한도 관리 */}
            {usageStatus && (
              <div className="mt-4 bg-fuchsia-50/50 rounded-xl p-4 border border-fuchsia-100/50">
                <h4 className="text-xs font-bold text-fuchsia-800 mb-3 flex items-center justify-between">
                  <span><i className="fas fa-magic text-fuchsia-500 mr-1"></i> AI 프리미엄 분석 한도</span>
                  <span className="text-[10px] text-fuchsia-600/70 font-normal">오늘 기준 (클라우드 동기화)</span>
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">K-관상 (Face)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 font-bold">
                        <strong className="text-fuchsia-600">{usageStatus.kfaceUsed}</strong> / {usageStatus.kfaceLimit}회
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-fuchsia-100/50 pt-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">K-타로 (Tarot)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 font-bold">
                        <strong className="text-indigo-600">{usageStatus.ktarotUsed}</strong> / {usageStatus.ktarotLimit}회
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 py-2 text-center border-t border-fuchsia-100/30">
                  <p className="text-[10px] text-fuchsia-600/80">
                    * 한도 초과 시 본사에 문의하여 한도 증설을 요청해 주세요.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Cloud Backup Section */}
        {branchInfo && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fas fa-cloud-upload-alt text-emerald-500"></i>
              중앙 서버 백업
            </h3>
            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500">마지막 백업</span>
                  <span className="text-sm font-bold text-slate-700">
                    {lastBackup 
                      ? new Date(lastBackup).toLocaleString('ko-KR', { 
                          month: '2-digit', day: '2-digit', 
                          hour: '2-digit', minute: '2-digit', hour12: false 
                        })
                      : '백업 기록 없음'}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-slate-500">동기화 건수</span>
                  <span className="text-sm font-bold text-emerald-600">{lastBackupCount}건</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-3">
                <i className="fas fa-info-circle"></i>
                <span>자동 백업: 30분마다 실행 (앱 실행 중)</span>
              </div>

              <button
                onClick={handleManualBackup}
                disabled={isBackingUp}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  isBackingUp
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200'
                }`}
              >
                {isBackingUp ? (
                  <><i className="fas fa-spinner fa-spin"></i> 백업 중...</>
                ) : (
                  <><i className="fas fa-cloud-upload-alt"></i> 지금 백업하기</>
                )}
              </button>
              
              {backupResult && (
                <p className="mt-2 text-xs text-center font-medium text-slate-600">{backupResult}</p>
              )}
            </div>
          </div>
        )}

        {/* App Info & Update */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center gap-4">
          <div className="text-center text-xs text-slate-400 mb-2">
            <strong className="text-slate-500">BTC 3바디 AI분석기</strong> v{appVersion}
            <p className="mt-1 opacity-60">Powered by Gemini AI Vision</p>
          </div>

          {updaterStatus !== 'idle' && (
            <div className="w-full bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col items-center text-center">
              {updaterStatus === 'checking' && (
                <p className="text-xs text-indigo-600"><i className="fas fa-spinner fa-spin mr-2"></i>업데이트 확인 중...</p>
              )}
              
              {updaterStatus === 'available' && (
                <>
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-2 animate-bounce">
                    <i className="fas fa-arrow-alt-circle-down text-lg"></i>
                  </div>
                  <h4 className="text-sm font-bold text-indigo-800 mb-1">최신 업데이트 발견 (v{updaterVersion})</h4>
                  <button 
                    onClick={() => window.electronAPI.downloadUpdate()}
                    className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-6 rounded-full shadow-md transition-all"
                  >
                    업데이트 다운로드 시작
                  </button>
                </>
              )}

              {updaterStatus === 'downloading' && (
                <div className="w-full mt-2">
                  <div className="flex justify-between text-xs text-indigo-800 mb-1 font-bold">
                    <span>업데이트 다운로드 중...</span>
                    <span>{updaterPercent}%</span>
                  </div>
                  <div className="w-full bg-indigo-200 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${updaterPercent}%` }}></div>
                  </div>
                </div>
              )}

              {updaterStatus === 'downloaded' && (
                <>
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                    <i className="fas fa-check-circle text-lg"></i>
                  </div>
                  <h4 className="text-sm font-bold text-emerald-800 mb-1">다운로드 완료!</h4>
                  <p className="text-xs text-emerald-600 mb-3">설치를 위해 프로그램을 재시작합니다.</p>
                  <button 
                    onClick={() => window.electronAPI.installUpdate()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-6 rounded-full shadow-md transition-all animate-pulse"
                  >
                    재시작하여 업데이트 설치
                  </button>
                </>
              )}

              {updaterStatus === 'not-available' && (
                <>
                  <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mb-2">
                    <i className="fas fa-check text-sm"></i>
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 mb-1">최신 버전입니다</h4>
                  <p className="text-xs text-slate-500">현재 가장 최신 버전을 사용 중입니다.</p>
                </>
              )}

              {updaterStatus === 'error' && (
                <>
                  {updaterError.includes('No published versions on GitHub') ? (
                    <>
                      <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mb-2">
                        <i className="fas fa-info-circle text-sm"></i>
                      </div>
                      <h4 className="text-sm font-bold text-slate-700 mb-1">최신 버전입니다</h4>
                      <p className="text-[10px] text-slate-500">아직 서버에 배포된 신규 업데이트가 없습니다.</p>
                    </>
                  ) : (
                    <>
                      <h4 className="text-sm font-bold text-rose-600 mb-1">업데이트 확인 오류</h4>
                      <p className="text-[10px] text-rose-500 max-w-[200px] break-all">
                        {updaterError.includes('net::ERR_INTERNET_DISCONNECTED') 
                          ? '인터넷 연결을 확인해 주세요.' 
                          : updaterError}
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
