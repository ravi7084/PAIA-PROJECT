import { createContext, useContext, useState, useEffect } from 'react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const now = new Date();

    const dummy = [
      {
        _id: '1',
        title: 'Welcome to PAIA',
        message: 'Your account has been successfully created.',
        isRead: false,
        link: '/dashboard',
        createdAt: now,
        type: 'info',
      },
      {
        _id: '2',
        title: 'Security Notice',
        message: 'Enable email verification for better security.',
        isRead: false,
        link: '/profile',
        createdAt: new Date(now.getTime() - 1000 * 60 * 5),
        type: 'warning',
      },
      {
        _id: '3',
        title: 'System Ready',
        message: 'Authentication system is active.',
        isRead: true,
        link: '/dashboard',
        createdAt: new Date(now.getTime() - 1000 * 60 * 30),
        type: 'success',
      },
    ];

    setNotifications(dummy);
  }, []);

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n._id === id ? { ...n, isRead: true } : n
      )
    );
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        setNotifications,
        markAsRead,
        unreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);