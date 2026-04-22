/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Navbar                              ║
 * ║   Top bar with logo + user dropdown          ║
 * ╚══════════════════════════════════════════════╝
 */

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ChevronDown, User, LogOut, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import useAuth from '../hooks/useAuth';
import NotificationBell from './NotificationBell';

const Navbar = () => {
  const { user, logout, getInitials } = useAuth();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  return (
    <header className="app-topbar">
      <Link to="/dashboard" className="topbar-logo">
        <div className="topbar-logo-box">
          <Shield size={14} color="#fff" strokeWidth={2.2} />
        </div>

        <div className="topbar-brand-wrap">
          <span className="topbar-brand">PAIA</span>
          <span className="topbar-sub">Security Platform</span>
        </div>
      </Link>

      <div className="topbar-right">
        {/* <NotificationBell /> */}

        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button className="user-btn" onClick={() => setOpen((prev) => !prev)}>
            <div className="user-avatar">
              {getInitials(user?.name)}
            </div>

            <div style={{ textAlign: 'left' }}>
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>

            <ChevronDown size={12} color="var(--text3)" />
          </button>

          <AnimatePresence>
            {open && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="dropdown"
                style={{ transformOrigin: 'top right' }}
              >
                <div className="dd-head">
                  <div className="dd-head-name">{user?.name}</div>
                  <div className="dd-head-email">{user?.email}</div>
                </div>

                <motion.button whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
                  className="dd-item"
                  onClick={() => {
                    setOpen(false);
                    navigate('/profile');
                  }}
                >
                  <User size={13} />
                  My profile
                </motion.button>

                <motion.button whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
                  className="dd-item"
                  onClick={() => {
                    setOpen(false);
                    navigate('/profile');
                  }}
                >
                  <Settings size={13} />
                  Security Center
                </motion.button>

                <div className="dd-sep" />

                <motion.button whileHover={{ x: 4, backgroundColor: 'rgba(239,68,68,0.1)' }} className="dd-item danger" onClick={handleLogout}>
                  <LogOut size={13} />
                  Sign out
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
