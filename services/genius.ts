const GENIUS_ACCESS_TOKEN = 'J2MKe3o5dqb8ckQyZVHib8D_N2xIOBLc30yPLpVMjvNZyvkqheSe7viq7DK-4yWv';


export const searchGeniusSong = async (artist: string, track: string) => {
  try {
    const query = `${artist} ${track}`;
    const targetUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);

    const response = await fetch(proxyUrl, {
      headers: {
        'Authorization': `Bearer ${GENIUS_ACCESS_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`Genius API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.response && data.response.hits && data.response.hits.length > 0) {
      return data.response.hits[0].result;
    }
    return null;
  } catch (error) {
    console.warn("Genius API Error (likely CORS or network), falling back to manual URL:", error);

    const formatForUrl = (str: string) => {
      return str
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
    };

    const artistSlug = formatForUrl(artist);
    const trackSlug = formatForUrl(track);

    return {
      url: `https://genius.com/${artistSlug}-${trackSlug}-lyrics`
    };
  }
};

export const fetchLyrics = async (artist: string, track: string): Promise<string | null> => {
  try {
    const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(track)}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.lyrics || null;
  } catch (error) {
    console.warn("Lyrics fetch failed:", error);
    return null;
  }
};
