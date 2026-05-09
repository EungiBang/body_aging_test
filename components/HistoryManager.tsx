import React, { useState, useEffect } from 'react';
import { MemberRecord } from '../types';
import Modal from './Modal';
import Toast from './Toast';
import FeedbackDashboard from './FeedbackDashboard';
import { getRecordsLocally, deleteRecordLocally, saveRecordLocally } from '../services/localDb';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface HistoryManagerProps {
  onViewReport: (record: MemberRecord) => void;
  onResumeAnalysis?: (record: MemberRecord) => void;
  onClose: () => void;
}

const HistoryManager: React.FC<HistoryManagerProps> = ({ onViewReport, onResumeAnalysis, onClose }) => {
  const [activeTab, setActiveTab] = useState<'records' | 'pending' | 'feedback'>('records');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'my_pc' | 'other_pc' | 'lite'>('all');
  const [records, setRecords] = useState<MemberRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  const fetchRecords = async () => {
    try {
      const fetchedRecords = await getRecordsLocally();
      fetchedRecords.sort((a, b) => new Date(b.lastTestDate).getTime() - new Date(a.lastTestDate).getTime());
      setRecords(fetchedRecords);
    } catch (err) {
      console.error("Failed to load local records:", err);
      setToast({ isVisible: true, message: "기록을 불러오는데 실패했습니다.", type: 'error' });
    }
  };

  useEffect(() => {
    fetchRecords();
    try {
      const deviceStr = localStorage.getItem('currentDevice');
      if (deviceStr) {
        const device = JSON.parse(deviceStr);
        setCurrentDeviceId(device.id || '');
      }
    } catch (e) {}
  }, []);

  const filteredRecords = records.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const completedRecordsAll = filteredRecords.filter(r => r.report?.overallScore !== undefined);
  const pendingRecordsAll = filteredRecords.filter(r => r.report?.overallScore === undefined);

  // sourceType 기반 카운트 (기존 _isRemote도 하위 호환으로 고려)
  const isLiteRecord = (r: MemberRecord) => r.sourceType === 'LITE';
  const isMyPcRecord = (r: MemberRecord) => !isLiteRecord(r) && (r.hardwareId === currentDeviceId || (!(r as any)._isRemote && !r.hardwareId));
  const isOtherPcRecord = (r: MemberRecord) => !isLiteRecord(r) && !isMyPcRecord(r);

  const myPcCount = completedRecordsAll.filter(isMyPcRecord).length;
  const otherPcCount = completedRecordsAll.filter(isOtherPcRecord).length;
  const liteCount = completedRecordsAll.filter(isLiteRecord).length;

  const filterBySource = (r: MemberRecord) => {
    if (sourceFilter === 'all') return true;
    if (sourceFilter === 'lite') return isLiteRecord(r);
    if (sourceFilter === 'my_pc') return isMyPcRecord(r);
    if (sourceFilter === 'other_pc') return isOtherPcRecord(r);
    return true;
  };

  const completedRecords = completedRecordsAll.filter(filterBySource);
  const pendingRecords = pendingRecordsAll.filter(filterBySource);

  const uniqueNames = Array.from(new Set(completedRecords.map(r => r.name)));
  const showChart = uniqueNames.length === 1 && completedRecords.length > 1;
  const chartData = showChart ? [...completedRecords].reverse().map(r => ({
    date: r.lastTestDate,
    biologicalAge: r.report?.userInfo?.age || 0,
    physicalAge: r.report?.physicalAge || 0,
    faceAge: r.report?.faceAgeEstimate || 0
  })) : [];

  const exportData = () => {
    const headers = ['이름','연락처','성별','나이','측정일','종합점수','신체나이','얼굴나이','뇌나이','체형분석','자세요약','근력요약','추천프로그램'];
    const escCsv = (v: any) => {
      const s = String(v ?? '').replace(/"/g, '""');
      return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s + '"' : s;
    };
    const rows = completedRecords.map(r => {
      const rp = r.report;
      const ui = rp?.userInfo;
      return [
        ui?.name || r.name, ui?.phone || '', ui?.gender === 'male' ? '남' : ui?.gender === 'female' ? '여' : '',
        ui?.age || '', new Date(r.lastTestDate).toLocaleDateString(),
        rp?.overallScore || '', rp?.physicalAge || '', rp?.faceAgeEstimate || '', rp?.brainAge || '',
        rp?.bodyTypeAnalysis || '', (rp?.summary || '').substring(0, 100),
        rp?.strengthMetrics?.map(s => s.exercise + ':' + s.reps + '회').join(' / ') || '',
        rp?.programRecommendation?.recommended || ''
      ].map(escCsv).join(',');
    });
    const bom = '\uFEFF';
    const csv = bom + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bt_records_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    setToast({ isVisible: true, message: 'CSV 파일로 ' + completedRecords.length + '명의 데이터를 내보냈습니다.', type: 'success' });
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const imported = JSON.parse(text);
          if (Array.isArray(imported)) {
            let count = 0;
            for (const record of imported) {
              const success = await saveRecordLocally({ ...record, ownerUid: 'local-branch' });
              if (success) count++;
            }
            await fetchRecords();
            setToast({ isVisible: true, message: count + '개의 데이터를 불러왔습니다.', type: 'success' });
          }
          return;
        }
        const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
        if (lines.length < 2) { setToast({ isVisible: true, message: 'CSV에 데이터가 없습니다.', type: 'error' }); return; }
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
          const name = vals[0] || ('회원' + i);
          const record: MemberRecord = {
            id: 'csv-' + Date.now().toString(36) + '-' + i, name,
            lastTestDate: new Date().toISOString(),
            report: { id: 'csv-import-' + i, date: new Date().toISOString(),
              userInfo: { name, gender: vals[2] === '남' ? 'male' : vals[2] === '여' ? 'female' : 'other', age: parseInt(vals[3]) || 0, phone: vals[1] || '', memberType: 'new' as const },
              overallScore: parseInt(vals[5]) || 0, physicalAge: parseInt(vals[6]) || 0,
              faceAgeEstimate: parseInt(vals[7]) || 0, brainAge: parseInt(vals[8]) || 0,
              comprehensiveAge: parseInt(vals[6]) || 0, bodyTypeAnalysis: vals[9] || '',
              summary: vals[10] || 'CSV에서 불러온 데이터',
              postureMetrics: [], strengthMetrics: [], agingMetrics: [],
              faceAnalysis: { skinTone: '', wrinkles: '', elasticity: '', summary: '', recommendation: '' },
              brainHealthImplication: '', recommendations: { meditation: '', gymnastics: '', brainTraining: '' },
              threeBodyAnalysis: { body: { score: 0, description: '' }, mind: { score: 0, description: '' }, brain: { score: 0, description: '' } },
              sevenCodeAnalysis: { code1: { score: 0, label: '', description: '', evidence: [] }, code2: { score: 0, label: '', description: '', evidence: [] }, code3: { score: 0, label: '', description: '', evidence: [] }, code4: { score: 0, label: '', description: '', evidence: [] }, code5: { score: 0, label: '', description: '', evidence: [] }, code6: { score: 0, label: '', description: '', evidence: [] }, code7: { score: 0, label: '', description: '', evidence: [] } },
              kwangmyungChakra: { needLevel: '', reason: '', expectedBenefit: '' },
              programRecommendation: { recommended: vals[12] || '', reason: '', duration: '' },
            } as any, images: [], ownerUid: 'local-branch'
          };
          const success = await saveRecordLocally(record);
          if (success) count++;
        }
        await fetchRecords();
        setToast({ isVisible: true, message: 'CSV에서 ' + count + '명의 데이터를 불러왔습니다.', type: 'success' });
      } catch (err) {
        console.error('Import failed:', err);
        setToast({ isVisible: true, message: '데이터 불러오기에 실패했습니다.', type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const [clearConfirm, setClearConfirm] = useState(false);
  const [toast, setToast] = useState<{ isVisible: boolean, message: string, type: 'success' | 'error' | 'info' }>({ isVisible: false, message: '', type: 'success' });

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deleteRecordLocally(deleteId);
      await fetchRecords();
      setDeleteId(null);
      setToast({ isVisible: true, message: "기록이 삭제되었습니다.", type: 'info' });
    } catch (error) {
      console.error("Local Delete Error:", error);
      setToast({ isVisible: true, message: "삭제 중 오류가 발생했습니다.", type: 'error' });
    }
  };

  const handleClearAll = async () => {
    try {
      // 로컬의 모든 레코드 삭제
      for (const r of records) {
        await deleteRecordLocally(r.id);
      }
      await fetchRecords();
      setClearConfirm(false);
      setToast({ isVisible: true, message: "모든 데이터가 삭제되었습니다.", type: 'info' });
    } catch (error) {
      console.error("Clear All Error:", error);
      setToast({ isVisible: true, message: "모든 데이터 삭제 중 오류가 발생했습니다.", type: 'error' });
    }
  };

  const handleBatchDeleteConfirm = async () => {
    try {
      for (const id of selectedIds) {
        await deleteRecordLocally(id);
      }
      await fetchRecords();
      setSelectedIds([]);
      setBatchDeleteConfirm(false);
      setToast({ isVisible: true, message: `${selectedIds.length}개의 기록이 삭제되었습니다.`, type: 'info' });
    } catch (error) {
      console.error("Batch Delete Error:", error);
      setToast({ isVisible: true, message: "삭제 중 오류가 발생했습니다.", type: 'error' });
    }
  };

  const importV3Data = async () => {
    if (window.electronAPI && window.electronAPI.importV3Database) {
      try {
        const v3Records = await window.electronAPI.importV3Database();
        if (v3Records && v3Records.length > 0) {
          let count = 0;
          for (const record of v3Records) {
            if (!records.find(r => r.id === record.id)) {
              const success = await saveRecordLocally(record);
              if (success) count++;
            }
          }
          await fetchRecords();
          setToast({ isVisible: true, message: `V3 데이터 ${count}개를 성공적으로 가져왔습니다.`, type: 'success' });
        } else {
          setToast({ isVisible: true, message: "가져올 기존 V3 데이터가 없습니다.", type: 'info' });
        }
      } catch (err) {
        console.error("V3 Import failed:", err);
        setToast({ isVisible: true, message: "데이터 불러오기에 실패했습니다.", type: 'error' });
      }
    } else {
      setToast({ isVisible: true, message: "웹 환경에서는 지원하지 않는 기능입니다.", type: 'error' });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <Modal 
        isOpen={deleteId !== null}
        title="기록 삭제"
        message="이 회원의 진단 기록을 영구적으로 삭제하시겠습니까?"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteId(null)}
        confirmText="삭제"
        cancelText="취소"
      />
      <Modal 
        isOpen={clearConfirm}
        title="전체 데이터 삭제"
        message="모든 회원 데이터와 진단 기록이 영구적으로 삭제됩니다. 계속하시겠습니까?"
        onConfirm={handleClearAll}
        onClose={() => setClearConfirm(false)}
        confirmText="전체 삭제"
        cancelText="취소"
      />
      <Modal 
        isOpen={batchDeleteConfirm}
        title="선택 기록 삭제"
        message={`${selectedIds.length}명의 진단 기록을 삭제하시겠습니까?`}
        onConfirm={handleBatchDeleteConfirm}
        onClose={() => setBatchDeleteConfirm(false)}
        confirmText="선택 삭제"
        cancelText="취소"
      />
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800">회원 관리 센터</h2>
          <p className="text-slate-500 text-sm mt-1">누적된 측정 내역을 확인하고 관리할 수 있습니다.</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setBatchDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 h-10 bg-rose-50 text-rose-600 rounded-full font-bold text-sm hover:bg-rose-100 transition-all border border-rose-200 mr-2"
            >
              <i className="fas fa-trash-alt"></i> 선택 삭제 ({selectedIds.length})
            </button>
          )}
          {activeTab === 'records' && (
            <>
              <button
                onClick={importV3Data}
                className="flex items-center gap-2 px-4 h-10 bg-indigo-600 text-white rounded-full font-bold text-sm hover:bg-indigo-700 transition-all shadow-sm"
                title="기존 V3 데이터 가져오기"
              >
                <i className="fas fa-file-import"></i> V3 데이터 가져오기
              </button>
              <button
                onClick={exportData}
                className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-100 transition-all"
                title="데이터 내보내기"
              >
                <i className="fas fa-download"></i>
              </button>
              <label className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center hover:bg-emerald-100 transition-all cursor-pointer" title="데이터 불러오기">
                <i className="fas fa-upload"></i>
                <input type="file" className="hidden" accept=".csv,.json" onChange={importData} />
              </label>
              <button
                onClick={() => setClearConfirm(true)}
                className="w-10 h-10 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-100 transition-all"
                title="전체 삭제"
              >
                <i className="fas fa-trash-sweep"></i>
              </button>
            </>
          )}
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      {/* 탭 전환 */}
      <div className="flex gap-1 mb-8 bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('records')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'records'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <i className="fas fa-users text-xs"></i>
          회원 기록
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'records' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'
          }`}>{completedRecords.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'pending'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <i className="fas fa-archive text-xs"></i>
          임시 보관함
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'
          }`}>{pendingRecords.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'feedback'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <i className="fas fa-chart-pie text-xs"></i>
          AI 피드백 현황
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-600`}>
            NEW
          </span>
        </button>
      </div>

      {/* 탭 콘텐츠 — 피드백 현황 */}
      {activeTab === 'feedback' && <FeedbackDashboard />}

      {/* 탭 콘텐츠 — 회원 기록 */}
      {activeTab === 'records' && (
        <>
      {/* 서브 필터 (소스 구분) */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSourceFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
            sourceFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-globe mr-2"></i> 전체 ({completedRecordsAll.length})
        </button>
        <button
          onClick={() => setSourceFilter('my_pc')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
            sourceFilter === 'my_pc' ? 'bg-blue-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-desktop mr-2"></i> 나의 PC ({myPcCount})
        </button>
        <button
          onClick={() => setSourceFilter('other_pc')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
            sourceFilter === 'other_pc' ? 'bg-slate-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-cloud mr-2"></i> 다른 PC ({otherPcCount})
        </button>
        <button
          onClick={() => setSourceFilter('lite')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
            sourceFilter === 'lite' ? 'bg-emerald-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-mobile-alt mr-2"></i> 온라인 LITE ({liteCount})
        </button>
      </div>
      <div className="mb-8 relative">
        <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input
          type="text"
          placeholder="회원 이름 검색..."
          className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {showChart && (
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm mb-8">
          <h3 className="text-xl font-bold text-slate-800 mb-4">{uniqueNames[0]}님의 신체 나이 변화 추이</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  domain={['dataMin - 5', 'dataMax + 5']} 
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                />
                <Tooltip 
                  labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number, name: string) => [
                    `${value}세`, 
                    name === 'biologicalAge' ? '생물학적 나이' : name === 'physicalAge' ? '신체 나이' : '얼굴 나이'
                  ]}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line 
                  type="monotone" 
                  dataKey="biologicalAge" 
                  name="생물학적 나이" 
                  stroke="#94a3b8" 
                  strokeWidth={3} 
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0 }} 
                  animationDuration={1500}
                />
                <Line 
                  type="monotone" 
                  dataKey="physicalAge" 
                  name="신체 나이" 
                  stroke="#4f46e5" 
                  strokeWidth={4} 
                  dot={{ r: 5, fill: '#4f46e5', strokeWidth: 3, stroke: '#fff' }} 
                  activeDot={{ r: 8, strokeWidth: 0 }} 
                  animationDuration={1500}
                />
                <Line 
                  type="monotone" 
                  dataKey="faceAge" 
                  name="얼굴 나이" 
                  stroke="#f43f5e" 
                  strokeWidth={4} 
                  dot={{ r: 5, fill: '#f43f5e', strokeWidth: 3, stroke: '#fff' }} 
                  activeDot={{ r: 8, strokeWidth: 0 }} 
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {completedRecords.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {completedRecords.map(record => (
            <div key={record.id} className={`bg-white p-6 rounded-[32px] border ${selectedIds.includes(record.id) ? 'border-indigo-500 ring-2 ring-indigo-100' : isLiteRecord(record) ? 'border-emerald-300' : isOtherPcRecord(record) ? 'border-cyan-300' : 'border-slate-200'} shadow-sm hover:shadow-lg transition-all group overflow-hidden relative`}>
              <div className="absolute top-6 left-6 z-10">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  checked={selectedIds.includes(record.id)}
                  disabled={isOtherPcRecord(record) || isLiteRecord(record)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds([...selectedIds, record.id]);
                    else setSelectedIds(selectedIds.filter(id => id !== record.id));
                  }}
                />
              </div>
              <div className="flex justify-between items-start mb-4 pl-8">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${isLiteRecord(record) ? 'bg-emerald-50' : isOtherPcRecord(record) ? 'bg-cyan-50' : 'bg-indigo-50'} rounded-2xl flex items-center justify-center ${isLiteRecord(record) ? 'text-emerald-600' : isOtherPcRecord(record) ? 'text-cyan-600' : 'text-indigo-600'} font-bold text-xl shrink-0`}>
                      {record.name[0]}
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          {record.name}
                          {isLiteRecord(record) ? (
                            <span className="bg-emerald-100 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-mobile-alt mr-1"></i>온라인 LITE</span>
                          ) : isOtherPcRecord(record) ? (
                            <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-cloud mr-1"></i>다른 PC</span>
                          ) : (
                            <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-desktop mr-1"></i>나의 PC</span>
                          )}
                          {record.report?.userInfo?.phone && <span className="ml-1 text-sm text-slate-500 font-normal">{record.report.userInfo.phone}</span>}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(record.lastTestDate).toLocaleDateString()}</span>
                    </div>
                </div>
                {isMyPcRecord(record) && (
                <button 
                  onClick={() => setDeleteId(record.id)}
                  className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <i className="fas fa-trash-alt text-sm"></i>
                </button>
              )}
              </div>

              {/* Preview Image */}
              <div className="mb-4 h-32 rounded-2xl bg-slate-100 overflow-hidden border border-slate-100">
                {record.images && record.images[0] && record.images[0].dataUrl ? (
                  <img src={record.images[0].dataUrl} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all" alt="Preview" />
                ) : isLiteRecord(record) ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-emerald-400 bg-emerald-50/50">
                    <i className="fas fa-mobile-alt text-2xl mb-1"></i>
                    <span className="text-[10px] font-bold text-emerald-500">온라인 LITE에서 동기화된 데이터</span>
                    <span className="text-[10px] text-emerald-400">텍스트 리포트 열람 가능</span>
                  </div>
                ) : isOtherPcRecord(record) ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-cyan-400 bg-cyan-50/50">
                    <i className="fas fa-cloud text-2xl mb-1"></i>
                    <span className="text-[10px] font-bold text-cyan-500">다른 PC에서 동기화된 데이터</span>
                    <span className="text-[10px] text-cyan-400">텍스트 리포트 열람 가능</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <i className="fas fa-image text-3xl"></i>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 mb-6 text-xs px-1">
                <div className="flex items-center justify-between">
                  <div className="text-slate-500">생물학적 나이 <span className="font-bold text-slate-800">{record.report?.userInfo?.age || '-'}세</span></div>
                  <div className="text-slate-500">종합 점수 <span className="font-bold text-slate-800">{record.report?.overallScore || '-'}점</span></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-slate-500">신체 나이 <span className="font-bold text-indigo-600">{record.report?.physicalAge || '-'}세</span></div>
                  <div className="text-slate-500">얼굴 나이 <span className="font-bold text-rose-500">{record.report?.faceAgeEstimate || '-'}세</span></div>
                </div>
              </div>
              
              <button 
                onClick={() => onViewReport(record)}
                disabled={!record.report?.overallScore}
                className={`w-full text-white text-sm font-bold py-4 rounded-xl transition-all shadow-md ${
                  !record.report?.overallScore
                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                    : isLiteRecord(record)
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                    : isOtherPcRecord(record)
                    ? 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-200'
                    : 'bg-slate-900 hover:bg-black shadow-slate-200'
                }`}
              >
                {!record.report?.overallScore ? '분석 미완료 (대기중)' : isLiteRecord(record) ? '📱 LITE 리포트 보기' : isOtherPcRecord(record) ? '📄 텍스트 리포트 보기' : '상세 리포트 보기'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
           <i className="fas fa-folder-open text-5xl text-slate-200 mb-4"></i>
           <p className="text-slate-400 font-medium">검색 결과가 없거나 저장된 데이터가 없습니다.</p>
           <p className="text-xs text-slate-300 mt-2">새로운 측정을 시작하여 기록을 생성하세요.</p>
        </div>
      )}
        </>
      )}

      {/* 탭 콘텐츠 — 임시 보관함 */}
      {activeTab === 'pending' && (
        <>
          <div className="mb-8 relative">
            <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="임시 보관된 회원 검색..."
              className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <i className="fas fa-info-circle text-amber-500 mt-0.5"></i>
            <p className="text-sm text-amber-700">
              측정은 완료되었으나 AI 분석이 정상적으로 끝나지 않은 기록입니다.<br/>
              [AI 재분석 시작] 버튼을 눌러 분석을 재개하면 정식 회원 기록으로 저장됩니다.
            </p>
          </div>

          {pendingRecords.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingRecords.map(record => (
                <div key={record.id} className={`bg-white p-6 rounded-[32px] border ${selectedIds.includes(record.id) ? 'border-amber-500 ring-2 ring-amber-100' : 'border-amber-200'} shadow-sm hover:shadow-lg transition-all group overflow-hidden relative`}>
                  <div className="absolute top-6 left-6 z-10">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                      checked={selectedIds.includes(record.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds([...selectedIds, record.id]);
                        else setSelectedIds(selectedIds.filter(id => id !== record.id));
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-start mb-4 pl-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 font-bold text-xl shrink-0">
                          {record.name.replace('(분석 대기) ', '')[0]}
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-slate-800">{record.name}</h4>
                            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">{new Date(record.lastTestDate).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <button 
                      onClick={() => setDeleteId(record.id)}
                      className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <i className="fas fa-trash-alt text-sm"></i>
                    </button>
                  </div>

                  {/* Preview Image */}
                  <div className="mb-4 h-32 rounded-2xl bg-slate-100 overflow-hidden border border-slate-100">
                    {record.images && record.images[0] ? (
                      <img src={record.images[0].dataUrl} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all" alt="Preview" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <i className="fas fa-image text-3xl"></i>
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => onResumeAnalysis && onResumeAnalysis(record)}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold py-4 rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-amber-200 flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-microchip"></i> AI 재분석 시작
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
               <i className="fas fa-box-open text-5xl text-slate-200 mb-4"></i>
               <p className="text-slate-400 font-medium">분석 대기 중인 임시 데이터가 없습니다.</p>
            </div>
          )}
        </>
      )}
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
};

export default HistoryManager;
