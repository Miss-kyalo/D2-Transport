import api from '../api';

export async function downloadDocument(path) {
    if (typeof path !== 'string' || !/^\/uploads\/(?:depot\/)?[^/\\?#]+$/.test(path)) {
        throw new Error('Unsupported document location.');
    }
    const origin = new URL(api.defaults.baseURL, window.location.origin).origin;
    const response = await api.get(new URL(path, origin).href, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/octet-stream' }));
    try {
        const link = document.createElement('a');
        link.href = url;
        link.download = decodeURIComponent(path.split('/').pop());
        document.body.appendChild(link);
        link.click();
        link.remove();
    } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
