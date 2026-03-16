import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, useBackendApi } from '../services/api';

const CartContext = createContext(undefined);
const CART_ID_KEY = 'ekatraa_cart_id';

export function CartProvider({ children }) {
    const [cartId, setCartIdState] = useState(null);
    const [cartItemCount, setCartItemCount] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const useApi = useBackendApi();

    useEffect(() => {
        AsyncStorage.getItem(CART_ID_KEY).then((id) => {
            if (id) setCartIdState(id);
            setLoaded(true);
        }).catch(() => setLoaded(true));
    }, []);

    useEffect(() => {
        if (!loaded || !useApi || !cartId) return;
        api.getCart(cartId).then(({ data }) => {
            setCartItemCount(Array.isArray(data?.items) ? data.items.length : 0);
        }).catch(() => {});
    }, [loaded, cartId, useApi]);

    const setCartId = useCallback(async (id) => {
        setCartIdState(id);
        if (id) {
            await AsyncStorage.setItem(CART_ID_KEY, id);
        } else {
            await AsyncStorage.removeItem(CART_ID_KEY);
        }
    }, []);

    const refreshCartCount = useCallback(async (overrideId) => {
        const cid = overrideId || cartId;
        if (!useApi || !cid) {
            setCartItemCount(0);
            return;
        }
        try {
            const { data } = await api.getCart(cid);
            setCartItemCount(Array.isArray(data?.items) ? data.items.length : 0);
        } catch {
            setCartItemCount(0);
        }
    }, [useApi, cartId]);

    const clearCart = useCallback(async () => {
        setCartIdState(null);
        setCartItemCount(0);
        await AsyncStorage.removeItem(CART_ID_KEY);
    }, []);

    return (
        <CartContext.Provider value={{
            cartId,
            setCartId,
            cartItemCount,
            setCartItemCount,
            refreshCartCount,
            clearCart,
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within CartProvider');
    return context;
}
