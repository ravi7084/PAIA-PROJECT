import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Target, ScanLine, FileText, Shield, Users,
  BrainCircuit, Globe, Radar, Activity, Cpu, Wifi, WifiOff,
  CheckCircle2, AlertCircle, Minus,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';

const NavItem = ({ to, icon: Icon, label, badge, badgeClass, disabled = false }) => {
  if (disabled) {
    return (
      <div className="nav-link disabled">
        <div className="nav-link-left"><Icon size={15} /><span>{label}</span></div>
        {badge && <span className={`nav-badge ${badgeClass || 'soon'}`}>{badge}</span>}
      </div>
    );
  }
  return (
    <NavLink to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
      <div className="nav-link-left"><Icon size={15} /><span>{label}</span></div>
      {badge && <span className={`nav-badge ${badgeClass || ''}`}>{badge}</span>}
    </NavLink>
  );
};

const StatusDot = ({ status }) => (
  <span className={`intel-dot ${status}`} />
);

const Sidebar = () => {
  const { user } = useAuth();

  return (
    <aside className="app-sidebar">
      {/* Workspace */}
      <div className="sidebar-group">
        <div className="sidebar-section-title">Workspace</div>
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavItem to="/command-center" icon={Radar} label="Command Center" badge="Live" badgeClass="pulse" />
      </div>

      {/* Operations */}
      <div className="sidebar-group">
        <div className="sidebar-section-title">Operations</div>
        <NavItem to="/targets" icon={Target} label="Targets" />
        <NavItem to="/scans" icon={ScanLine} label="Scan Center" />
        <NavItem to="/ai-agent" icon={BrainCircuit} label="AI Agent" badge="AI" badgeClass="" />
        <NavItem to="/threat-intel" icon={Globe} label="Threat Intel" />
      </div>

      {/* Intelligence */}
      <div className="sidebar-group">
        <div className="sidebar-section-title">Intelligence</div>
        <NavItem to="/reports" icon={FileText} label="Reports" />
        <NavItem to="/profile" icon={Shield} label="Security" />
      </div>

      {user?.role === 'admin' && (
        <div className="sidebar-group">
          <div className="sidebar-section-title">Admin</div>
          <NavItem to="/admin/users" icon={Users} label="User Mgmt" disabled badge="Soon" badgeClass="soon" />
        </div>
      )}

      <div style={{ flex: 1 }} />

      
    </aside>
  );
};

export default Sidebar;
