// CARTO basemap keys are browser credentials, not administrative API credentials.
// Keep the value out of the repository; Leaflet sends it directly to CARTO.
export default async (request) => {
  if (request.method !== 'GET') return new Response(null, { status: 405 });
  const key = Netlify.env.get('CARTO_BASEMAP_API_KEY')?.trim();
  return Response.json(key ? { key } : { error: 'Map configuration unavailable' }, {
    status: key ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
};
