
import React, { useEffect } from 'react';
import AdminDashboard from './components/AdminDashboard';
import { ErrorLogger } from './services/ErrorLogger';

const App: React.FC = () => {
  useEffect(() => {
    // 전역 에러 감지기 설정
    const handleGlobalError = (event: ErrorEvent) => {
      ErrorLogger.logCrash('window.onerror', event.message || 'Unknown Global Error', event.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      ErrorLogger.logCrash('unhandledrejection', 'Unhandled Promise Rejection', event.reason);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // 관리자 전용 서버이므로 항상 AdminDashboard 렌더링
  return <AdminDashboard onClose={() => {}} />;
};

export default App;
