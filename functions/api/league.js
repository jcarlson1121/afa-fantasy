// Cloudflare Pages live league gateway (read-only).
// Stream the upstream JSON instead of buffering and parsing the entire dynasty
// in the Worker. The browser's applyLive() still validates before replacing its
// saved snapshot, so a failed or invalid fetch cannot erase displayed data.
const UPSTREAM = 'https://www.dynastytracker.app/api/view-dynasty?code=w5g1f7e9';

export async function onRequestGet() {
  try {
    const upstream = await fetch(UPSTREAM, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 30, cacheEverything: true },
      signal: AbortSignal.timeout(25000),
    });

    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { error: 'Dynasty Tracker returned ' + upstream.status },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Do not call text(), json(), clone() or construct a full JSON string here:
    // those operations increase memory and CPU usage on multi-MB league exports.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
        'X-Content-Type-Options': 'nosniff',
      }
    });
  } catch (error) {
    return Response.json(
      { error: 'Unable to retrieve live league data', detail: String(error.message || error) },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
