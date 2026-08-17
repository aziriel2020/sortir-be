import eventImages from './_event-images.mjs';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id') || '';
    const image = (eventImages[id] || [])[0];

    if (image) {
      return new Response(null, {
        status: 302,
        headers: {
          location: image,
          'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800'
        }
      });
    }

    // Transparent 1x1 GIF for the small minority of events with no recovered image.
    const gif = Uint8Array.from([
      71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,
      33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59
    ]);
    return new Response(gif, {
      headers: {
        'content-type': 'image/gif',
        'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800'
      }
    });
  }
};
