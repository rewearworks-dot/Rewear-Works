import { updateSession } from '@/lib/session';

export async function proxy(request) {
  return await updateSession(request);
}

export const config = {
  // Jalankan di semua rute kecuali aset statis & gambar
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
