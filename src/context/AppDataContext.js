import React, { createContext, useContext, useState, useCallback } from 'react';
import { api, useBackendApi } from '../services/api';
import { dbService } from '../services/supabase';

const CACHE_TTL_MS = 7 * 60 * 1000; // 7 minutes — fewer repeat fetches when moving between screens

const AppDataContext = createContext(undefined);

export function AppDataProvider({ children }) {
    const [occasions, setOccasions] = useState([]);
    const [occasionsLoadedAt, setOccasionsLoadedAt] = useState(null);
    const [categoriesCache, setCategoriesCache] = useState({});
    const [banners, setBanners] = useState([]);
    const [bannersLoadedAt, setBannersLoadedAt] = useState(null);
    const useApi = useBackendApi();

    const isStale = (loadedAt) => !loadedAt || Date.now() - loadedAt > CACHE_TTL_MS;

    const getOccasions = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && occasions.length > 0 && !isStale(occasionsLoadedAt)) {
            return occasions;
        }
        try {
            if (useApi) {
                const occRes = await api.getOccasions();
                let occData = occRes?.data;
                if (!Array.isArray(occData) || occData.length === 0) {
                    const etRes = await api.getEventTypes();
                    occData = etRes?.data;
                }
                if (Array.isArray(occData) && occData.length > 0) {
                    const filtered = occData.filter(t => t.id !== 'all' && t.id !== 'others');
                    const final = filtered.length ? filtered : occData;
                    setOccasions(final);
                    setOccasionsLoadedAt(Date.now());
                    return final;
                }
            }
            const res = await dbService.getOccasions?.();
            const data = res?.data;
            if (Array.isArray(data) && data.length > 0) {
                const filtered = data.filter(t => t.id !== 'all' && t.id !== 'others');
                const final = filtered.length ? filtered : data;
                setOccasions(final);
                setOccasionsLoadedAt(Date.now());
                return final;
            }
        } catch (e) {
            console.log('[AppData] getOccasions error:', e?.message);
        }
        return occasions.length > 0 ? occasions : [];
    }, [useApi, occasions, occasionsLoadedAt]);

    const getCategories = useCallback(async (occasionId, forceRefresh = false) => {
        if (!occasionId) return [];
        const cached = categoriesCache[occasionId];
        if (!forceRefresh && cached?.data?.length > 0 && !isStale(cached.loadedAt)) {
            return cached.data;
        }
        try {
            if (useApi) {
                const { data } = await api.getCategories(occasionId);
                if (Array.isArray(data) && data.length > 0) {
                    setCategoriesCache(prev => ({
                        ...prev,
                        [occasionId]: { data, loadedAt: Date.now() },
                    }));
                    return data;
                }
            }
            const res = await dbService.getCategoriesByOccasion?.(occasionId);
            const data = res?.data;
            if (Array.isArray(data) && data.length > 0) {
                setCategoriesCache(prev => ({
                    ...prev,
                    [occasionId]: { data, loadedAt: Date.now() },
                }));
                return data;
            }
        } catch (e) {
            console.log('[AppData] getCategories error:', e?.message);
        }
        return cached?.data || [];
    }, [useApi, categoriesCache]);

    const getBanners = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && banners.length > 0 && !isStale(bannersLoadedAt)) {
            return banners;
        }
        try {
            if (useApi) {
                const { data } = await api.getBanners();
                if (Array.isArray(data) && data.length > 0) {
                    setBanners(data);
                    setBannersLoadedAt(Date.now());
                    return data;
                }
            }
            const res = await dbService.getBanners?.();
            const data = res?.data;
            if (Array.isArray(data) && data.length > 0) {
                setBanners(data);
                setBannersLoadedAt(Date.now());
                return data;
            }
        } catch (e) {
            console.log('[AppData] getBanners error:', e?.message);
        }
        return banners.length > 0 ? banners : [];
    }, [useApi, banners, bannersLoadedAt]);

    const invalidateCache = useCallback(() => {
        setOccasionsLoadedAt(null);
        setCategoriesCache({});
        setBannersLoadedAt(null);
    }, []);

    return (
        <AppDataContext.Provider value={{
            occasions,
            banners,
            getOccasions,
            getCategories,
            getBanners,
            invalidateCache,
        }}>
            {children}
        </AppDataContext.Provider>
    );
}

export function useAppData() {
    const context = useContext(AppDataContext);
    if (!context) throw new Error('useAppData must be used within AppDataProvider');
    return context;
}
