'use client';
import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const CartContext = createContext();

// Kunci baris keranjang = produk + ukuran terpilih.
// Dua ukuran berbeda dari produk yang sama = dua baris terpisah (Fix D5/A1).
const lineKey = (item) => `${item.id}__${item.selectedSize ?? ''}`;

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const key = lineKey(action.payload);
      const existing = state.items.find(item => item.cartId === key);
      const maxStock = action.payload.stock ?? 1; // preloved: stok default 1
      if (existing) {
        // Fix B1: jangan naikkan qty di atas stock
        if (existing.quantity >= maxStock) return state;
        return {
          ...state,
          items: state.items.map(item =>
            item.cartId === key
              ? { ...item, quantity: Math.min(item.quantity + 1, maxStock) }
              : item
          ),
        };
      }
      return {
        ...state,
        items: [...state.items, { ...action.payload, cartId: key, quantity: 1, stock: maxStock }],
      };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.cartId !== action.payload),
      };
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map(item =>
          item.cartId === action.payload.cartId
            ? { ...item, quantity: Math.min(item.stock ?? 1, Math.max(1, action.payload.quantity)) }
            : item
        ),
      };
    case 'CLEAR_CART':
      return { ...state, items: [] };
    case 'LOAD_CART':
      return { ...state, items: action.payload };
    default:
      return state;
  }
};

// Backfill cartId untuk item lama yang tersimpan sebelum refactor
const withCartId = (items) =>
  (items ?? []).map(item => ({ ...item, cartId: item.cartId ?? lineKey(item) }));

export function CartProvider({ children }) {
  const { currentUser } = useAuth();
  // Keranjang dipisah per-user (Fix D4): ganti akun tidak membawa keranjang lama.
  const uid = currentUser?.id;
  const storageKey = `rewear-cart:${uid ?? 'guest'}`;
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const loadedKey = useRef(null);

  // Muat keranjang setiap kali user (storageKey) berubah
  useEffect(() => {
    let items = [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) items = withCartId(JSON.parse(saved));
    } catch (e) { /* ignore */ }
    // Adopsi keranjang tamu saat login (guest → user), lalu hapus keranjang tamu.
    if (uid && items.length === 0) {
      try {
        const guest = localStorage.getItem('rewear-cart:guest');
        if (guest) {
          const gItems = withCartId(JSON.parse(guest));
          if (gItems.length) { items = gItems; localStorage.removeItem('rewear-cart:guest'); }
        }
      } catch (e) { /* ignore */ }
    }
    loadedKey.current = storageKey;
    dispatch({ type: 'LOAD_CART', payload: items });
  }, [storageKey, uid]);

  // Simpan keranjang — hanya setelah load untuk storageKey ini selesai,
  // supaya tidak menimpa keranjang user lain dengan array kosong.
  useEffect(() => {
    if (loadedKey.current !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.items));
    } catch (e) { /* ignore */ }
  }, [state.items, storageKey]);

  const addItem = (product) => dispatch({ type: 'ADD_ITEM', payload: product });
  const removeItem = (cartId) => dispatch({ type: 'REMOVE_ITEM', payload: cartId });
  const updateQuantity = (cartId, quantity) => dispatch({ type: 'UPDATE_QUANTITY', payload: { cartId, quantity } });
  const clearCart = () => dispatch({ type: 'CLEAR_CART' });

  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items: state.items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
