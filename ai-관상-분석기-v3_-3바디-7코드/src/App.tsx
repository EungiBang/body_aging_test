import React, { useState, useEffect } from 'react';
import CameraScanner from './components/CameraScanner';
import ReportView from './components/ReportView';
import ProfileSetup from './components/ProfileSetup';
import { PhysiognomyMetrics, averageMetrics } from './lib/physiognomy';
import { analyzePhysiognomy, PhysiognomyReport } from './services/geminiService';
import { ScanFace, Loader2, LogIn, LogOut, User as UserIcon, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, saveReport, getUserProfile, ensureAuth } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

type AppState = 'welcome' | 'scanning' | 'analyzing' | 'report' | 'profile';

export default function App() {
  const [appState, setAppState] = useState<AppState>('welcome');
  const [report, setReport] = useState<PhysiognomyReport | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentCustomer, setCurrentCustomer] = useState<{ displayName: string; birthDate: string; gender: string; phoneNumber?: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleScanComplete = async (metricsList: PhysiognomyMetrics[], imageSrc: string) => {
    setCapturedImage(imageSrc);
    setAppState('analyzing');
    try {
      const avgMetrics = averageMetrics(metricsList);
      
      const result = await analyzePhysiognomy(avgMetrics, currentCustomer);
      setReport(result);
      
      // Save report with customer info
      if (auth.currentUser && currentCustomer) {
        try {
          await saveReport(result, imageSrc, currentCustomer);
          console.log("Report saved successfully.");
        } catch (dbError) {
          console.error("Failed to save report to DB:", dbError);
        }
      }
      
      setAppState('report');
    } catch (error: any) {
      console.error("Analysis failed:", error);
      alert(`분석 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}\n다시 시도해주세요.`);
      setAppState('welcome');
    }
  };

  const onStartAnalysis = async () => {
    // Ensure anonymous session
    setAuthLoading(true);
    try {
      await ensureAuth();
      setCurrentCustomer(null); // Reset for new person
      setAppState('profile');
    } catch (e) {
      console.error("Auth initialization failed:", e);
      setAppState('profile');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-cyan-500/30">
      {/* Simple Header */}
      <header className="absolute top-0 left-0 w-full p-4 flex justify-end items-center z-50">
        <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">System Online</span>
        </div>
      </header>

      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none print:hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-200/40 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-200/40 blur-[120px]" />
      </div>

      <main className="relative z-10 container mx-auto px-4 py-12 min-h-screen flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          
          {appState === 'welcome' && (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center max-w-lg mx-auto"
            >
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white border border-gray-200 shadow-xl mb-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-cyan-500/5 animate-pulse" />
                <ScanFace className="w-12 h-12 text-cyan-600 relative z-10" />
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-6">
                AI 정밀 관상 분석
              </h1>
              
              <p className="text-lg text-gray-600 mb-10 leading-relaxed">
                수천 년의 관상학 데이터와 최신 AI 안면 인식 기술을 결합하여 
                당신의 숨겨진 잠재력과 운의 흐름을 읽어냅니다.
              </p>
              
              <button
                onClick={onStartAnalysis}
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gray-900 text-white font-semibold rounded-full overflow-hidden transition-transform active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50"
                disabled={authLoading}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10">내 관상 확인하기</span>
              </button>
            </motion.div>
          )}

          {appState === 'scanning' && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full"
            >
              <CameraScanner onScanComplete={handleScanComplete} />
            </motion.div>
          )}

          {appState === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center text-center space-y-6"
            >
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-gray-200 rounded-full" />
                <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-cyan-600 animate-pulse" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">데이터 분석 중...</h2>
                <p className="text-gray-600">478개의 3D 랜드마크와 미세표정을 해독하고 있습니다.</p>
              </div>
            </motion.div>
          )}

          {appState === 'report' && report && capturedImage && (
            <motion.div
              key="report"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <ReportView 
                report={report} 
                imageSrc={capturedImage}
                onReset={() => {
                  setAppState('welcome');
                  setCapturedImage(null);
                }} 
              />
            </motion.div>
          )}

          {appState === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full flex justify-center"
            >
              <ProfileSetup 
                onComplete={(data) => {
                  setCurrentCustomer(data);
                  setAppState('scanning');
                }} 
                onCancel={() => setAppState('welcome')} 
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
