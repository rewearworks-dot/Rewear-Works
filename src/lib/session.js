import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Graceful: jika belum dikonfigurasi, skip session refresh
  if (!url || !key || url.includes('YOUR-')) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // PENTING: getUser() menyegarkan token. Jangan taruh logika di antara create & getUser.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    // Supabase unreachable, skip
    return response;
  }

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
