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
    const songData = await searchGeniusSong(artist, track);
    if (!songData || !songData.url) return null;

    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(songData.url);
    const response = await fetch(proxyUrl);
    if (!response.ok) return null;
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let lyrics = '';

    const lyricContainers = doc.querySelectorAll('[data-lyrics-container="true"]');

    if (lyricContainers.length > 0) {
      lyricContainers.forEach(container => {
        let content = container.innerHTML;
        content = content.replace(/<br\s*\/?>/gi, '\n');

        const temp = document.createElement('div');
        temp.innerHTML = content;
        lyrics += temp.textContent + '\n';
      });
    } else {
      const oldContainer = doc.querySelector('.lyrics');
      if (oldContainer) {
        let content = oldContainer.innerHTML;
        content = content.replace(/<br\s*\/?>/gi, '\n');
        const temp = document.createElement('div');
        temp.innerHTML = content;
        lyrics = temp.textContent || '';
      }
    }

    const cleaned = lyrics.trim();
    return cleaned.length > 0 ? cleaned : null;
  } catch (error) {
    console.warn("Genius Lyrics fetch failed:", error);
    return null;
  }
};