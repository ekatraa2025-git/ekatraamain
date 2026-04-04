/**
 * Backend API client for Ekatraa app.
 * When EXPO_PUBLIC_API_URL is set, uses new flow: occasions → categories → services → cart → checkout → orders.
 */
const API_BASE = process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
const REQUEST_TIMEOUT_MS = 15000;

/** Ensures error messages are strings (APIs sometimes return nested objects). */
function stringifyApiError(raw) {
    let msg = '';
    if (raw == null) msg = '';
    else if (typeof raw === 'string') msg = raw;
    else if (typeof raw === 'object') {
        if (typeof raw.message === 'string') msg = raw.message;
        else if (typeof raw.error === 'string') msg = raw.error;
        else if (raw.error && typeof raw.error === 'object' && typeof raw.error.message === 'string') {
            msg = raw.error.message;
        } else {
            const keys = Object.keys(raw);
            if (keys.length === 1 && typeof raw.model === 'string') {
                msg = 'Could not complete this request. Check the app backend and AI settings.';
            } else {
                try {
                    msg = JSON.stringify(raw);
                } catch {
                    msg = 'Request failed';
                }
            }
        }
    } else msg = String(raw);
    return msg || 'Request failed';
}

function buildError(e) {
    const msg = (e && e.message) || 'Network error';
    if (msg === 'Network request failed' || msg === 'Failed to fetch') {
        return 'Cannot reach server. Ensure the backend is running and .env EXPO_PUBLIC_API_URL is correct (use 10.0.2.2:3000 for Android emulator).';
    }
    return msg;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

/** Coalesce identical in-flight GETs so parallel mounts do not duplicate network work. */
const inflightGet = new Map();

/** Short-lived GET response cache (TTL per path). Invalidated on successful mutations. */
const getResponseCache = new Map();

function pathOnlyFromUrl(url) {
    try {
        if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
            return new URL(url).pathname;
        }
    } catch {
        /* fall through */
    }
    const q = url.indexOf('?');
    const noQuery = q >= 0 ? url.slice(0, q) : url;
    const api = noQuery.indexOf('/api/');
    return api >= 0 ? noQuery.slice(api) : noQuery;
}

function getCacheTtlMsForPath(pathname) {
    if (pathname.includes('/api/public/cart')) return 0;
    if (pathname.includes('/api/public/orders')) return 0;
    if (pathname.includes('/api/public/guests')) return 0;
    if (pathname.includes('/api/public/gifts')) return 0;
    if (pathname.includes('/api/public/recommendations')) return 0;
    if (pathname.includes('/api/public/budget-recommendation-snapshots')) return 0;
    if (pathname.includes('/api/translations')) return 30 * 60 * 1000;
    if (pathname.includes('/api/public/config/maps')) return 30 * 60 * 1000;
    if (pathname.includes('/api/public/banners')) return 15 * 60 * 1000;
    if (pathname.includes('/api/public/testimonials')) return 15 * 60 * 1000;
    if (pathname.includes('/api/public/occasions') || pathname.includes('/api/public/event-types')) return 10 * 60 * 1000;
    if (pathname.includes('/api/public/categories')) return 10 * 60 * 1000;
    if (pathname.includes('/api/public/special-services')) return 10 * 60 * 1000;
    if (pathname.includes('/api/public/venues/featured')) return 5 * 60 * 1000;
    if (pathname.includes('/api/public/booking-protection')) return 5 * 60 * 1000;
    if (pathname.includes('/api/public/services')) return 5 * 60 * 1000;
    return 60 * 1000;
}

function cloneApiResult(result) {
    try {
        return JSON.parse(JSON.stringify(result));
    } catch {
        return result;
    }
}

export function invalidateAllGetCache() {
    getResponseCache.clear();
}

