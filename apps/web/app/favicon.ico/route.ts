const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="10" fill="#12343b"/>
  <path d="M18 18h12v28H18zm16 0h12v28H34z" fill="#f58220"/>
</svg>`;

export function GET() {
  return new Response(favicon, {
    headers: {
      "cache-control": "public, max-age=86400",
      "content-type": "image/svg+xml",
    },
  });
}
