import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Retrieve user role if logged in
  let role = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    role = profile?.role;
  }

  // Define allowed path prefixes for roles
  const isAdminPath = pathname.startsWith('/admin');
  const isStudentPath = pathname.startsWith('/student');
  const isAuthPage = pathname === '/login' || pathname === '/register';

  // Unauthenticated users trying to access protected routes go to login
  if (!user && (isAdminPath || isStudentPath)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Logged in users
  if (user) {
    // If they are on auth pages (except /login/admin), redirect to dashboard
    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = role === 'admin' ? '/admin' : '/student';
      return NextResponse.redirect(url);
    }

    // Role-based route enforcement
    if (role === 'admin' && isStudentPath) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }

    if (role !== 'admin' && isAdminPath) {
      const url = request.nextUrl.clone();
      url.pathname = '/student';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
