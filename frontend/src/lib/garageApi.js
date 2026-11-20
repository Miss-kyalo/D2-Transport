import api from '../api';
import { enqueueAction } from './offlineQueue';

const GARAGE_PATH = '/garage';

function createIdempotencyKey() {
    return globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(error, fallback) {
    return error.response?.data?.error || error.message || fallback;
}

async function request(method, path, payload, { queueWhenOffline = false, idempotent = false } = {}) {
    const body = payload ? { ...payload } : undefined;
    if (idempotent && !body.idempotency_key) {
        body.idempotency_key = createIdempotencyKey();
    }

    try {
        const response = await api.request({
            method,
            url: `${GARAGE_PATH}${path}`,
            data: body
        });
        return response.data;
    } catch (error) {
        if (queueWhenOffline && !error.response && globalThis.navigator?.onLine === false) {
            const baseUrl = String(api.defaults.baseURL || '/api').replace(/\/$/, '');
            const queued = enqueueAction({
                url: `${baseUrl}${GARAGE_PATH}${path}`,
                method,
                payload: body
            });
            return { queued: true, queue_id: queued.id };
        }
        throw new Error(errorMessage(error, 'Garage request failed.'), { cause: error });
    }
}

export function fetchJobCard(jobCardId) {
    return request('get', `/job-cards/${jobCardId}`);
}

export function createJobPin(jobCardId, payload) {
    return request('post', `/job-cards/${jobCardId}/pins`, payload, {
        queueWhenOffline: true,
        idempotent: true
    });
}

export function reserveJobPart(jobCardId, payload) {
    return request('post', `/job-cards/${jobCardId}/reserve-part`, payload, {
        queueWhenOffline: true,
        idempotent: true
    });
}

export function issueJobPart(jobCardId, payload) {
    return request('post', `/job-cards/${jobCardId}/issue-part`, payload, {
        queueWhenOffline: true,
        idempotent: true
    });
}

export function returnJobCore(jobCardId, payload) {
    return request('post', `/job-cards/${jobCardId}/return-core`, payload, {
        queueWhenOffline: true,
        idempotent: true
    });
}

export function updateJobStatus(jobCardId, nextStatus) {
    return request('patch', `/job-cards/${jobCardId}/status`, {
        next_status: nextStatus
    });
}

export function buildQuotePreview(jobCardId, payload) {
    return request('post', `/job-cards/${jobCardId}/quote-preview`, payload);
}

export function inspectGarageImage(payload) {
    return request('post', '/ai/inspect-image', payload);
}
