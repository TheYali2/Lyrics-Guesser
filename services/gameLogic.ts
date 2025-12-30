import { Artist, Question, Track, Difficulty } from '../types';
import { getTopTracks } from './spotify';
import { fetchLyrics, searchGeniusSong } from './genius';

const getRandomTracks = (tracks: Track[], count: number, excludeId?: string): Track[] => {
  const filtered = excludeId ? tracks.filter(t => t.id !== excludeId) : tracks;
  const shuffled = [...filtered].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const cleanLyrics = (rawLyrics: string): string[] => {
  return rawLyrics
    .split('\n')
    .map(line => line.trim())
    .filter(line =>
      line.length > 0 &&
      !line.startsWith('[') &&
      !line.endsWith(']') &&
      !line.toLowerCase().includes('chorus') &&
      !line.toLowerCase().includes('verse')
    );
};

export const generateGameRound = async (artist: Artist, difficulty: Difficulty): Promise<Question> => {
  let allTracks = await getTopTracks(artist.id);

  let totalOptions = 6;
  if (difficulty === 'Easy') totalOptions = 3;
  if (difficulty === 'Medium') totalOptions = 4;

  if (allTracks.length < totalOptions) {
    if (allTracks.length < 2) throw new Error("Artist doesn't have enough tracks.");
    totalOptions = allTracks.length;
  }

  allTracks = allTracks.sort(() => 0.5 - Math.random());

  let correctTrack: Track | null = null;
  let lyricSnippet = "";
  let hintSnippet = "";
  let geniusUrl = "";

  for (const track of allTracks) {
    const rawLyrics = await fetchLyrics(artist.name, track.name);

    if (rawLyrics) {
      const cleanLines = cleanLyrics(rawLyrics);

      if (cleanLines.length >= 6) {

        const maxIndex = cleanLines.length - 4;
        const startIndex = Math.floor(Math.random() * maxIndex);

        lyricSnippet = cleanLines[startIndex];

        let hintCount = 2;
        if (difficulty === 'Easy') hintCount = 3;
        if (difficulty === 'Hard') hintCount = 1;

        hintSnippet = cleanLines.slice(startIndex + 1, startIndex + 1 + hintCount).join('\n');

        if (lyricSnippet && hintSnippet) {
          correctTrack = track;

          const geniusData = await searchGeniusSong(artist.name, track.name);
          if (geniusData) {
            geniusUrl = geniusData.url;
          }

          break;
        }
      }
    }
  }

  if (!correctTrack) {
    throw new Error("Could not find lyrics for any of the top tracks for this artist.");
  }

  const numDistractors = Math.min(totalOptions - 1, allTracks.length - 1);

  const distractors = getRandomTracks(allTracks, numDistractors, correctTrack.id);

  return {
    artistName: artist.name,
    correctTrack,
    distractors: distractors.sort(() => 0.5 - Math.random()),
    lyricSnippet,
    hintSnippet,
    geniusUrl
  };
};