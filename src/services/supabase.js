import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

// Get Supabase credentials from environment (support both EXPO_PUBLIC_ and NEXT_PUBLIC_ prefixes)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Log for debugging (remove in production)
if (supabaseUrl === 'https://placeholder.supabase.co') {
    console.warn('Supabase credentials not found. Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env file');
}

// Create Supabase client with AsyncStorage for session persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Helper to get public URL for storage files
export const getStorageUrl = (bucketName, filePath) => {
    if (!filePath) return null;
    // If it's already a full URL, return as is
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return filePath;
    }
    // Construct Supabase storage public URL
    return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
};

// Helper to get vendor logo URL
export const getVendorImageUrl = (logoPath, vendorName = 'Vendor') => {
    if (!logoPath) {
        // Return a generated avatar if no logo
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(vendorName)}&background=FF4117&color=fff&size=200`;
    }
    // If it's already a full URL, return as is
    if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
        return logoPath;
    }
    // Construct Supabase storage URL (assuming bucket is 'ekatraa2025' or similar)
    return `${supabaseUrl}/storage/v1/object/public/ekatraa2025/${logoPath}`;
};

/** Returns full URL for a service image (storage path or full URL). Returns null if no path (caller can hide image). */
export const getServiceImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    return `${supabaseUrl}/storage/v1/object/public/ekatraa2025/${imagePath}`;
};

const STORAGE_PATH_RE = /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/;
const apiBase = process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || '';

/** Resolves a storage path (or full Supabase URL) to a signed URL via the backend. Returns null if no path. */
export const resolveStorageUrl = async (pathOrUrl) => {
    if (!pathOrUrl) return null;
    let storagePath = pathOrUrl;
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
        const match = pathOrUrl.match(STORAGE_PATH_RE);
        if (!match) return pathOrUrl;
        storagePath = match[1];
    }
    if (apiBase) {
        try {
            const res = await fetch(`${apiBase}/api/public/storage/signed-url?path=${encodeURIComponent(storagePath)}`);
            const json = await res.json();
            if (json?.url) return json.url;
        } catch (_) { /* fall through */ }
    }
    try {
        const { data, error } = await supabase.storage
            .from('ekatraa2025')
            .createSignedUrl(storagePath, 3600);
        if (!error && data?.signedUrl) return data.signedUrl;
    } catch (_) { /* fall through */ }
    return `${supabaseUrl}/storage/v1/object/public/ekatraa2025/${storagePath}`;
};

// Auth helper functions
export const authService = {
    // Send OTP to phone number
    async sendOtp(phone) {
        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
        const { data, error } = await supabase.auth.signInWithOtp({
            phone: formattedPhone,
        });
        return { data, error };
    },

    // Verify OTP
    async verifyOtp(phone, token) {
        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
        const { data, error } = await supabase.auth.verifyOtp({
            phone: formattedPhone,
            token,
            type: 'sms',
        });
        return { data, error };
    },

    // Google OAuth — Expo: in-app browser + deep link (matches app.json scheme `ekatraa`, host `auth-callback` on Android)
    async signInWithGoogle() {
        try {
            const redirectTo = Linking.createURL('auth-callback');
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                },
            });

            if (error) return { data: null, error };
            if (!data?.url) return { data: null, error: { message: 'Could not start Google sign-in.' } };

            const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

            if (result.type !== 'success' || !result.url) {
                return {
                    data: null,
                    error:
                        result.type === 'cancel' || result.type === 'dismiss'
                            ? { silent: true, message: 'CANCELLED' }
                            : { message: 'Google sign-in was cancelled or failed.' },
                };
            }

            const callbackUrl = result.url;
            let code = null;
            let access_token = null;
            let refresh_token = '';
            try {
                const u = new URL(callbackUrl);
                code = u.searchParams.get('code');
                const hash = (u.hash && u.hash.length > 1) ? u.hash.substring(1) : '';
                if (hash) {
                    const sp = new URLSearchParams(hash);
                    access_token = sp.get('access_token');
                    refresh_token = sp.get('refresh_token') || '';
                }
            } catch {
                /* fall through */
            }

            if (code) {
                const exchanged = await supabase.auth.exchangeCodeForSession(code);
                if (exchanged.error) return { data: null, error: exchanged.error };
                return { data: exchanged.data, error: null };
            }

            if (!access_token && callbackUrl.includes('access_token=')) {
                const m = callbackUrl.match(/access_token=([^&]+)/);
                if (m) access_token = decodeURIComponent(m[1]);
                const mr = callbackUrl.match(/refresh_token=([^&]+)/);
                if (mr) refresh_token = decodeURIComponent(mr[1]);
            }

            if (!access_token) {
                return {
                    data: null,
                    error: {
                        message:
                            'Could not complete Google sign-in. Add this redirect URL in Supabase Auth → URL Configuration: ' +
                            String(Linking.createURL('auth-callback')),
                    },
                };
            }

            const sessionRes = await supabase.auth.setSession({ access_token, refresh_token });
            if (sessionRes.error) return { data: null, error: sessionRes.error };
            return { data: sessionRes.data, error: null };
        } catch (error) {
            console.error('Google OAuth error:', error);
            return {
                data: null,
                error: { message: error?.message || 'Google sign-in failed. Please try again or use OTP.' },
            };
        }
    },

    // Sign out
    async signOut() {
        const { error } = await supabase.auth.signOut();
        return { error };
    },

    // Get current session
    async getSession() {
        const { data: { session }, error } = await supabase.auth.getSession();
        return { session, error };
    },

    // Get current user
    async getUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        return { user, error };
    },

    // Listen to auth state changes
    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange(callback);
    },
};

// Database service functions - Updated for flexible vendor queries
export const dbService = {
    // Fetch vendors by location (city and/or state) and service category
    async getVendors({ city, state, serviceCategory, limit = 20 }) {
        let query = supabase
            .from('vendors')
            .select(`
                *,
                services (*)
            `);

        if (city) {
            query = query.ilike('city', `%${city}%`);
        }
        if (state) {
            query = query.ilike('state', `%${state}%`);
        }
        if (serviceCategory) {
            query = query.ilike('category', `%${serviceCategory}%`);
        }

        query = query.limit(limit);

        const { data, error } = await query;
        return { data, error };
    },

    // Fetch venues from Supabase
    async getVenues({ city, eventType, limit = 20 }) {
        let query = supabase
            .from('venues')
            .select('*')
            .eq('is_active', true);

        if (city) {
            query = query.ilike('city', `%${city}%`);
        }

        if (eventType && eventType !== 'all') {
            query = query.contains('event_types', [eventType]);
        }

        query = query.limit(limit);

        const { data, error } = await query;
        return { data, error };
    },

    // Fetch service categories
    async getServiceCategories() {
        const { data, error } = await supabase
            .from('vendor_categories')
            .select('*')
            .order('name');
        return { data, error };
    },

    // Fetch event types (get-together types with icon, color, image_url from admin)
    async getEventTypes() {
        const { data, error } = await supabase
            .from('event_types')
            .select('*')
            .eq('is_active', true)
            .order('display_order');
        return { data, error };
    },

    // Fetch occasions from the occasions table (new flow)
    async getOccasions() {
        const { data, error } = await supabase
            .from('occasions')
            .select('id, name, icon, icon_url, display_order')
            .eq('is_active', true)
            .order('display_order', { ascending: true });
        return { data, error };
    },

    // Fetch categories for an occasion (via occasion_categories join table)
    async getCategoriesByOccasion(occasionId) {
        if (!occasionId) {
            const { data, error } = await supabase
                .from('categories')
                .select('id, name, icon_url, display_order')
                .eq('is_active', true)
                .order('display_order', { ascending: true });
            return { data, error };
        }
        const { data, error } = await supabase
            .from('occasion_categories')
            .select('category_id, categories(id, name, icon_url, display_order)')
            .eq('occasion_id', occasionId)
            .order('display_order', { ascending: true });
        if (error) return { data: null, error };
        const list = (data ?? []).flatMap(row =>
            Array.isArray(row.categories) ? row.categories : row.categories ? [row.categories] : []
        );
        return { data: list, error: null };
    },

    // Fetch app service catalog by event type (services shown per get-together type, configurable in admin)
    async getAppServicesByEventType(eventType) {
        let query = supabase
            .from('app_service_catalog')
            .select('*')
            .eq('is_active', true)
            .order('display_order');
        if (eventType && eventType !== 'all') {
            query = query.contains('event_types', [eventType]);
        }
        const { data, error } = await query;
        return { data: data || [], error };
    },

    // Submit enquiry
    async submitEnquiry(enquiryData) {
        const { data, error } = await supabase
            .from('enquiries')
            .insert([enquiryData])
            .select()
            .single();
        return { data, error };
    },

    // Submit booking request
    async submitBooking(bookingData) {
        const { data, error } = await supabase
            .from('bookings')
            .insert([bookingData])
            .select()
            .single();
        return { data, error };
    },

    // Get user's bookings
    async getUserBookings(userId) {
        const { data, error } = await supabase
            .from('bookings')
            .select(`
                *,
                vendor:vendors(business_name, logo_url, phone),
                service:services(name, price_amount)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return { data, error };
    },

    // Get user's enquiries
    async getUserEnquiries(userId) {
        const { data, error } = await supabase
            .from('enquiries')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return { data, error };
    },

    // Update user profile
    async updateUserProfile(userId, profileData) {
        const { data, error } = await supabase
            .from('user_profiles')
            .upsert({
                id: userId,
                ...profileData,
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();
        return { data, error };
    },

    // Get user profile
    async getUserProfile(userId) {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
        return { data, error };
    },

    // Get cities
    async getCities() {
        const { data, error } = await supabase
            .from('cities')
            .select('*')
            .eq('is_active', true)
            .order('name');
        return { data, error };
    },

    // Get banner ads (success stories, events, promotions)
    async getBanners() {
        const { data, error } = await supabase
            .from('banners')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });
        return { data, error };
    },

    // Get vendors by service category - v4 with proper filtering (city and/or state)
    async getVendorsByService({ serviceCategory, city, state, limit = 80 }) {
        try {
            console.log('[VENDORS-V4] Starting fetch for:', serviceCategory, 'in', city, state ? `state: ${state}` : '');
            
            // Fetch all vendors with their services
            let query = supabase
                .from('vendors')
                .select(`
                    id, 
                    business_name, 
                    owner_name, 
                    category, 
                    description, 
                    phone, 
                    email, 
                    address, 
                    city, 
                    state,
                    logo_url, 
                    status, 
                    is_verified, 
                    created_at,
                    services (
                        id,
                        name,
                        description,
                        price_amount,
                        price_unit,
                        base_price,
                        image_url
                    )
                `)
                .limit(limit);
            if (city) query = query.ilike('city', `%${city}%`);
            // Do NOT filter by state in query - vendors with null state would be excluded; filter in JS instead

            const { data: allVendors, error: fetchError } = await query;

            if (fetchError) {
                console.log('[VENDORS-V4] Fetch error:', fetchError.message);
                return { data: [], error: fetchError };
            }

            console.log('[VENDORS-V4] Raw fetch:', allVendors?.length || 0, 'vendors');

            // Filter by service category
            let filteredVendors = allVendors || [];
            
            if (serviceCategory && filteredVendors.length > 0) {
                const searchTerm = serviceCategory.toLowerCase().trim();
                const searchStem = searchTerm.slice(0, 4);
                filteredVendors = filteredVendors.filter(v => {
                    const cat = (v.category || '').toLowerCase();
                    const categoryMatch = cat && (cat.includes(searchTerm) || searchTerm.includes(cat) || cat.slice(0, 4) === searchStem || searchStem === cat.slice(0, 4));
                    const serviceMatch = Array.isArray(v.services) && v.services.some(svc =>
                        (svc.name || '').toLowerCase().includes(searchTerm) || searchTerm.includes((svc.name || '').toLowerCase())
                    );
                    return categoryMatch || serviceMatch;
                });
                // Only show vendors that match this service type; do not fall back to all vendors
                console.log('[VENDORS-V4] After category filter:', filteredVendors.length, 'vendors');
            }
            
            // Filter by city if provided (when not already filtered by city in query)
            if (city && filteredVendors.length > 0) {
                const cityTerm = city.toLowerCase();
                const cityFiltered = filteredVendors.filter(v => 
                    v.city?.toLowerCase().includes(cityTerm) ||
                    v.address?.toLowerCase().includes(cityTerm)
                );
                
                // Only apply city filter if it returns results
                if (cityFiltered.length > 0) {
                    filteredVendors = cityFiltered;
                }
                console.log('[VENDORS-V4] After city filter:', filteredVendors.length, 'vendors');
            }
            if (state && filteredVendors.length > 0) {
                const stateTerm = state.toLowerCase();
                const stateFiltered = filteredVendors.filter(v => !v.state || v.state.toLowerCase().includes(stateTerm));
                if (stateFiltered.length > 0) filteredVendors = stateFiltered;
            }

            // Return empty array if no matches - don't show all vendors
            console.log('[VENDORS-V4] Final result:', filteredVendors.length, 'vendors for', serviceCategory);
            return { data: filteredVendors, error: null };
        } catch (err) {
            console.error('[VENDORS-V4] Error:', err);
            return { data: [], error: err };
        }
    },

    // Create booking with all details
    async createBooking(bookingData) {
        const { data, error } = await supabase
            .from('user_bookings')
            .insert([{
                ...bookingData,
                status: 'pending',
                created_at: new Date().toISOString(),
            }])
            .select()
            .single();
        return { data, error };
    },

    // Update booking status
    async updateBookingStatus(bookingId, status) {
        const { data, error } = await supabase
            .from('user_bookings')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', bookingId)
            .select()
            .single();
        return { data, error };
    },

    // Get all bookings for a user with vendor details
    async getAllUserBookings(userId) {
        const { data, error } = await supabase
            .from('user_bookings')
            .select(`
                *,
                vendor:vendors(id, business_name, logo_url, phone, category)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return { data, error };
    },

    // Get public URL for storage files (synchronous helper)
    getPublicUrl(bucketName, filePath) {
        if (!filePath) return null;
        // If it's already a full URL, return as is
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            return filePath;
        }
        // Construct Supabase storage public URL
        return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
    },

    // Get vendor services
    async getVendorServices(vendorId) {
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .eq('vendor_id', vendorId);
        return { data, error };
    },

    // Get single vendor with all services and details (for VendorDetail page)
    async getVendorById(vendorId) {
        const { data, error } = await supabase
            .from('vendors')
            .select('*, services(*)')
            .eq('id', vendorId)
            .single();
        return { data, error };
    },
};

export default supabase;
