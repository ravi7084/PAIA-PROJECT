import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Target, ScanLine, FileText, Shield, Users,
  BrainCircuit, Globe, Radar, Activity, Cpu, Wifi, WifiOff,
  CheckCircle2, AlertCircle, Minus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import useAuth from '../hooks/useAuth';

const NavItem = ({ to, icon: Icon, label, badge, badgeClass, disabled = false }) => {
  const content = (
    <motion.div 
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      className={`nav-link-inner ${disabled ? 'disabled' : ''}`}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
    >
      <div className="nav-link-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Icon size={15} /><span>{label}</span></div>
      {badge && <span className={`nav-badge ${badgeClass || (disabled ? 'soon' : '')}`}>{badge}</span>}
    </motion.div>
  );

  if (disabled) {
    return <div className="nav-link disabled">{content}</div>;
  }
  return (
    <NavLink to={to} className={({ isActive }) => `nav-link${isActive ? ' nav-active active hover-lift' : ''}`} style={{ display: 'block' }}>
      {content}
    </NavLink>
  );
};

const Sidebar = () => {
  const { user } = useAuth();
  
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <aside className="app-sidebar">
      <motion.div variants={containerVariants} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Workspace */}
        <motion.div variants={itemVariants} className="sidebar-group">
          <div className="sidebar-section-title">Workspace</div>
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/command-center" icon={Radar} label="Command Center" badge="Live" badgeClass="pulse" />
        </motion.div>

        {/* Operations */}
        <motion.div variants={itemVariants} className="sidebar-group">
          <div className="sidebar-section-title">Operations</div>
          <NavItem to="/targets" icon={Target} label="Targets" />
          <NavItem to="/scans" icon={ScanLine} label="Scan Center" />
          <NavItem to="/ai-agent" icon={BrainCircuit} label="AI Agent" badge="AI" badgeClass="" />
          <NavItem to="/threat-intel" icon={Globe} label="Threat Intel" />
        </motion.div>

        {/* Intelligence */}
        <motion.div variants={itemVariants} className="sidebar-group">
          <div className="sidebar-section-title">Intelligence</div>
          <NavItem to="/reports" icon={FileText} label="Reports" />
          <NavItem to="/profile" icon={Shield} label="Security" />
        </motion.div>

        {user?.role === 'admin' && (
          <motion.div variants={itemVariants} className="sidebar-group">
            <div className="sidebar-section-title">Admin</div>
            <NavItem to="/admin/users" icon={Users} label="User Mgmt" disabled badge="Soon" badgeClass="soon" />
          </motion.div>
        )}
      </motion.div>
      <div style={{ flex: 1 }} />
    </aside>
  );
};

export default Sidebar;
