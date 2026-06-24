# Rewear Works — Master Implementation Plan (Backend + Integrasi)

> **Untuk siapa dokumen ini?** Untuk worker agent yang akan membangun backend Rewear Works.
> Ikuti dokumen ini **berurutan**, **fase demi fase**, **jangan melompat**. Setiap fase punya
> kriteria penerimaan (acceptance criteria). **Jangan lanjut ke fase berikutnya sebelum kriteria
> penerimaan fase saat ini terpenuhi dan terverifikasi.**

---

## 0. Ringkasan situasi

Rewear Works adalah marketplace **fashion preloved (baju bekas berkualitas)**. Saat ini aplikasi
**hanya frontend**:

- Next.js **16.2.9** (App Router) + React **19.2.4**, JavaScript (bukan TypeScript), folder `src/`.
- Semua data "hidup" di **`localStorage` browser** melalui 3 React Context:
  `AuthContext`, `CartContext`, `ProductContext`.
- Data awal di-seed dari file JSON: `src/data/products.json`, `src/data/categories.json`.
- **Tidak ada server, tidak ada database, tidak ada autentikasi nyata** (password tersimpan
  plaintext di localStorage, admin default hardcoded).

**Tujuan akhir:** ubah menjadi aplikasi full-stack nyata dengan:

- **Database + Auth + Storage: Supabase** (Postgres + Supabase Auth + Supabase Storage).
- **Hosting: Vercel**.
- Data produk/kategori/order/akun tersimpan di Postgres, gambar di Supabase Storage,
  autentikasi & otorisasi nyata dengan Row Level Security (RLS).

---

## 1. Urutan baca & kerja (WAJIB)

| Urutan | File | Isi |
|--------|------|-----|
| 1 | `README.md` (file ini) | Aturan main, golden rules, jebakan Next.js 16, pemetaan skill |
| 2 | `00-uiux-audit.md` | Audit kekurangan UI/UX + keputusan scope |
| 3 | `01-architecture-and-conventions.md` | Arsitektur target, model data, konvensi kode |
| 4 | `02-database-and-rls.md` + `schema.sql` + `seed.sql` | Skema Postgres, RLS, Storage, seed |
| 5 | `03-implementation-phases.md` | **Panduan implementasi fase demi fase (inti pekerjaan)** |
| 6 | `04-deployment-security-testing.md` | Deploy ke Vercel, hardening keamanan, testing |

---

## 2. GOLDEN RULES (langgar = pekerjaan ditolak)

1. **BACA DOKUMEN NEXT.JS DULU.** Ini **bukan** Next.js yang ada di data latihanmu. Sebelum
   menulis kode yang menyentuh fitur Next.js apa pun, baca file relevan di
   `node_modules/next/dist/docs/01-app/`. Lihat daftar jebakan di bagian §3.
2. **JANGAN pernah menaruh secret di client.** `SUPABASE_SERVICE_ROLE_KEY` dan secret lain
   **hanya** boleh dipakai di kode server (Server Action / Route Handler / Server Component).
   Hanya variabel berawalan `NEXT_PUBLIC_` yang boleh terbaca di client.
3. **Keamanan ditegakkan di server + RLS, bukan di UI.** Pengecekan `isAdmin` di client hanya
   untuk tampilan. Setiap Server Action / Route Handler **wajib** memverifikasi sesi & peran.
   RLS Postgres adalah pertahanan terakhir dan tidak boleh dimatikan.
4. **Satu fase = satu unit kerja yang terverifikasi.** Selesaikan acceptance criteria,
   jalankan `npm run build` (harus sukses) sebelum lanjut.
5. **Jangan mengubah desain visual/CSS** kecuali fase secara eksplisit memintanya. `globals.css`
   dan struktur className adalah kontrak desain — pertahankan. Pekerjaan ini soal backend &
   integrasi data, bukan redesign.
6. **Item preloved itu UNIK (stok = 1).** Logika keranjang, stok, dan checkout harus
   memperlakukan tiap produk sebagai barang satuan. Lihat keputusan di `00-uiux-audit.md` §B3.
7. **Jangan hapus data atau file tanpa diminta.** Migrasi, jangan menimpa membabi buta.
8. **JavaScript, bukan TypeScript.** Project ini `.js`. Jangan menambah TypeScript kecuali
   diminta. Gunakan alias import `@/*` → `./src/*` (lihat `jsconfig.json`).

---

## 3. JEBAKAN Next.js 16 (breaking changes yang akan menjebakmu)

Versi ini berbeda dari Next.js 13/14/15 yang mungkin kamu hafal. Sumber:
`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`.

