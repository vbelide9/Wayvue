import { api } from './api';

const STORAGE_KEY_USER_ID = 'wayvue_analytics_user_id';
const STORAGE_KEY_ADMIN_TOKEN = 'wayvue_admin_token';

// Helper to get or create anonymous user ID
const getUserId = () => {
    let userId = localStorage.getItem(STORAGE_KEY_USER_ID);
    if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY_USER_ID, userId);
    }
    return userId;
};

export const AnalyticsService = {
    // Log an event
    logEvent: async (eventType: string, metadata: any = {}) => {
        try {
            const userId = getUserId();
            const payload = {
                userId,
                eventType,
                metadata,
                timestamp: new Date().toISOString()
            };

            // Use fetch with keepalive for reliability during page unload/navigation
            // Axios cancels requests on unload, but keepalive ensures they complete
            await fetch('/api/analytics/event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                keepalive: true
            });
        } catch (error) {
            console.error('Failed to log analytics event', error);
            // Fail silently to not disrupt user experience
        }
    },

    // Log Click Event (Convenience wrapper)
    trackClick: (elementId: string, metadata: any = {}) => {
        AnalyticsService.logEvent('click', { elementId, ...metadata });
    },

    // Log Performance Metric
    trackPerformance: (metricName: string, value: number, metadata: any = {}) => {
        AnalyticsService.logEvent('performance', { metric: metricName, value, ...metadata });
    },

    // Track User Location
    trackUserLocation: async () => {
        // Check if location is already cached in session to avoid spamming API
        if (sessionStorage.getItem('user_location_logged')) return;

        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            if (data.error) return;

            AnalyticsService.logEvent('user_location', {
                city: data.city,
                region: data.region,
                country: data.country_name,
                ip: data.ip // Optional: be careful with PII regulations
            });
            sessionStorage.setItem('user_location_logged', 'true');
        } catch (error) {
            console.error('Failed to fetch user location:', error);
        }
    },

    // Track Session
    trackSessionStart: () => {
        sessionStorage.setItem('session_start', Date.now().toString());
        AnalyticsService.logEvent('session_start', {});
    },

    trackSessionEnd: () => {
        const start = sessionStorage.getItem('session_start');
        if (start) {
            const duration = (Date.now() - parseInt(start)) / 1000; // in seconds
            AnalyticsService.logEvent('session_end', { duration });
            sessionStorage.removeItem('session_start');
        }
    },

    // Track Device Type
    trackDevice: () => {
        // if (sessionStorage.getItem('device_logged')) return;
        const width = window.innerWidth;
        const deviceType = width < 768 ? 'Mobile' : 'Desktop';
        AnalyticsService.logEvent('device_info', { deviceType, screenWidth: width });
        sessionStorage.setItem('device_logged', 'true');
    },

    // Track Retention
    trackRetention: () => {
        // if (sessionStorage.getItem('retention_logged')) return;
        const lastVisit = localStorage.getItem('last_visit');
        const now = Date.now();
        const isReturning = !!lastVisit;

        AnalyticsService.logEvent('user_retention', {
            isReturning,
            daysSinceLastVisit: lastVisit ? Math.floor((now - parseInt(lastVisit)) / (1000 * 60 * 60 * 24)) : 0
        });

        localStorage.setItem('last_visit', now.toString());
        sessionStorage.setItem('retention_logged', 'true');
    },

    // Track Error
    trackError: (errorType: string, message: string) => {
        AnalyticsService.logEvent('error', { errorType, message });
    },

    // Get analytics data (Admin)
    getAnalytics: async (password: string) => {
        const response = await api.get('/analytics', {
            headers: {
                'x-admin-password': password
            }
        });
        return response.data;
    },

    // Save admin password locally for convenience
    setAdminToken: (token: string) => {
        localStorage.setItem(STORAGE_KEY_ADMIN_TOKEN, token);
    },

    getAdminToken: () => {
        return localStorage.getItem(STORAGE_KEY_ADMIN_TOKEN);
    },

    clearAdminToken: () => {
        localStorage.removeItem(STORAGE_KEY_ADMIN_TOKEN);
    }
};
