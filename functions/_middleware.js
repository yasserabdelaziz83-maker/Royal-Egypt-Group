// Pages Functions middleware — blocks access to sensitive files
// and adds security headers to all responses.

const BLOCKED_PATHS = [
  /^\/migrations\//i,
  /^\/wrangler\.toml$/i,
  /^\/AI_HANDOFF\.md$/i,
  /^\/CLOUDFLARE_LISTINGS_SETUP\.md$/i,
  /^\/CONTACT_INTAKE_TEST\.md$/i,
  /^\/README\.md$/i,
  /^\/\.github\//i,
];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Block access to sensitive files
  for (const pattern of BLOCKED_PATHS) {
    if (pattern.test(path)) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS },
      });
    }
  }

  // Add noindex header for admin pages
  const is_admin = path.startsWith('/admin') || path === '/admin-inbox.html';

  // Pass through to the next handler
  const response = await next();

  // Add security headers to all responses
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newHeaders.set(key, value);
  }
  if (is_admin) {
    newHeaders.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
