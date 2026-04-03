
import React, { useState, useEffect } from 'react';
import { MemberRecord } from '../types';
import Modal from './Modal';
import Toast from './Toast';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface HistoryManagerProps {
  onViewReport: (record: MemberRecord) => void;
  onClose: () => void;
}

const HistoryManager: React.FC<HistoryManagerProps> = ({ onViewReport, onClose }) => {
  const [records, setRecords] = useState<MemberRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const path = 'members';
    const q = query(
      collection(db, path), 
      where('ownerUid', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRecords = snapshot.docs.map(doc => doc.data() as MemberRecord);
      // Sort by date descending
      fetchedRecords.sort((a, b) => new Date(b.lastTestDate).getTime() - new Date(a.lastTestDate).getTime());
      setRecords(fetchedRecords);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, []);

  const filteredRecords = records.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const uniqueNames = Array.from(new Set(filteredRecords.map(r => r.name)));
  const showChart = uniqueNames.length === 1 && filteredRecords.length > 1;
  const chartData = showChart ? [...filteredRecords].reverse().map(r => ({
    date: r.lastTestDate,
    biologicalAge: r.report.userInfo.age,
    physicalAge: r.report.physicalAge,
    faceAge: r.report.faceAgeEstimate
  })) : [];

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `bt_records_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setToast({ isVisible: true, message: "데이터가 성공적으로 내보내졌습니다.", type: 'success' });
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported) && auth.currentUser) {
          const batch = writeBatch(db);
          imported.forEach(record => {
            const memberRef = doc(db, 'members', record.id);
            batch.set(memberRef, { ...record, ownerUid: auth.currentUser?.uid });
          });
          await batch.commit();
          setToast({ isVisible: true, message: "데이터를 성공적으로 불러왔습니다.", type: 'success' });
        }
      } catch (err) {
        console.error("Import failed:", err);
        setToast({ isVisible: true, message: "데이터 불러오기에 실패했습니다.", type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const [clearConfirm, setClearConfirm] = useState(false);
  const [toast, setToast] = useState<{ isVisible: boolean, message: string, type: 'success' | 'error' | 'info' }>({ isVisible: false, message: '', type: 'success' });

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    const path = `members/${deleteId}`;
    try {
      await deleteDoc(doc(db, 'members', deleteId));
      setDeleteId(null);
      setToast({ isVisible: true, message: "기록이 삭제되었습니다.", type: 'info' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleClearAll = async () => {
    if (!auth.currentUser) return;
    const path = 'members';
    try {
      const q = query(collection(db, path), where('ownerUid', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
      setClearConfirm(false);
      setToast({ isVisible: true, message: "모든 데이터가 삭제되었습니다.", type: 'info' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-800">회원 관리 센터</h2>
          <p className="text-slate-500">누적된 진단 내역을 확인하고 관리할 수 있습니다.</p>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={exportData}
              className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-100 transition-all"
              title="데이터 내보내기"
            >
              <i className="fas fa-download"></i>
            </button>
            <label className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center hover:bg-emerald-100 transition-all cursor-pointer" title="데이터 불러오기">
              <i className="fas fa-upload"></i>
              <input type="file" className="hidden" accept=".json" onChange={importData} />
            </label>
            <button 
              onClick={() => setClearConfirm(true)}
              className="w-10 h-10 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-100 transition-all"
              title="전체 삭제"
            >
              <i className="fas fa-trash-sweep"></i>
            </button>
            <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">
              <i className="fas fa-times"></i>
            </button>
        </div>
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
                  onClick={() => setDeleteId(record.id)}
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

              <div className="flex flex-col gap-2 mb-6 text-xs px-1">
                <div className="flex items-center justify-between">
                  <div className="text-slate-500">생물학적 나이 <span className="font-bold text-slate-800">{record.report.userInfo.age}세</span></div>
                  <div className="text-slate-500">종합 점수 <span className="font-bold text-slate-800">{record.report.overallScore}점</span></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-slate-500">신체 나이 <span className="font-bold text-indigo-600">{record.report.physicalAge}세</span></div>
                  <div className="text-slate-500">얼굴 나이 <span className="font-bold text-rose-500">{record.report.faceAgeEstimate}세</span></div>
                </div>
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
