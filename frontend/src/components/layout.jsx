/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Layout Wrapper (GOD-TIER v4)       ║
 * ║   CyberBackground + Navbar + Sidebar + Main ║
 * ╚══════════════════════════════════════════════╝
 */

import Navbar          from './Navbar';
import Sidebar         from './Sidebar';
import CyberBackground from './CyberBackground';

const Layout = ({ children }) => (
  <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
    <CyberBackground />
    <Navbar />
    <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 1 }}>
      <Sidebar />
      <main className="main-content" style={{ width: '100%' }}>
        {children}
      </main>
    </div>
  </div>
);

export default Layout;