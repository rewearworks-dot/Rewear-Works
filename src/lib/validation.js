import { z } from 'zod';

// Auth
export const LoginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(80),
  email: z.string().email('Email tidak valid'),
  phone: z.string().max(20).optional(),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

// Profile
export const ProfileSchema = z.object({
  full_name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80),
  phone: z.string().trim().max(20).optional(),
});

// Category
export const CategorySchema = z.object({
  name: z.string().trim().min(2, 'Nama kategori minimal 2 karakter').max(100),
  description: z.string().max(500).optional(),
});

// Product
export const ProductSchema = z.object({
  name: z.string().trim().min(2, 'Nama produk minimal 2 karakter').max(200),
  price: z.coerce.number().int().min(0, 'Harga tidak boleh negatif'),
  original_price: z.coerce.number().int().min(0).optional().nullable(),
  category_id: z.string().uuid('Kategori wajib dipilih'),
  size: z.string().max(20).optional(),
  available_sizes: z.array(z.string()).optional(),
  measurements: z.record(z.string(), z.string()).optional(),
  condition: z.string().max(50).optional(),
  brand: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  material: z.string().max(200).optional(),
  weight: z.coerce.number().int().min(0).optional().nullable(),
  description: z.string().max(2000).optional(),
  video_url: z.string().url().optional().or(z.literal('')),
  stock: z.coerce.number().int().min(0).default(1),
  featured: z.coerce.boolean().default(false),
});

// Order
export const OrderSchema = z.object({
  recipient: z.string().trim().min(2, 'Nama penerima wajib'),
  phone: z.string().trim().min(5, 'Telepon wajib'),
  address: z.string().trim().min(5, 'Alamat wajib'),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1),
    size: z.string().max(40).optional(),
  })).min(1, 'Keranjang kosong'),
});

// Admin account
export const AdminSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  full_name: z.string().min(2, 'Nama minimal 2 karakter').max(80),
});
