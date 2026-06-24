# 03 — Implementasi Fase demi Fase

> Kerjakan **berurutan**. Tiap fase: baca **Tujuan → Prasyarat → Langkah → Acceptance**.
> Setelah tiap fase: `npm run build` harus sukses. Terapkan skill `incremental-implementation`
> (potong kecil, verifikasi tiap langkah) dan `source-driven-development` (cek docs sebelum nulis).
>
> Fase 1 (Database) ada di `02-database-and-rls.md`. Lanjut dari Fase 2 di sini.

---

## FASE 2 — Setup project (dependency, env, config, Supabase clients)

**Tujuan:** menyiapkan fondasi koneksi Supabase yang benar untuk Next.js 16.

**Langkah:**

1. **Install dependency:**
   ```bash
   npm install @supabase/supabase-js @supabase/ssr zod
   ```
   (`zod` untuk validasi input Server Action.)

2. **Buat `.env.local`** sesuai `01-architecture-and-conventions.md` §F. Pastikan `.env.local`
   ada di `.gitignore` (biasanya sudah). **Jangan commit secret.**

3. **Update `next.config.mjs`** — daftarkan host Supabase Storage untuk `next/image`
   (INGAT: `images.domains` deprecated, pakai `remotePatterns`):
   ```js
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     images: {
       remotePatterns: [
         {
           protocol: 'https',
           hostname: '<PROJECT-REF>.supabase.co',   // ganti dgn host project kamu
           pathname: '/storage/v1/object/public/**',
         },
       ],
     },
   };
   export default nextConfig;
   ```
   > Cara dapat host: dari `NEXT_PUBLIC_SUPABASE_URL`. Jangan pakai wildcard `**` di hostname
   > kecuali perlu; lebih aman host spesifik.

4. **Buat 3 Supabase client** di `src/lib/supabase/`:

   `client.js` (untuk Client Components):
   ```js
   import { createBrowserClient } from '@supabase/ssr';
   export function createClient() {
     return createBrowserClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
     );
   }
   ```

   `server.js` (untuk Server Components & Server Actions) — **`cookies()` async di Next 16**:
   ```js
   import { createServerClient } from '@supabase/ssr';
   import { cookies } from 'next/headers';
   export async function createClient() {
     const cookieStore = await cookies();          // <-- await (Next.js 16)
     return createServerClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
       {
         cookies: {
           getAll() { return cookieStore.getAll(); },
           setAll(cookiesToSet) {
             try {
               cookiesToSet.forEach(({ name, value, options }) =>
                 cookieStore.set(name, value, options));
             } catch {
               // Dipanggil dari Server Component (read-only cookies). Aman diabaikan:
               // proxy.js yang akan menyegarkan sesi.
             }
           },
         },
       }
     );
   }
   ```

   `admin.js` (service-role, **SERVER ONLY**, mem-bypass RLS — pakai sangat hati-hati):
   ```js
   import 'server-only';
   import { createClient } from '@supabase/supabase-js';
   export function createAdminClient() {
     return createClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL,
       process.env.SUPABASE_SERVICE_ROLE_KEY,        // JANGAN NEXT_PUBLIC_
       { auth: { persistSession: false, autoRefreshToken: false } }
     );
   }
   ```
   > Package `server-only` ikut Next.js; bila error import, `npm install server-only`.

**Acceptance Fase 2:**
- [ ] `npm install` sukses; `@supabase/ssr`, `@supabase/supabase-js`, `zod` ada di `package.json`.
- [ ] `next.config.mjs` punya `images.remotePatterns` ke host Supabase.
- [ ] 3 file client dibuat; `admin.js` mengimport `server-only`.
- [ ] `npm run build` sukses.

**Jebakan:** jangan lupa `await cookies()`. Jangan pakai `images.domains`.

---

## FASE 3 — Autentikasi & otorisasi (ganti AuthContext localStorage)

**Tujuan:** login/register/logout nyata via Supabase Auth; sesi cookie httpOnly; proteksi rute
admin di server. Terapkan skill `security-and-hardening`.

**Prasyarat:** Fase 1 & 2 selesai. Akun admin sudah dibuat di Supabase.

### 3.1 Pengaturan Supabase Auth (Dashboard)
- Authentication → URL Configuration → **Site URL** = `http://localhost:3000` (dev) dan tambahkan
  URL Vercel saat deploy. **Redirect URLs**: tambahkan `http://localhost:3000/**` &
  `https://<domain>/**`.
- Email confirm: **KEPUTUSAN v1 = MATIKAN "Confirm email"** (Authentication → Providers → Email)
  agar register langsung login (alur paling sederhana & cocok dengan acceptance Fase 3).
  Bila pemilik ingin verifikasi email tetap ON, WAJIB juga: (a) buat `/auth/callback` (langkah
  3.5) dan (b) register mengarahkan ke halaman "cek email" saat `data.session` null (langkah 3.6).

### 3.2 `src/lib/session.js` — dipakai proxy untuk refresh sesi
```js
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    }
  );

  // PENTING: getUser() menyegarkan token. Jangan taruh logika di antara create & getUser.
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Redirect optimistik (lapisan 1; bukan satu-satunya pertahanan):
  if (path.startsWith('/admin') && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if ((path === '/login' || path === '/register') && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if ((path.startsWith('/checkout') || path.startsWith('/profile')) && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}
```

### 3.3 `src/proxy.js` — (BUKAN middleware.js!) Next.js 16
```js
import { updateSession } from '@/lib/session';

export async function proxy(request) {
  return await updateSession(request);
}

export const config = {
  // Jalankan di semua rute kecuali aset statis & gambar
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```
> File ini diletakkan di `src/proxy.js` karena project memakai folder `src/`. Export bernama
> `proxy`. Runtime nodejs (default proxy) — `@supabase/ssr` kompatibel.

