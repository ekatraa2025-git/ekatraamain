import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

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

    // Google OAuth sign in
    async signInWithGoogle() {
        try {
            // Use Supabase's built-in OAuth with redirect
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: 'ekatraa://auth/callback',
                    skipBrowserRedirect: false,
                }
            });
            
            if (error) {
                return { data: null, error };
            }
            
            return { data, error: null };
        } catch (error) {
            console.error('Google OAuth error:', error);
            return { 
                data: null, 
                error: { message: 'Google sign-in failed. Please try again or use OTP.' } 
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
    // Fetch vendors by location and service category
    async getVendors({ city, serviceCategory, limit = 20 }) {
        let query = supabase
            .from('vendors')
            .select(`
                *,
                services (*)
            `);

        if (city) {
            query = query.ilike('city', `%${city}%`);
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

    // Fetch event types
    async getEventTypes() {
        const { data, error } = await supabase
            .from('event_types')
            .select('*')
            .order('display_order');
        return { data, error };
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

    // Get vendors by service category - v4 with proper filtering
    async getVendorsByService({ serviceCategory, city, limit = 50 }) {
        try {
            console.log('[VENDORS-V4] Starting fetch for:', serviceCategory, 'in', city);
            
            // Fetch all vendors with their services
            const { data: allVendors, error: fetchError } = await supabase
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
                    logo_url, 
                    status, 
                    is_verified, 
                    created_at,
                    services (
                        id,
                        name,
                        description,
                        price_amount,
                        price_unit
                    )
                `)
                .limit(limit);

            if (fetchError) {
                console.log('[VENDORS-V4] Fetch error:', fetchError.message);
                return { data: [], error: fetchError };
            }

            console.log('[VENDORS-V4] Raw fetch:', allVendors?.length || 0, 'vendors');

            // Filter by service category
            let filteredVendors = allVendors || [];
            
            if (serviceCategory && filteredVendors.length > 0) {
                const searchTerm = serviceCategory.toLowerCase();
                filteredVendors = filteredVendors.filter(v => {
                    // Check if vendor category matches
                    const categoryMatch = v.category?.toLowerCase().includes(searchTerm);
                    
                    // Check if any of vendor's services match
                    const serviceMatch = v.services?.some(svc => 
                        svc.name?.toLowerCase().includes(searchTerm)
                    );
                    
                    return categoryMatch || serviceMatch;
                });
                
                console.log('[VENDORS-V4] After category filter:', filteredVendors.length, 'vendors');
            }
            
            // Filter by city if provided
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
};

export default supabase;