| Hal | Yang BENAR di Next.js 16 | Kesalahan umum (JANGAN) |
|-----|--------------------------|--------------------------|
| **Middleware** | File bernama **`proxy.js`** (bukan `middleware.js`), export fungsi bernama `proxy`. Runtime **nodejs** (edge TIDAK didukung di proxy). | Membuat `middleware.js` / `export function middleware` |
| **`cookies()`** | **async**: `const store = await cookies()` | `const store = cookies()` (sinkron) — error |
| **`headers()` / `draftMode()`** | **async**: `await headers()` | dipanggil sinkron |
| **`params` di page/layout/route** | **Promise**. Server Component: `const { id } = await params`. Client Component: `const { id } = use(params)` | `params.id` langsung |
| **`searchParams` di page** | **Promise** (Server Component): `await searchParams` | akses sinkron |
| **`revalidateTag`** | beri argumen kedua profil cacheLife: `revalidateTag('products', 'max')` | `revalidateTag('products')` — **deprecated** (di project JS ini tidak menggagalkan build, tapi tetap hindari). NB: plan ini umumnya pakai `revalidatePath`, bukan `revalidateTag`. |
| **read-your-writes** | gunakan `updateTag(tag)` (Server Action) untuk langsung lihat perubahan; `refresh()` untuk refresh client router | mengandalkan `revalidateTag` saja lalu heran data masih lama |
| **`next/image` remote** | `images.remotePatterns` di `next.config.mjs`. `images.domains` **deprecated**. | pakai `images.domains` |
| **`next lint`** | dihapus. Pakai `eslint` CLI langsung (`npm run lint` sudah `"eslint"`). | menjalankan `next lint` |
| **Env runtime config** | `serverRuntimeConfig`/`publicRuntimeConfig` **dihapus**. Pakai `process.env` (server) & `NEXT_PUBLIC_*` (client). | `getConfig()` dari `next/config` |
| **Turbopack** | default untuk `dev` & `build`. Jangan tambah flag `--turbopack`. | menambah `--turbopack` |

> Catatan penting untuk project ini: halaman `src/app/product/[id]/page.js` adalah **Client
> Component** (`'use client'`) dan sudah benar memakai `use(params)`. Bila nanti diubah ke Server
> Component untuk fetch data, ganti ke `await params`. Lihat fase 4.

---

## 4. Pemetaan Skill yang dipakai per fase

Skill ini sudah terpasang di `~/.claude/skills/`. **Panggil/baca skill yang relevan sebelum
mengerjakan fase**, lalu terapkan metodologinya. Cara memakai: baca `SKILL.md` skill tersebut dan
ikuti prosesnya.

| Skill | Dipakai untuk |
|-------|----------------|
| `source-driven-development` | **Selalu.** Baca sumber kebenaran (docs Next.js di `node_modules`, docs Supabase) sebelum menulis kode. Jangan menebak API. |
| `spec-driven-development` | Memahami & mematuhi spec di dokumen plan ini sebelum implementasi. |
| `planning-and-task-breakdown` | Memecah tiap fase jadi sub-task kecil sebelum mulai. |
| `incremental-implementation` | Kerjakan potongan kecil, build & verifikasi tiap langkah. Jangan menulis 10 file lalu baru tes. |
| `test-driven-development` | Fase logika kritis (checkout, stok, auth guard): tulis test dulu (lihat fase 6 & `04-...`). |
| `security-and-hardening` | Fase 3 (auth), 5 (admin CRUD), 8 (deploy). Baca `references/security-checklist.md` di skill itu. |
| `debugging-and-error-recovery` | Saat build/test gagal: diagnosa akar masalah, jangan tambal asal. |
| `frontend-ui-engineering` | Fase 4 (render gambar nyata, next/image, Suspense, loading/error states). |
| `code-review-and-quality` | Akhir tiap fase: review diri sendiri terhadap acceptance criteria. |
| `git-workflow-and-versioning` | Commit per fase dengan pesan jelas (jika repo sudah di-init). |
| `observability-and-instrumentation` | Fase 8: logging error server, monitoring. |

---

## 5. Definisi "Selesai" untuk seluruh proyek

- [ ] `npm run build` sukses tanpa error.
- [ ] Tidak ada data yang lagi disimpan/dibaca dari `localStorage` untuk produk, kategori,
      order, dan user (kecuali keranjang tamu — lihat `01-...` §Cart).
- [ ] Login/Register/Logout nyata via Supabase Auth; sesi via cookie httpOnly.
- [ ] Admin CRUD produk/kategori/order/akun menulis ke Postgres; gambar ke Supabase Storage.
- [ ] Checkout membuat order nyata, memvalidasi stok di server, mencegah double-sell.
- [ ] Pembayaran via **Pakasir** (Fase 6B): redirect bayar, webhook diverifikasi ke Transaction
      Detail API, order ditandai `paid`; `PAKASIR_API_KEY` server-only.
- [ ] RLS aktif di semua tabel; secret tidak bocor ke client.
- [ ] Deploy ke Vercel berhasil, env terpasang, domain Supabase ada di `images.remotePatterns`.
- [ ] Acceptance criteria tiap fase tercentang.

Lanjut ke **`00-uiux-audit.md`**.