### 3.4 `src/lib/dal.js` — Data Access Layer (cek sesi terpusat)
```js
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('id, full_name, phone, role, created_at')
    .eq('id', user.id).maybeSingle();   // maybeSingle: jangan 500 bila baris profil belum ada
  return { user, profile };             // profile bisa null → perlakukan sbg non-admin
});

export async function requireAuth() {
  const res = await getCurrentUser();
  if (!res?.user) redirect('/login');
  return res;
}

export async function requireAdmin() {
  const res = await getCurrentUser();
  if (!res?.user) redirect('/login');
  if (res.profile?.role !== 'admin') redirect('/');
  return res;
}
```

### 3.5 (Opsional, bila email confirm ON) `src/app/auth/callback/route.js`
```js
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  // Sanitasi 'next' → cegah open-redirect: hanya path internal ('/...'), tolak '//' & URL absolut.
  const rawNext = searchParams.get('next') ?? '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const supabase = await createClient();
  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);   // alur PKCE
    ok = !error;
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash }); // alur konfirmasi/recovery
    ok = !error;
  }
  return NextResponse.redirect(`${origin}${ok ? next : '/login?error=auth'}`);
}
```

### 3.6 `src/lib/actions/auth.js` — Server Actions
```js
'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const RegisterSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

export async function login(prevState, formData) {
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Email atau password salah' };

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle();  // jangan 500 bila null
  revalidatePath('/', 'layout');
  redirect(profile?.role === 'admin' ? '/admin' : '/');                // null → '/' (non-admin)
}

export async function register(prevState, formData) {
  const parsed = RegisterSchema.safeParse({
    name: formData.get('name'), email: formData.get('email'),
    phone: formData.get('phone'), password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, phone, password } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: name, phone } },   // masuk ke raw_user_meta_data → trigger
  });
  if (error) {
    return { error: error.message.includes('registered') ? 'Email sudah terdaftar' : 'Gagal mendaftar' };
  }
  revalidatePath('/', 'layout');
  // Bila "Confirm email" ON di Supabase, signUp TIDAK mengembalikan session → user belum bisa
  // login. Jangan redirect ke '/' (akan tampak gagal diam-diam). Arahkan ke halaman cek email.
  if (!data.session) {
    redirect('/register?check-email=1');   // atau buat halaman khusus; tampilkan "cek email kamu"
  }
  redirect('/');                            // session ada (confirm OFF) → langsung masuk
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
```

### 3.7 `src/context/AuthContext.js` — GANTI jadi provider tipis (client)
Provider lama (localStorage) **dihapus isinya** dan diganti yang membaca sesi Supabase. Menjaga API
`useAuth()` (`currentUser`, `isLoggedIn`, `isAdmin`, `isLoading`, `logout`) supaya Navbar/halaman
lain tidak rusak.

```js
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logout as logoutAction } from '@/lib/actions/auth';

const AuthContext = createContext();

export function AuthProvider({ children, initialUser = null, initialProfile = null }) {
  const [user, setUser] = useState(initialUser);
  const [profile, setProfile] = useState(initialProfile);
  const [isLoading, setIsLoading] = useState(false);

  // Listener HARUS sinkron (jangan await Supabase di dalam callback → bisa deadlock SDK lock).
  // Cukup set user; profil di-fetch oleh effect kedua di bawah.
  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Re-fetch profil setiap kali id user berubah (login multi-tab, refresh token, SIGNED_IN).
  // Tanpa ini, isAdmin/full_name bisa basi setelah transisi auth di client.
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles').select('id, full_name, phone, role, created_at')
        .eq('id', user.id).maybeSingle();
      if (active) setProfile(data ?? null);   // jangan set utk user yang sudah berganti
    })();
    return () => { active = false; };
  }, [user?.id]);

  const value = {
    currentUser: user
      ? { ...user, ...profile, name: profile?.full_name, createdAt: profile?.created_at ?? user.created_at }
      : null,
    profile,
    isLoggedIn: !!user,
    isAdmin: profile?.role === 'admin',
    isCustomer: profile?.role === 'customer',
    isLoading,
    logout: async () => { await logoutAction(); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

### 3.8 `src/app/layout.js` — beri initial sesi dari server
Root layout TETAP Server Component (jangan `'use client'`). Ambil sesi di server, lalu lewatkan ke
provider client. Hapus `ProductProvider` lama **belum** di sini (masih dipakai sampai Fase 4–7).
```js
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { ProductProvider } from '@/context/ProductContext';   // sementara, dihapus di Fase 7
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getCurrentUser } from '@/lib/dal';

export const metadata = { /* ...tetap... */ };

