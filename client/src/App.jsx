import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AppSplash from './components/AppSplash';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CasesList from './pages/CasesList';
import UploadPage from './pages/UploadPage';
import VerifyPage from './pages/VerifyPage';
import CaseDetail from './pages/CaseDetail';
import Departments from './pages/Departments';
import ReviewQueue from './pages/ReviewQueue';
import UserManagement from './pages/UserManagement';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-navy">Loading secure session...</div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1700);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) return <AppSplash />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/cases" element={<ProtectedRoute><CasesList /></ProtectedRoute>} />
      <Route path="/cases/upload" element={<ProtectedRoute allowedRoles={['admin', 'reviewer']}><UploadPage /></ProtectedRoute>} />
      <Route path="/cases/:caseId" element={<ProtectedRoute><CaseDetail /></ProtectedRoute>} />
      <Route path="/cases/:caseId/verify" element={<ProtectedRoute allowedRoles={['reviewer']}><VerifyPage /></ProtectedRoute>} />
      <Route path="/review-queue" element={<ProtectedRoute allowedRoles={['reviewer']}><ReviewQueue /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
      <Route path="/departments" element={<ProtectedRoute><Departments /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
