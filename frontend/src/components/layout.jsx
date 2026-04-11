/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Layout Wrapper                      ║
 * ║   Navbar + Sidebar + main content area       ║
 * ╚══════════════════════════════════════════════╝
 */

import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Navbar />

      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />

        <main className="main-content" style={{ width: '100%' }}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;