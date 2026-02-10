import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AdminDashboard from './pages/AdminDashboard.tsx'

const Root = () => {
  const path = window.location.pathname;
  if (path === '/admin') {
    return <AdminDashboard />;
  }
  return <App />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StrictMode>
      <Root />
    </StrictMode>,
  </StrictMode>,
)