/** Only clear caches after mutations that affect user/cart/order data — not AI/chat reads. */
function shouldInvalidateCacheForMutation(path) {
    const p = String(path || '').toLowerCase();
    if (p.includes('/api/public/ai/')) return false;
    if (p.includes('/api/public/recommendations/narrative')) return false;
    if (p.includes('/api/public/invitations/generate')) return false;
    return (
        p.includes('/cart') ||
        p.includes('/guests') ||
        p.includes('/gifts') ||
        p.includes('/orders') ||
        p.includes('/checkout') ||
        p.includes('/payment/') ||
        p.includes('/quotation')
    );
}

async function get(path, params = {}) {
    if (!API_BASE) return { data: null, error: { message: 'API URL not configured. Set EXPO_PUBLIC_API_URL in .env' } };
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${API_BASE}${path}?${qs}` : `${API_BASE}${path}`;
    const pathname = pathOnlyFromUrl(url);
    const ttl = getCacheTtlMsForPath(pathname);
    if (ttl > 0) {
        const hit = getResponseCache.get(url);
        if (hit && hit.expires > Date.now() && hit.result && !hit.result.error) {
            return Promise.resolve(cloneApiResult(hit.result));
        }
    }
    if (inflightGet.has(url)) return inflightGet.get(url);

    const promise = (async () => {
        try {
            const res = await fetchWithTimeout(url);
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const msg = stringifyApiError(data?.error) || res.statusText;
                return { data: null, error: { message: msg } };
            }
            const result = { data, error: null };
            if (ttl > 0) {
                getResponseCache.set(url, { result, expires: Date.now() + ttl });
            }
            return result;
        } catch (e) {
            return { data: null, error: { message: buildError(e) } };
        } finally {
            inflightGet.delete(url);
        }
    })();

    inflightGet.set(url, promise);
    return promise;
}

const inflightGetAuth = new Map();

/** GET with Supabase session access token (saved recommendations, etc.). */
async function getWithAuth(path, params = {}, accessToken) {
    if (!API_BASE) return { data: null, error: { message: 'API URL not configured. Set EXPO_PUBLIC_API_URL in .env' } };
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${API_BASE}${path}?${qs}` : `${API_BASE}${path}`;
    const cacheKey = `${url}\0${accessToken || ''}`;
    if (inflightGetAuth.has(cacheKey)) return inflightGetAuth.get(cacheKey);

    const promise = (async () => {
        const headers = {};
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
        try {
            const res = await fetchWithTimeout(url, { headers });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const msg = stringifyApiError(data?.error) || res.statusText;
                return { data: null, error: { message: msg } };
            }
            return { data, error: null };
        } catch (e) {
            return { data: null, error: { message: buildError(e) } };
        } finally {
            inflightGetAuth.delete(cacheKey);
        }
    })();

    inflightGetAuth.set(cacheKey, promise);
    return promise;
}

async function post(path, body = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    if (!API_BASE) return { data: null, error: { message: 'API URL not configured. Set EXPO_PUBLIC_API_URL in .env' } };
    try {
        const res = await fetchWithTimeout(`${API_BASE}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }, timeoutMs);
        const contentType = res.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
            ? await res.json().catch(() => null)
            : null;
        if (!res.ok) {
            const msg =
                stringifyApiError(data?.error) ||
                (res.status === 404
                    ? 'Endpoint not found. Ensure backend is deployed with payment routes.'
                    : res.statusText);
            return { data: null, error: { message: msg } };
        }
        if (shouldInvalidateCacheForMutation(path)) invalidateAllGetCache();
        return { data, error: null };
    } catch (e) {
        return { data: null, error: { message: buildError(e) } };
    }
}

async function patch(path, body = {}) {
    if (!API_BASE) return { data: null, error: { message: 'API URL not configured. Set EXPO_PUBLIC_API_URL in .env' } };
    try {
        const res = await fetchWithTimeout(`${API_BASE}${path}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const msg = stringifyApiError(data?.error) || res.statusText;
            return { data: null, error: { message: msg } };
        }
        if (shouldInvalidateCacheForMutation(path)) invalidateAllGetCache();
        return { data, error: null };
    } catch (e) {
        return { data: null, error: { message: buildError(e) } };
    }
}

