import { Clock3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

const formatTimeAgo = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} day ago`;
};

const ActivityLog = () => {
  const { notifications, markAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (item) => {
    markAsRead(item._id);
    if (item.link) navigate(item.link);
  };

  return (
    <div className="dark-card">
      <div className="card-title">
        <Clock3 size={13} />
        Recent Activity
      </div>

      {notifications.length === 0 ? (
        <div className="empty-sub">No recent activity yet</div>
      ) : (
        notifications.slice(0, 6).map((item) => (
          <div
            key={item._id}
            className="activity-row"
            onClick={() => handleClick(item)}
            style={{
              cursor: 'pointer',
              background: item.isRead
                ? 'transparent'
                : 'rgba(79,70,229,0.08)',
              borderRadius: 8,
              padding: 8,
              marginBottom: 4,
              transition: 'all 0.2s',
            }}
          >
            <div className="activity-dot" />

            <div style={{ flex: 1 }}>
              <div className="activity-title">
                {item.title}
              </div>

              <div className="activity-sub">
                {item.message}
              </div>

              <div
                style={{
                  fontSize: 9,
                  color: 'var(--text3)',
                  marginTop: 4,
                }}
              >
                {formatTimeAgo(item.createdAt)}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ActivityLog;