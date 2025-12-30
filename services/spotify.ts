import { Artist, Track } from '../types';

const CLIENT_ID = '7ca9e705f39a44549d0a6790060d415b';
const CLIENT_SECRET = '701649b9129b4176900405a8fdb34a7b';

let accessToken: string | null = null;

export const getAccessToken = async (): Promise<string> => {
  if (accessToken) return accessToken;

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET),
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  accessToken = data.access_token;
  return data.access_token;
};

export const searchArtists = async (query: string): Promise<Artist[]> => {
  if (!query) return [];
  const token = await getAccessToken();
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=6`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await response.json();
  return data.artists.items;
};

export const getTopTracks = async (artistId: string): Promise<Track[]> => {
  const token = await getAccessToken();
  const response = await fetch(
    `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await response.json();
  return data.tracks;
};
