import eventImages from './_event-images.mjs';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id') || '';
    const images = eventImages[id] || [];
    const photos = images.map((src) => ({ url: src, src }));
    return Response.json(
      { photos },
      { headers: { 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800' } }
    );
  }
};