/** PATCH with Supabase access token (order quotation accept/reject, etc.). */
async function patchWithAuth(path, body = {}, accessToken) {
    if (!API_BASE) return { data: null, error: { message: 'API URL not configured. Set EXPO_PUBLIC_API_URL in .env' } };
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
        const res = await fetchWithTimeout(`${API_BASE}${path}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const msg = stringifyApiError(data?.error) || res.statusText;
            return { data: null, error: { message: msg } };
        }
        if (shouldInvalidateCacheForMutation(path)) invalidateAllGetCache();
        return { data, error: null };
    } catch (e) {
        return { data: null, error: { message: buildError(e) } };
    }
}

async function del(path) {
    if (!API_BASE) return { data: null, error: { message: 'API URL not configured. Set EXPO_PUBLIC_API_URL in .env' } };
    try {
        const res = await fetchWithTimeout(`${API_BASE}${path}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = stringifyApiError(data?.error) || res.statusText;
            return { data: null, error: { message: msg } };
        }
        if (shouldInvalidateCacheForMutation(path)) invalidateAllGetCache();
        return { data: data || {}, error: null };
    } catch (e) {
        return { data: null, error: { message: buildError(e) } };
    }
}

export const api = {
    // Legacy (still used when backend is on)
    async getBanners() {
        return get('/api/public/banners');
    },
    async getFeaturedVenues(city, limit = 10) {
        return get('/api/public/venues/featured', city ? { city, limit: String(limit) } : { limit: String(limit) });
    },
    async getEventTypes() {
        return get('/api/public/event-types');
    },
    async getServicesByEventType(eventType) {
        return get('/api/public/services', eventType ? { eventType } : {});
    },

    // New flow: occasions → categories → services
    async getOccasions() {
        return get('/api/public/occasions');
    },
    async getCategories(occasionId) {
        return get('/api/public/categories', occasionId ? { occasion_id: occasionId } : {});
    },
    async getMapsConfig() {
        return get('/api/public/config/maps');
    },
    async getSpecialServices() {
        return get('/api/public/special-services');
    },
    async getVendorsPreview(params = {}) {
        const q = {};
        if (params.occasion_id) q.occasion_id = params.occasion_id;
        if (params.city) q.city = params.city;
        if (params.limit) q.limit = params.limit;
        return get('/api/public/vendors/preview', q);
    },
    async getTestimonials() {
        return get('/api/public/testimonials');
    },
    async getServices(params = {}) {
        const q = {};
        if (params.occasion_id) q.occasion_id = params.occasion_id;
        if (params.category_id) q.category_id = params.category_id;
        if (params.city) q.city = params.city;
        if (params.search) q.search = params.search;
        return get('/api/public/services', q);
    },
    /**
     * @param {string} occasionId
     * @param {string | number | { budget?: string, budget_inr?: number, category_weights?: Record<string, number> }} budgetOrOpts
     */
    async getRecommendations(occasionId, budgetOrOpts) {
        const q = { occasion_id: occasionId };
        if (budgetOrOpts != null && typeof budgetOrOpts === 'object' && !Array.isArray(budgetOrOpts)) {
            if (budgetOrOpts.budget_inr != null) q.budget_inr = String(budgetOrOpts.budget_inr);
            if (budgetOrOpts.budget) q.budget = budgetOrOpts.budget;
            if (budgetOrOpts.category_weights && Object.keys(budgetOrOpts.category_weights).length > 0) {
                q.category_weights = JSON.stringify(budgetOrOpts.category_weights);
            }
        } else {
            q.budget = String(budgetOrOpts);
        }
        return get('/api/public/recommendations', q);
    },
    async postRecommendationNarrative(body) {
        return post('/api/public/recommendations/narrative', body, 45000);
    },
    async postAiChat(body) {
        return post('/api/public/ai/chat', body, 45000);
    },
    async postBudgetRecommendationSnapshot(body) {
        return post('/api/public/budget-recommendation-snapshots', body);
    },
    /** @param {string} accessToken - Supabase session access_token */
    async getBudgetRecommendationSnapshots(accessToken, params = {}) {
        return getWithAuth('/api/public/budget-recommendation-snapshots', params, accessToken);
    },
    /** @param {string} accessToken */
    async getBudgetRecommendationSnapshot(id, accessToken) {
        return getWithAuth(`/api/public/budget-recommendation-snapshots/${id}`, {}, accessToken);
    },

    // Cart
    async createCart(body) {
        return post('/api/public/cart', body);
    },
    async getCart(cartId) {
        return get(`/api/public/cart/${cartId}`);
    },
    async updateCart(cartId, body) {
        return patch(`/api/public/cart/${cartId}`, body);
    },
    async addCartItem(body) {
        return post('/api/public/cart/items', body);
    },
    async updateCartItem(itemId, body) {
        return patch(`/api/public/cart/items/${itemId}`, body);
    },
    async removeCartItem(itemId) {
        return del(`/api/public/cart/items/${itemId}`);
    },

    /** Public booking protection pricing config (admin-managed). */
    async getBookingProtection() {
        return get('/api/public/booking-protection');
    },

    // Checkout & orders
    async checkout(body) {
        return post('/api/public/checkout', body);
    },
    async createPaymentOrder(body) {
        return post('/api/public/payment/create-order', body);
    },
    async verifyPayment(body) {
        return post('/api/public/payment/verify', body);
    },
    async getOrders(userId) {
        return get('/api/public/orders', { user_id: userId });
    },
    /**
     * Order detail (items, quotes, history, OTPs). Backend requires Authorization: Bearer access_token.
     * @param {string} orderId
     * @param {string} [accessToken] - Supabase session access_token
     */
    async getOrder(orderId, accessToken) {
        if (!accessToken) {
            return { data: null, error: { message: 'Sign in to view order details.' } };
        }
        return getWithAuth(`/api/public/orders/${orderId}`, {}, accessToken);
    },
    /**
     * @param {string} accessToken - Supabase session access_token
     */
    async acceptQuotation(orderId, quotationId, action, accessToken) {
        if (!accessToken) {
            return { data: null, error: { message: 'Sign in to continue.' } };
        }
        return patchWithAuth(`/api/public/orders/${orderId}/quotation/${quotationId}`, { action }, accessToken);
    },
    async createBalancePaymentOrder(body) {
        return post('/api/public/payment/create-balance-order', body);
    },
    async verifyBalancePayment(body) {
        return post('/api/public/payment/verify-balance', body);
    },

    // Guests
    async getGuests(userId) {
        return get('/api/public/guests', { user_id: userId });
    },
    async addGuest(body) {
        return post('/api/public/guests', body);
    },
    async updateGuest(guestId, body) {
        return patch(`/api/public/guests/${guestId}`, body);
    },
    async deleteGuest(guestId) {
        return del(`/api/public/guests/${guestId}`);
    },
    async bulkImportGuests(body) {
        return post('/api/public/guests/bulk', body);
    },

    /** Public app copy (en / hi / or) from admin translations. */
    async getTranslations() {
        return get('/api/translations');
    },

    /** Claude-powered invitation samples or final text. */
    async generateInvitation(body) {
        return post('/api/public/invitations/generate', body, 90000);
    },

    // Gifts
    async getGifts(userId) {
        return get('/api/public/gifts', { user_id: userId });
    },
    async addGift(body) {
        return post('/api/public/gifts', body);
    },
    async deleteGift(giftId) {
        return del(`/api/public/gifts/${giftId}`);
    },
};

export const useBackendApi = () => !!API_BASE;
