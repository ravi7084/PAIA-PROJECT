import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

const formatTimeAgo = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} day ago`;
};

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const wrapRef = useRef(null);

  const { notifications, unreadCount, markAsRead } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setPanelLoading(true);
      const timer = setTimeout(() => setPanelLoading(false), 260);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleClick = (item) => {
    markAsRead(item._id);

    if (item.link) {
      navigate(item.link);
    }

    setOpen(false);
  };

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        className="notif-btn"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell size={18} />

        {unreadCount > 0 && (
          <span className="notif-count">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-title-row">
            <div className="notif-title">Notifications</div>
            <div className="notif-mini-label">
              {unreadCount} unread
            </div>
          </div>

          {panelLoading ? (
            <div className="notif-loading">
              <div className="skeleton-line skeleton-sm" />
              <div className="skeleton-line skeleton-lg" />
              <div className="skeleton-line skeleton-md" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="notif-empty">No notifications</div>
          ) : (
            notifications.slice(0, 8).map((n) => (
              <div
                key={n._id}
                className={`notif-item ${n.isRead ? 'read' : 'unread'}`}
                onClick={() => handleClick(n)}
                style={{
                  cursor: 'pointer',
                }}
              >
                <div className="notif-item-title">{n.title}</div>

                <div className="notif-item-msg">{n.message}</div>

                <div
                  style={{
                    fontSize: 9,
                    color: 'var(--text3)',
                    marginTop: 4,
                  }}
                >
                  {formatTimeAgo(n.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;