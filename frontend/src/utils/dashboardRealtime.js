export const DASHBOARD_EVENTS_KEY = 'paia_dashboard_events_v1';
export const DASHBOARD_UPDATE_EVENT = 'paia:dashboard-update';

const MAX_EVENTS = 100;

const toArray = (raw) => {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getDashboardEvents = () => toArray(localStorage.getItem(DASHBOARD_EVENTS_KEY));

export const publishDashboardEvent = (payload) => {
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const current = getDashboardEvents();
  const updated = [event, ...current].slice(0, MAX_EVENTS);

  localStorage.setItem(DASHBOARD_EVENTS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent(DASHBOARD_UPDATE_EVENT, { detail: event }));

  return event;
};