export default async function RootLayout({ children }) {
  const res = await getCurrentUser();
  return (
    <html lang="id">
      <body>
        <AuthProvider initialUser={res?.user ?? null} initialProfile={res?.profile ?? null}>
          <ProductProvider>
            <CartProvider>
              <Navbar />
              <main>{children}</main>
              <Footer />
            </CartProvider>
          </ProductProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 3.9 Sambungkan form login/register & logout
- `src/app/login/page.js` & `register/page.js`: ganti handler lama menjadi **form Server Action**
  dengan `useActionState`. Pola (login):
  ```js
  'use client';
  import { useActionState } from 'react';
  import { login } from '@/lib/actions/auth';
  // ...
  const [state, action, pending] = useActionState(login, null);
  // <form action={action}> ... name="email" / name="password" ...
  // tampilkan {state?.error}; tombol disabled={pending}
  ```
  Pertahankan markup/CSS yang ada; hanya ganti mekanisme submit. Hapus `setTimeout` palsu.
- Logout di Navbar & profile: panggil `logout()` action (sudah via context `logout`).
- Admin "Tambah Admin" & "Hapus akun" → dipindah ke **Fase 7** (butuh service-role).

### 3.10 Admin guard server-side
`src/app/admin/layout.js`: saat ini Client Component dgn cek `isAdmin`. **Tambahkan** lapisan
server: buat Server Component wrapper atau ubah jadi server layout yang memanggil `requireAdmin()`.
Pola paling aman: jadikan `admin/layout.js` Server Component yang `await requireAdmin()` lalu render
sidebar (sidebar interaktif bisa komponen client terpisah).
```js
import { requireAdmin } from '@/lib/dal';
import AdminSidebar from './AdminSidebar';   // pindahkan UI sidebar/client ke sini
export default async function AdminLayout({ children }) {
  await requireAdmin();   // redirect bila bukan admin (pertahanan server, bukan cuma UI)
  return (<div className="admin-layout"><AdminSidebar /><div className="admin-content">{children}</div></div>);
}
```

**Acceptance Fase 3:**
- [ ] Register membuat user di Supabase + baris `profiles` (cek dashboard).
- [ ] Login set cookie sesi; refresh halaman tetap login; logout menghapus sesi.
- [ ] Mengakses `/admin` tanpa login → redirect `/login`; login sbg customer → redirect `/`.
- [ ] `proxy.js` (bukan middleware) ada & jalan; tidak ada file `middleware.js`.
- [ ] Navbar menampilkan nama user dari `profiles` saat login.
- [ ] `npm run build` sukses.

**Jebakan:** (1) `cookies()` async. (2) jangan menaruh kode antara `createServerClient` dan
`getUser()` di session.js. (3) jangan andalkan cek admin client-only.

---

## FASE 4 — Jalur baca data + GAMBAR NYATA (Home, Shop, Detail)

**Tujuan:** semua halaman membaca produk/kategori dari Supabase (Server Components) dan
**menampilkan gambar nyata**. Perbaiki temuan A1–A3, A5, B5, B7, B8, D3, D4. Skill:
`frontend-ui-engineering`, `source-driven-development`.

### 4.1 Data Access Layer baca
`src/lib/data/categories.js`:
```js
import { createClient } from '@/lib/supabase/server';
export async function getCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}
```

`src/lib/data/products.js` — sertakan join kategori + foto, dan **bentuk ulang** agar UI lama tetap
dapat field yang diharapkannya (`categoryName`, `images` array URL, `category` slug/id):
```js
import { createClient } from '@/lib/supabase/server';

const SELECT = `
  *,
  category:categories ( id, name, slug ),
  product_images ( url, position )
`;

function shape(p) {
  const images = (p.product_images ?? [])
    .sort((a, b) => a.position - b.position)
    .map((i) => i.url);
  return {
    ...p,
    price: p.price,
    originalPrice: p.original_price,            // alias utk UI lama
    availableSizes: p.available_sizes ?? [],
    measurements: p.measurements ?? {},
    videoUrl: p.video_url ?? '',               // dipakai render video (A5) & prefill edit admin
    createdAt: p.created_at,                    // WAJIB: Home/Shop sort 'terbaru' pakai createdAt
    categoryName: p.category?.name ?? '',
    categorySlug: p.category?.slug ?? '',
    category: p.category_id,                     // UI lama bandingkan p.category dgn cat.id
    images,
    image: images[0] ?? null,
  };
}

export async function getProducts() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('products').select(SELECT).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(shape);
}
export async function getFeaturedProducts(limit = 8) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('products').select(SELECT)
    .eq('featured', true).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(shape);
}
export async function getProductById(id) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('products').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? shape(data) : null;
}
export async function getRelatedProducts(categoryId, excludeId, limit = 4) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('products').select(SELECT)
    .eq('category_id', categoryId).neq('id', excludeId).limit(limit);
  if (error) throw error;
  return (data ?? []).map(shape);
}
```

### 4.2 Ubah halaman jadi Server Component yang fetch
- **Home `src/app/page.js`:** hapus `'use client'` & `useProducts`. Jadikan `async` server
  component: `const [products, categories] = await Promise.all([getProducts(), getCategories()])`
  lalu hitung `featured`/`newArrivals` di server. Markup tetap. `ProductCard` tetap (lihat 4.4).
- **Shop `src/app/shop/page.js`:** filtering bisa tetap client untuk interaktivitas. Pola:
  jadikan `page.js` Server Component yang fetch `getProducts()`+`getCategories()` lalu render
  komponen client `ShopClient` (pindahkan logika filter/sort/pagination/`useSearchParams` ke sana).
  **Bungkus** komponen yang memakai `useSearchParams` dengan `<Suspense>` (perbaikan B7):
  ```js
  import { Suspense } from 'react';
  // <Suspense fallback={<div className="container section">Memuat…</div>}><ShopClient .../></Suspense>
  ```
- **Detail `src/app/product/[id]/page.js`:** Pilihan yang disarankan — pecah jadi:
  - `page.js` Server Component: `const { id } = await params;` (INGAT: server pakai `await`,
    bukan `use()`), `const product = await getProductById(id)`; bila null → `notFound()`.
    Fetch `getRelatedProducts`. Tambahkan `generateMetadata` (SEO, opsional). Render `ProductDetail`
    (client) untuk interaksi (galeri, add-to-cart).
  - `ProductDetail.jsx` (client): terima `product` & `related` sebagai props. **Hapus filter
    `data:`** — render semua URL gambar. Perbaiki B5: inisialisasi `mainImage` dgn
    `useState(() => product.images?.[0] ?? null)`, bukan set saat render. Perbaiki B2: bila
    `product.stock <= 0 || product.status === 'sold'` → tampilkan badge "Terjual" & nonaktifkan
    tombol. Render `video_url` bila ada (A5, opsional).

### 4.3 Perbaiki `calculateDiscount` (B8) di `src/utils/helpers.js`
```js
export function calculateDiscount(originalPrice, price) {
  if (!originalPrice || originalPrice <= 0 || price >= originalPrice) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}
```

### 4.4 `ProductCard` & galeri: GAMBAR NYATA via `next/image` (A1, A2, D3)
`src/components/ProductCard.js` — render foto utama bila ada, fallback ke placeholder SVG yang
sudah ada bila tidak:
```js
import Image from 'next/image';
// di dalam .product-card-image:
{product.image ? (
  <Image src={product.image} alt={product.name} fill sizes="(max-width:768px) 50vw, 25vw"
         style={{ objectFit: 'cover' }} className="product-card-photo" />
) : (
  /* ...SVG placeholder lama tetap di sini sebagai fallback... */
)}
```
> Pastikan kontainer `.product-card-image` `position: relative` agar `fill` bekerja (cek di
> `globals.css`; bila belum, tambah inline `style={{ position:'relative' }}` pada kontainer —
> JANGAN ubah desain lain).
> Galeri detail: ganti `<img>` jadi `next/image` (atau biarkan `<img>` bila lebih simpel, tapi
> pastikan `alt`). Host Supabase sudah didaftarkan di Fase 2.

### 4.5 State rute: `loading` & `not-found` (D4)
- `src/app/not-found.js` (global 404) — pakai komponen `empty-state` yang ada.
- `src/app/loading.js` atau `loading.js` per-segmen (shop, product) — skeleton sederhana.
- Opsional `error.js` di segmen yang fetch (tangani kegagalan Supabase).

**Acceptance Fase 4:**
- [ ] Home, Shop, Detail membaca data dari Supabase (bukan `ProductContext`/localStorage).
- [ ] Gambar produk nyata tampil di kartu & detail (untuk produk yang punya foto). Produk tanpa
      foto menampilkan placeholder lama (tidak crash).
- [ ] `/shop` tidak lagi memunculkan warning `useSearchParams`/Suspense.
- [ ] Detail produk: `await params`; produk tak ada → 404 (`notFound()`).
- [ ] Item `sold`/stok 0 → tombol "Tambah Keranjang" nonaktif + badge "Terjual".
- [ ] `npm run build` sukses; tidak ada `setState`-saat-render.

**Jebakan:** server pakai `await params` (BUKAN `use(params)`); `next/image` butuh
`remotePatterns`; container `fill` butuh `position: relative`.

---

## FASE 5 — Admin CRUD via Server Actions (produk, kategori) + upload Storage

**Tujuan:** admin menulis ke Postgres & meng-upload foto ke Supabase Storage (ganti base64/localStorage,
temuan A4). Tambahkan a11y modal (D1, D2). Skill: `security-and-hardening`, `code-review-and-quality`.

### 5.1 Validasi `src/lib/validation.js`
Definisikan skema Zod `ProductSchema`, `CategorySchema` (name wajib, price angka ≥ 0, dll).

### 5.2 `src/lib/actions/categories.js`
```js
'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';

export async function createCategory(prevState, formData) {
  await requireAdmin();                                  // WAJIB cek admin
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '');
  if (name.length < 2) return { error: 'Nama kategori minimal 2 karakter' };
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const supabase = await createClient();
  const { error } = await supabase.from('categories').insert({ name, slug, description });
  if (error) return { error: error.message.includes('duplicate') ? 'Slug sudah ada' : 'Gagal menyimpan' };
  revalidatePath('/admin/categories'); revalidatePath('/');
  return { ok: true };
}
export async function updateCategory(prevState, formData) {
  await requireAdmin();   // <-- WAJIB baris pertama (action POST-reachable langsung)
  /* ...validasi + update... */
}
export async function deleteCategory(id) {
  await requireAdmin();   // <-- WAJIB baris pertama
  // tolak bila masih ada produk memakai kategori (cek count) — samakan dgn UX lama.
}
```

### 5.3 Upload gambar produk ke Storage
Upload dilakukan **dari Server Action** memakai **session client** (RLS menegakkan admin). Alur:
- Form admin mengirim `File`(s) via `FormData` (`name="images"` `multiple`).
- Server Action membaca `formData.getAll('images')`. **VALIDASI tiap file SEBELUM upload** (bucket
  publik → jangan percaya `file.type`/`file.name` dari client; **tolak SVG** = risiko XSS):
  ```js
  const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const MAX_BYTES = 5 * 1024 * 1024;   // 5 MB

  for (const file of formData.getAll('images')) {
    if (!(file instanceof File) || file.size === 0) continue;
    const ext = ALLOWED[file.type];                 // hanya jpeg/png/webp (SVG ditolak)
    if (!ext) return { error: 'Format gambar harus JPG, PNG, atau WebP' };
    if (file.size > MAX_BYTES) return { error: 'Ukuran gambar maksimal 5 MB' };

    // Nama aman: jangan pakai file.name mentah; paksa ekstensi dari MIME tervalidasi.
    const base = (file.name || 'foto').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
    const safeName = `${base.replace(/\.[^.]*$/, '')}.${ext}`;
    const path = `${productId}/${crypto.randomUUID()}-${safeName}`;

    const supabase = await createClient();          // session client → RLS menegakkan admin
    const { error } = await supabase.storage.from('product-images')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { error: 'Gagal mengunggah gambar' };
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
    // simpan publicUrl ke tabel product_images (position urut: 0,1,2,...)
  }
  ```
- `crypto.randomUUID()` tersedia di runtime server Node.

### 5.4 `src/lib/actions/products.js`
```js
'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';

export async function createProduct(prevState, formData) {
  await requireAdmin();
  const supabase = await createClient();
  // 1) validasi field (zod)
  // 2) insert ke products → dapat product.id
  // 3) upload tiap file gambar → product_images (position 0,1,2,...)
  // 4) revalidatePath('/'); revalidatePath('/shop'); revalidatePath('/admin/products');
  // return { ok: true } atau { error }
}
export async function updateProduct(prevState, formData) {
  await requireAdmin();   // <-- WAJIB baris pertama
  // update kolom; tangani tambah/hapus gambar (hapus dari Storage + baris product_images).
}
export async function deleteProduct(id) {
  await requireAdmin();   // <-- WAJIB baris pertama
  // hapus baris (product_images ikut terhapus cascade); hapus file di Storage utk bersih.
}
```

### 5.5 Sambungkan UI admin (`src/app/admin/products/page.js`, `categories/page.js`)
- Ganti pemanggilan `useProducts()` mutasi (`addProduct`/`updateProduct`/`deleteProduct`/
  `addCategory`/...) menjadi pemanggilan Server Action (form `action={...}` atau
  `useActionState`/`startTransition`). **Daftar produk** dibaca dari server (jadikan `page.js`
  server component yang fetch lalu render bagian tabel; modal/form tetap client memanggil action).
- **Upload gambar:** ganti `handleImageUpload` base64 menjadi input file biasa yang ikut terkirim
  di `FormData` Server Action (jangan simpan base64). Untuk preview sebelum submit boleh pakai
  `URL.createObjectURL(file)` (bukan base64).
- **Thumbnail tabel admin:** di `admin/products/page.js` (~baris 167) ADA guard lama
  `p.images[0].startsWith('data:')`. **Hapus guard `data:` itu** dan render `p.image`/`p.images[0]`
  (URL Storage `https`) via `next/image`/`<img>`, sama seperti perbaikan halaman detail di §4.2.
  Tanpa ini, semua thumbnail admin tampil placeholder.
- **A11y modal (D1):** tambahkan `role="dialog"` `aria-modal="true"`, tutup via tombol Escape
  (`onKeyDown`), fokus ke field pertama saat buka, `aria-label` pada tombol ikon (✕, +, −).

### 5.6 Hapus ketergantungan localStorage pada produk/kategori
Setelah admin & halaman publik (Fase 4) memakai Supabase, **jangan** lagi menulis produk/kategori
ke localStorage. `ProductContext` akan dihapus penuh di Fase 7 (orders masih memakainya sampai
Fase 6/7).

**Acceptance Fase 5:**
- [ ] Admin menamb/ubah/hapus produk & kategori → tersimpan di Postgres (cek dashboard).
- [ ] Upload foto → file masuk bucket `product-images`, URL tersimpan di `product_images`, tampil
      di katalog (Fase 4).
- [ ] Non-admin tidak bisa memanggil action (uji: panggil saat logout/customer → ditolak).
- [ ] `requireAdmin()` adalah **statement pertama** di SETIAP export `products.js` & `categories.js`.
- [ ] Upload memvalidasi: hanya JPG/PNG/WebP, ≤ 5 MB, **SVG ditolak**; nama file di-sanitasi.
- [ ] Thumbnail tabel produk admin menampilkan gambar Storage nyata (guard `data:` dihapus).
- [ ] Modal admin punya `aria-modal`, bisa ditutup via Escape.
- [ ] Tidak ada lagi base64 gambar di localStorage.
- [ ] `npm run build` sukses.

**Jebakan:** jangan upload via service-role kecuali perlu (pakai session client agar RLS jalan);
selalu `requireAdmin()` di baris awal action; `revalidatePath` setelah mutasi.

---

## FASE 6 — Keranjang & Checkout (stok aman, order atomik)

**Tujuan:** checkout nyata yang aman lewat RPC `create_order`. Perbaiki B1, B2. Skill:
`test-driven-development` (tulis test alur stok/checkout dulu — lihat `04-...`).

### 6.1 `CartContext` — batasi qty ≤ stok (B1)
Di `src/context/CartContext.js`:
- `ADD_ITEM`: jangan menaikkan qty di atas `stock` item. Untuk preloved (stok 1), qty tetap 1.
- `UPDATE_QUANTITY`: clamp `Math.min(stock, Math.max(1, qty))`. Simpan `stock` saat item dimasukkan.
- Di `cart/page.js`: nonaktifkan tombol `+` saat `quantity >= stock`; beri `aria-label`.

### 6.2 `src/lib/actions/orders.js` — `createOrder`
```js
'use server';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';

import { z } from 'zod';
const OrderSchema = z.object({
  recipient: z.string().trim().min(2, 'Nama penerima wajib'),
  phone: z.string().trim().min(5, 'Telepon wajib'),
  address: z.string().trim().min(5, 'Alamat wajib'),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1, 'Keranjang kosong'),
});

export async function createOrder(payload) {
  // payload: { recipient, phone, address, notes, items: [{ product_id, quantity }] }
  await requireAuth();                       // harus login
  const parsed = OrderSchema.safeParse(payload);     // jangan percaya input client
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_order', {
    p_recipient: parsed.data.recipient,
    p_phone: parsed.data.phone,
    p_address: parsed.data.address,
    p_notes: parsed.data.notes ?? '',
    p_shipping: 0,                           // v1: ongkir 0/gratis (lihat scope C3); RPC clamp ≥0
    p_items: parsed.data.items,              // [{product_id, quantity}]
  });
  if (error) return { error: 'Sebagian barang tidak tersedia. Periksa keranjang.' };
  return { ok: true, orderId: data };        // data = uuid order
}
```
> Harga & total dihitung di dalam RPC dari DB → client tidak bisa memanipulasi harga.

### 6.3 Sambungkan `src/app/checkout/page.js`
- Tetap client (form). Saat submit, **petakan field secara eksplisit** (field form bernama `name`
  = penerima, tapi action mengharap `recipient`). JANGAN sekadar `{...form}`:
  ```js
  const res = await createOrder({
    recipient: form.name,            // form.name → recipient (recipient_name di DB, NOT NULL)
    phone: form.phone,
    address: form.address,
    notes: form.notes,
    items: items.map(i => ({ product_id: i.id, quantity: i.quantity })),
  });
  ```
  > **PENTING:** `i.id` di keranjang HARUS sama dengan `products.id` (UUID Supabase). Pastikan saat
  > item dimasukkan ke keranjang (Fase 4, product detail) yang disimpan adalah `product.id` UUID.
- Bila `{ ok }` → `clearCart()` lalu tampilkan layar sukses (boleh tampilkan `orderId`).
- Bila `{ error }` → tampilkan pesan (mis. barang keburu terjual), arahkan cek keranjang.
- Hapus pemakaian `addOrder` dari `ProductContext`.
- Proteksi login sudah dari `proxy.js`, tapi tetap `requireAuth()` di action (pertahanan server).

**Acceptance Fase 6:**
- [ ] Checkout membuat baris `orders` + `order_items` di DB; stok produk berkurang; produk jadi
      `sold` saat stok habis.
- [ ] Tidak bisa menambah qty melebihi stok di keranjang.
- [ ] Checkout barang yang sudah `sold` → gagal dengan pesan jelas (tidak membuat order).
- [ ] Uji race (opsional manual): dua checkout barang stok-1 → satu sukses, satu gagal.
- [ ] `npm run build` sukses.

**Jebakan:** kirim `items` sbg `[{product_id, quantity}]` (UUID string), bukan objek produk penuh;
jangan hitung total di client untuk disimpan.

---

## FASE 6B — Payment Gateway: Pakasir (URL + Webhook + verifikasi)

**Tujuan:** customer membayar via Pakasir (QRIS/VA) setelah order dibuat; order ditandai **lunas**
hanya setelah pembayaran **diverifikasi ke server Pakasir** (bukan sekadar percaya webhook). Skill:
`security-and-hardening`, `source-driven-development`.

**Prasyarat:** Fase 6 selesai. Punya akun Pakasir → buat Proyek → catat **Slug** & **API Key**
(masuk ke env `PAKASIR_SLUG`, `PAKASIR_API_KEY`, lihat 01 §F). Kolom pembayaran sudah ada di tabel
`orders` (schema.sql: `payment_status`, `payment_method`, `paid_at`) + RPC `cancel_order`.

### Konsep & alur (penting dipahami)
Kita pakai **Integrasi Via URL** (paling sederhana & aman): arahkan customer ke halaman bayar
Pakasir, lalu Pakasir memberi tahu kita lewat **webhook**, dan kita **selalu konfirmasi ulang**
status ke **Transaction Detail API** sebelum menandai lunas (dokumen Pakasir menyarankan ini;
webhook tidak punya tanda tangan/secret, jadi tidak boleh dipercaya mentah).

```
1. Checkout → createOrder (RPC) → order dibuat, stok DI-RESERVE (status sold), payment_status='unpaid'
2. Redirect customer → https://app.pakasir.com/pay/{SLUG}/{total}?order_id={order.id}&redirect={SITE}/checkout/success?order_id={order.id}&qris_only=1(opsional)
3. Customer bayar di Pakasir
4. Pakasir → POST webhook ke /api/webhooks/pakasir  (PEMICU saja)
5. Webhook handler → GET Transaction Detail API (OTORITATIF) → cek status='completed' & amount==order.total
   → set payment_status='paid', paid_at, payment_method  (pakai service-role)
6. Halaman /checkout/success → cek Transaction Detail API lagi → tampilkan status ke user
7. Bila gagal/expired/batal → cancel_order(order.id) → kembalikan stok
```

> **Kenapa reserve stok di langkah 1?** Barang preloved unik. Bila stok baru dikurangi saat lunas,
> dua orang bisa sama-sama membayar barang yang sama. Reserve saat order = aman; bila pembayaran
> tidak selesai, `cancel_order` mengembalikan stok.

### 6B.1 `src/lib/payments/pakasir.js` — helper server (jangan import di client)
```js
import 'server-only';
const BASE = 'https://app.pakasir.com';

export function buildPayUrl({ total, orderId, redirectUrl, qrisOnly = false }) {
  const slug = process.env.PAKASIR_SLUG;
  const params = new URLSearchParams({ order_id: orderId });
  if (redirectUrl) params.set('redirect', redirectUrl);
  if (qrisOnly) params.set('qris_only', '1');
  return `${BASE}/pay/${slug}/${total}?${params.toString()}`;
}

// Sumber kebenaran status. amount & order_id WAJIB cocok dgn order kita.
export async function getTransactionDetail({ amount, orderId }) {
  const slug = process.env.PAKASIR_SLUG;
  const key = process.env.PAKASIR_API_KEY;
  const url = `${BASE}/api/transactiondetail?project=${slug}&amount=${amount}&order_id=${encodeURIComponent(orderId)}&api_key=${key}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const json = await res.json();
  return json.transaction ?? null;   // { amount, order_id, status, payment_method, completed_at }
}
```

### 6B.2 Ubah `createOrder` (Fase 6.2) agar mengembalikan URL bayar
Setelah RPC sukses dan dapat `orderId`, ambil `total` order lalu bangun pay URL & kembalikan:
```js
// ...setelah const { data, error } = await supabase.rpc('create_order', {...}); error handling...
const orderId = data;
const { data: ord } = await supabase.from('orders').select('total').eq('id', orderId).single();
const site = process.env.NEXT_PUBLIC_SITE_URL || '';
const payUrl = buildPayUrl({
  total: ord.total,
  orderId,
  redirectUrl: `${site}/checkout/success?order_id=${orderId}`,
  // qrisOnly: true,   // aktifkan bila ingin hanya QRIS
});
return { ok: true, orderId, payUrl };
```

### 6B.3 Ubah checkout (Fase 6.3) — redirect ke Pakasir
Saat `createOrder` mengembalikan `{ ok, payUrl }`: `clearCart()` lalu
`window.location.href = res.payUrl;` (JANGAN tampilkan layar "sukses" dulu — pembayaran belum
terjadi). Bila `{ error }` → tampilkan pesan.

### 6B.4 Webhook — `src/app/api/webhooks/pakasir/route.js` (Route Handler, POST)
Isi **Webhook URL** di Proyek Pakasir = `https://<domain>/api/webhooks/pakasir`.
```js
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';     // service-role: webhook tanpa sesi user
import { getTransactionDetail } from '@/lib/payments/pakasir';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { order_id, amount } = body || {};
  if (!order_id || amount == null) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = createAdminClient();
  // 1) Ambil order kita (sumber jumlah yang benar)
  const { data: order } = await supabase
    .from('orders').select('id, total, payment_status').eq('id', order_id).maybeSingle();
  if (!order) return NextResponse.json({ ok: false }, { status: 404 });
  if (order.payment_status === 'paid') return NextResponse.json({ ok: true }); // idempoten

  // 2) JANGAN percaya webhook — verifikasi OTORITATIF ke Pakasir
  const tx = await getTransactionDetail({ amount: order.total, orderId: order_id });
  if (!tx || tx.status !== 'completed' || Number(tx.amount) !== Number(order.total)) {
    return NextResponse.json({ ok: false, reason: 'unverified' }, { status: 202 });
  }

  // 3) Tandai lunas
  await supabase.from('orders').update({
    payment_status: 'paid',
    payment_method: tx.payment_method ?? null,
    paid_at: tx.completed_at ?? new Date().toISOString(),
  }).eq('id', order_id);

  return NextResponse.json({ ok: true });
}
```
> Catatan: Route Handler ini publik (tak ada sesi). Keamanannya = **verifikasi ulang via API +
> cocokkan `amount` dengan `order.total` kita** + idempoten. Jangan menandai lunas hanya dari body
> webhook.

### 6B.5 Halaman hasil — `src/app/checkout/success/page.js` (Server Component)
`await searchParams` → ambil `order_id`. Ambil order dari DB (`requireAuth`, pastikan milik user).
Konfirmasi sekali lagi via `getTransactionDetail` (read-your-write) dan tampilkan:
- `completed` → "Pembayaran berhasil" + tombol Lihat Pesanan; (opsional) update DB bila webhook telat.
- selain itu → "Menunggu pembayaran" + tombol bayar ulang (pay URL) / instruksi.

### 6B.6 Batal / kedaluwarsa (lepas stok)
- Aksi `cancelOrder(orderId)` (Server Action, `requireAuth`) memanggil RPC `cancel_order` →
  kembalikan stok + status 'Dibatalkan'. Admin juga bisa membatalkan dari halaman Pesanan (Fase 7).
- (Backlog) cron pembersih order `unpaid` yang lewat batas waktu — panggil `cancel_order`.

### 6B.7 Testing (mode Sandbox Pakasir)
- Buat order → buka pay URL → di Sandbox panggil **Payment simulation API**
  (`POST /api/paymentsimulation` dgn `{project, order_id, amount, api_key}`) untuk memicu webhook.
- Pastikan: webhook → order jadi `paid`; halaman success menampilkan berhasil; uji webhook palsu
  (amount beda) → DITOLAK (tetap `unpaid`).

**Acceptance Fase 6B:**
- [ ] Checkout mengarahkan ke halaman bayar Pakasir dengan `order_id`=id order & `amount`=total.
- [ ] Order baru `payment_status='unpaid'`; stok ter-reserve saat order dibuat.
- [ ] Webhook menandai `paid` **hanya** setelah verifikasi Transaction Detail API & `amount` cocok.
- [ ] Webhook bersifat idempoten (kiriman ganda tidak menggandakan apa pun) & menolak amount tidak cocok.
- [ ] `PAKASIR_API_KEY` tidak pernah ada di kode client (hanya `pakasir.js`/route server).
- [ ] Pembatalan/expired mengembalikan stok via `cancel_order`.
- [ ] `npm run build` sukses.

**Jebakan:** jangan percaya body webhook mentah (selalu cek ke API); `amount` di URL/verifikasi =
`order.total` kita (Pakasir menambah `fee` di atasnya untuk pembeli, tapi webhook/`transactiondetail`
mengembalikan `amount` dasar yang kita set — cocokkan dengan `order.total`); pakai **service-role**
di webhook (tak ada sesi); pastikan Webhook URL diisi di Proyek Pakasir & URL terdaftar di domain produksi.

---

## FASE 7 — Pesanan (admin), profil, dashboard, akun + bersih-bersih

**Tujuan:** lengkapi alur order & admin; baca dari DB; hapus `ProductContext`. Perbaiki B4, B6, C1.

### 7.1 DAL order & profil
`src/lib/data/orders.js`: `getMyOrders()` (order user login + items), `getAllOrders()` (admin),
`getOrderById(id)`. `src/lib/data/profiles.js`: `getAllProfiles()` (admin) untuk halaman Akun.

**WAJIB: `shapeOrder()` helper.** UI order yang ada (profil, dashboard, laporan) membaca bentuk
era-localStorage (`order.customer.name`, `order.items[].name/quantity`, `order.total`,
`order.createdAt`) yang **tidak** diproduksi DB (kolomnya `recipient_name`, `name_snapshot`,
`created_at`, dst). Tanpa remap, tabel order render `undefined` dan dashboard **crash** di
`order.customer.name`. Bentuk ulang seperti `shape()` produk:
```js
const ORDER_SELECT = `
  *,
  order_items ( product_id, name_snapshot, price_snapshot, size_snapshot, quantity )
`;
function shapeOrder(o) {
  return {
    id: o.id,
    status: o.status,
    total: o.total,
    subtotal: o.subtotal,
    shippingCost: o.shipping_cost,
    createdAt: o.created_at,
    customer: { name: o.recipient_name, phone: o.phone, address: o.address, userId: o.user_id },
    items: (o.order_items ?? []).map(oi => ({
      id: oi.product_id, name: oi.name_snapshot, price: oi.price_snapshot,
      selectedSize: oi.size_snapshot, quantity: oi.quantity,
    })),
  };
}
// getMyOrders/getAllOrders/getOrderById → select ORDER_SELECT, order by created_at desc, .map(shapeOrder).
// getMyOrders: filter .eq('user_id', <uid dari requireAuth>). getAllOrders: tanpa filter (admin via RLS).
```
> Tetap beri optional chaining (`order.customer?.name`) di komponen yang menampilkan order untuk
> ketahanan ekstra.

### 7.2 `src/app/admin/orders/page.js` (BARU — temuan B4)
- Server Component fetch `getAllOrders()`; tabel pesanan + aksi ubah status.
- Ubah status via Server Action `updateOrderStatus(orderId, status)`:
  ```js
  export async function updateOrderStatus(orderId, status) {
    await requireAdmin();                                  // baris pertama
    const STATUSES = ['Baru','Diproses','Dikirim','Selesai','Dibatalkan'];
    if (!z.string().uuid().safeParse(orderId).success) return { error: 'Order tidak valid' };
    if (!STATUSES.includes(status)) return { error: 'Status tidak valid' };
    const supabase = await createClient();
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) return { error: 'Gagal memperbarui status' };  // pesan generik, jangan bocorkan DB
    revalidatePath('/admin/orders'); revalidatePath('/profile');
    return { ok: true };
  }
  ```
- Tambahkan menu **"Pesanan"** ke sidebar admin (`admin/layout.js`/`AdminSidebar`).

### 7.3 Profil & riwayat pesanan
`src/app/profile/page.js`: jadikan server component (atau fetch server lalu render). Tampilkan
`getMyOrders()`. Hapus pemakaian `ProductContext`/`AuthContext` mutasi lama. Tambah detail order
(C1) minimal modal/expand.

Edit profil → Server Action `updateProfile` (jangan andalkan RLS saja):
```js
const ProfileSchema = z.object({
  full_name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80),
  phone: z.string().trim().max(20).optional(),
});
export async function updateProfile(prevState, formData) {
  const { user } = await requireAuth();                 // baris pertama (action POST-reachable)
  const parsed = ProfileSchema.safeParse({
    full_name: formData.get('full_name'), phone: formData.get('phone'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from('profiles')
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone ?? '' })
    .eq('id', user.id);                                  // scope ke diri sendiri
  if (error) return { error: 'Gagal menyimpan profil' };
  revalidatePath('/profile');
  return { ok: true };
}
```

### 7.4 Dashboard & Laporan admin
`src/app/admin/page.js` & `admin/reports/page.js`: baca dari DB (`getAllOrders`, `getProducts`,
`getCategories`). Statistik dihitung di server. Laporan cetak (`window.print`) tetap; filter
tanggal/kategori tetap (boleh tetap client memakai data yang sudah difetch server).

### 7.5 Akun admin — `src/lib/actions/accounts.js`
- **Daftar akun (B6):** `admin/accounts/page.js` baca `getAllProfiles()` (semua user kini terlihat).
- **Tambah admin (`createAdmin`):** **JEBAKAN — jangan UPDATE role pakai service-role.** Trigger
  `prevent_role_escalation` memanggil `is_admin()` yang membaca `auth.uid()`; di bawah service-role
  `auth.uid()` NULL → trigger menolak. Maka:
  1. `await requireAdmin()` (baris pertama).
  2. Buat user auth dengan **service-role** (hanya untuk createUser, yang memang butuh):
     ```js
     const admin = createAdminClient();   // SERVER ONLY
     const { data, error } = await admin.auth.admin.createUser({
       email, password, email_confirm: true, user_metadata: { full_name },
     });
     ```
  3. Naikkan peran lewat **RPC `set_user_role` dari client SESI admin** (bukan service-role), supaya
     `is_admin()` true & trigger lolos:
     ```js
     const supabase = await createClient();                 // sesi admin yang login
     await supabase.rpc('set_user_role', { p_user: data.user.id, p_role: 'admin' });
     ```
  > Jangan melemahkan trigger. Validasi input (Zod: email, password ≥ 6, full_name) sebelum semua.
- **Hapus user (`deleteUser`):** `await requireAdmin()` dulu, lalu:
  - Tolak bila `id === <uuid user yang login>` (jangan hapus diri sendiri).
  - Tolak bila target adalah **admin utama** — definisikan konkret: lindungi profil dengan
    `email = 'admin@rewearworks.com'` (cek via `getAllProfiles()`/join `auth.users`), atau tambah
    flag `is_protected`. (Opsional: tolak menghapus admin terakhir yang tersisa.)
  - Hapus via `createAdminClient().auth.admin.deleteUser(id)`. Profil ikut terhapus (cascade dari
    `auth.users`).
  - **Ganti semua literal lama `'admin-001'`** (di `admin/accounts` & AuthContext lama) dengan UUID
    user yang login — `'admin-001'` sudah tidak ada di dunia DB.

### 7.6 Bersih-bersih (penting)
- Hapus `src/context/ProductContext.js` dan `ProductProvider` dari `layout.js` setelah TIDAK ada
  lagi yang mengimport `useProducts`. **Cari dulu** semua pemakaian (`useProducts`) dan pastikan
  nol sebelum menghapus.
- `src/data/products.json` & `categories.json`: sudah dipakai untuk seed → boleh dipindah ke
  `docs/` atau dihapus (opsional; jangan dihapus bila masih diimport di mana pun).
- Pastikan tidak ada sisa baca/tulis `localStorage` untuk users/products/orders.

**Acceptance Fase 7:**
- [ ] `shapeOrder()` dipakai; tabel order (profil/dashboard/laporan) menampilkan nama, item, total,
      tanggal dengan benar (tidak `undefined`, tidak crash).
- [ ] Admin punya halaman Pesanan & bisa mengubah status; customer melihat status terbaru di profil.
- [ ] Halaman Akun admin menampilkan semua user dari `profiles`.
- [ ] `createAdmin` menghasilkan profil `role='admin'` **tanpa menonaktifkan**
      `prevent_role_escalation` (lewat RPC `set_user_role` dari sesi admin).
- [ ] `deleteUser` menolak menghapus diri sendiri & admin utama (admin@rewearworks.com); literal
      `admin-001` lama sudah dihapus.
- [ ] Dashboard & Laporan menampilkan angka dari DB.
- [ ] `ProductContext` dihapus; tidak ada `useProducts` tersisa; tidak ada localStorage untuk
      entitas server.
- [ ] `npm run build` sukses.

Lanjut ke **`04-deployment-security-testing.md`**.
