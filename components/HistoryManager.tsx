
import React, { useState, useEffect } from 'react';
import { MemberRecord } from '../types';

interface HistoryManagerProps {
  onViewReport: (record: MemberRecord) => void;
  onClose: () => void;
}

const HistoryManager: React.FC<HistoryManagerProps> = ({ onViewReport, onClose }) => {
  const [records, setRecords] = useState<MemberRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bt_records');
      if (saved) {
        const parsed = JSON.parse(saved);
        setRecords(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.error("Failed to load records:", e);
      setRecords([]);
    }
  }, []);

  const filteredRecords = records.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deleteRecord = (id: string) => {
    if (!window.confirm("이 기록을 삭제하시겠습니까?")) return;
    const updated = records.filter(r => r.id !== id);
    setRecords(updated);
    localStorage.setItem('bt_records', JSON.stringify(updated));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-800">회원 관리 센터</h2>
          <p className="text-slate-500">누적된 진단 내역을 확인하고 관리할 수 있습니다.</p>
        </div>
        <button onClick={onClose} className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">
          <i className="fas fa-times"></i>
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

      {filteredRecords.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecords.map(record => (
            <div key={record.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-lg transition-all group overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
                      {record.name[0]}
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-800">{record.name}</h4>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(record.lastTestDate).toLocaleDateString()}</span>
                    </div>
                </div>
                <button 
                  onClick={() => deleteRecord(record.id)}
                  className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <i className="fas fa-trash-alt text-sm"></i>
                </button>
              </div>

              {/* Preview Image */}
              <div className="mb-4 h-32 rounded-2xl bg-slate-100 overflow-hidden border border-slate-100">
                {record.images && record.images[0] ? (
                  <img src={record.images[0].dataUrl} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all" alt="Preview" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <i className="fas fa-image text-3xl"></i>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mb-6 text-xs px-1">
                <div className="text-slate-500">신체 나이 <span className="font-bold text-indigo-600">{record.report.physicalAge}세</span></div>
                <div className="text-slate-500">종합 점수 <span className="font-bold text-slate-800">{record.report.overallScore}점</span></div>
              </div>
              
              <button 
                onClick={() => onViewReport(record)}
                className="w-full bg-slate-900 text-white text-sm font-bold py-4 rounded-xl hover:bg-black transition-all shadow-md shadow-slate-200"
              >
                상세 리포트 보기
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
           <i className="fas fa-folder-open text-5xl text-slate-200 mb-4"></i>
           <p className="text-slate-400 font-medium">검색 결과가 없거나 저장된 데이터가 없습니다.</p>
           <p className="text-xs text-slate-300 mt-2">새로운 진단을 시작하여 기록을 생성하세요.</p>
        </div>
      )}
    </div>
  );
};

export default HistoryManager;
