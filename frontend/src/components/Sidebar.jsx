/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Sidebar                             ║
 * ║   Left navigation + phase progress tracker   ║
 * ╚══════════════════════════════════════════════╝
 *
 * PHASE 2 CHANGE: Line 71 mein sirf "disabled" word hataya
 * Baaki sab original zip jaisa hai
 */

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Target,
  ScanLine,
  FileText,
  CheckCircle,
  Shield,
  Users,
  Sparkles,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';

const phases = [
  { label: 'Authentication', phase: 'Phase 1', done: true  },
  { label: 'Target Management', phase: 'Phase 2', done: true  }, // ← done: true kar diya
  { label: 'Scan Engine',    phase: 'Phase 3', done: false },
  { label: 'AI Agent',       phase: 'Phase 4', done: false },
  { label: 'Reports',        phase: 'Phase 5', done: false },
];

const NavItem = ({ to, icon: Icon, label, badge, disabled = false, soon = false }) => {
  if (disabled) {
    return (
      <div className="nav-link disabled">
        <div className="nav-link-left">
          <Icon size={14} />
          <span>{label}</span>
        </div>
        {badge && <span className={`nav-badge ${soon ? 'soon' : ''}`}>{badge}</span>}
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
    >
      <div className="nav-link-left">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      {badge && <span className={`nav-badge ${soon ? 'soon' : ''}`}>{badge}</span>}
    </NavLink>
  );
};

const Sidebar = () => {
  const { user } = useAuth();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-group">
        <div className="sidebar-section-title">Workspace</div>

        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavItem to="/profile"   icon={Shield}          label="Security Center" badge="Live" />
      </div>

      <div className="sidebar-group">
        <div className="sidebar-section-title">Modules</div>

        {/* PHASE 2: "disabled" prop hataya — ab click hoga */}
        <NavItem to="/targets" icon={Target}   label="Targets" badge="Ph 2" />
        <NavItem to="/scans"   icon={ScanLine} label="Scans"   badge="Live" />
        <NavItem to="/reports" icon={FileText}  label="Reports" disabled badge="Ph 5" />
      </div>

      {user?.role === 'admin' && (
        <div className="sidebar-group">
          <div className="sidebar-section-title">Admin</div>
          <NavItem
            to="/admin/users"
            icon={Users}
            label="User Management"
            disabled
            badge="Soon"
            soon
          />
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div className="sidebar-bottom">
        <div className="sidebar-mini-card">
          <div className="sidebar-mini-card-title">
            <Sparkles size={12} />
            Phase 2 Live
          </div>
          <div className="sidebar-mini-card-sub">
            Target management, consent gate, tags, SSRF protection active.
          </div>
        </div>

        <div className="phase-tracker">
          <div className="phase-tracker-title">
            <CheckCircle size={11} />
            Build progress
          </div>

          {phases.map(({ label, phase, done }) => (
            <div className="phase-row" key={phase}>
              <div
                className="phase-dot"
                style={{
                  background: done ? 'var(--indigo-l)' : 'rgba(255,255,255,0.1)',
                }}
              />
              <span
                className="phase-label"
                style={{
                  color:      done ? 'var(--indigo-l)' : 'var(--text3)',
                  fontWeight: done ? 700 : 500,
                }}
              >
                {label}
              </span>
              <span className="phase-row-tag">{phase}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
