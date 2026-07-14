import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AdminDashboard from './pages/AdminDashboard.tsx'
import { AuthProvider } from './lib/AuthContext.tsx'
import { NotificationProvider } from './lib/Notifications.tsx'

const Root = () => {
  const path = window.location.pathname;
  if (path === '/admin') {
    return <AdminDashboard />;
  }
  return <App />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <Root />
      </NotificationProvider>
    </AuthProvider>
  </StrictMode>
)
