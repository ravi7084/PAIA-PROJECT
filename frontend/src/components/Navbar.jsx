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

        <div className="user-profile-card">
          <Link to="/profile" className="user-info-section">
            <div className="user-avatar">
              {getInitials(user?.name)}
            </div>

            <div className="user-details">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </Link>

          <div className="user-card-sep" />

          <button className="user-logout-btn" onClick={handleLogout} title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
