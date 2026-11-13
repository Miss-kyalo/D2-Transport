import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Expired or invalid token: clear the session and go back to login
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const status = err.response?.status;
        const isLoginCall = err.config?.url?.startsWith('/auth/');
        const message = err.response?.data?.error;
        if ((status === 401 || status === 403) && !isLoginCall && typeof message === 'string' && /token/i.test(message)) {
            localStorage.clear();
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default api;
