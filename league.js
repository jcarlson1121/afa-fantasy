// Cloudflare Pages Function: https://<your-site>.pages.dev/api/league
// Read-only gateway; this never writes to Dynasty Tracker.
const UPSTREAM = 'https://www.dynastytracker.app/api/view-dynasty?code=w5g1f7e9';
export async function onRequestGet() {
  try {
    const response = await fetch(UPSTREAM, {
      headers: { 'Accept': 'application/json' },
      cf: { cacheTtl: 30, cacheEverything: true },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      return Response.json({ error: 'Dynasty Tracker returned '+response.status }, { status: 502, headers: {'Cache-Control':'no-store'} });
    }
    const text = await response.text();
    if (text.length < 200) throw new Error('Upstream response was unexpectedly short');
    const data = JSON.parse(text);
    const main = data.mainDoc || data;
    if (!main || !main.teams || !Array.isArray(data.players) || !Array.isArray(data.games)) {
      throw new Error('Missing expected league data');
    }
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
        'X-Content-Type-Options':'nosniff'
      }
    });
  } catch (error) {
    return Response.json({error:'Unable to retrieve validated live league data', detail:String(error.message||error)}, {
      status: 502, headers: {'Cache-Control':'no-store'}
    });
  }
}
