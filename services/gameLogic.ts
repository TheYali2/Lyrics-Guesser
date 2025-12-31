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

export const fetchArtistTracks = async (artistId: string): Promise<Track[]> => {
  return await getTopTracks(artistId);
};

export const generateGameRound = async (
  artistName: string,
  allTracks: Track[],
  difficulty: Difficulty,
  usedTrackIds: string[] = []
): Promise<Question> => {

  let totalOptions = 4;
  if (difficulty === 'Easy') totalOptions = 3;
  if (difficulty === 'Hard') totalOptions = 6;

  let availableForQuestion = allTracks.filter(t => !usedTrackIds.includes(t.id));

  if (availableForQuestion.length === 0) {
    availableForQuestion = allTracks;
  }

  availableForQuestion = availableForQuestion.sort(() => 0.5 - Math.random());

  const BATCH_SIZE = 3;
  let validQuestion: Partial<Question> | null = null;
  let selectedTrack: Track | null = null;

  for (let i = 0; i < availableForQuestion.length; i += BATCH_SIZE) {
    const batch = availableForQuestion.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (track) => {
        const rawLyrics = await fetchLyrics(artistName, track.name);
        if (!rawLyrics) return null;

        const cleanLines = cleanLyrics(rawLyrics);
        if (cleanLines.length < 6) return null;

        const maxIndex = cleanLines.length - 4;
        const startIndex = Math.floor(Math.random() * maxIndex);
        const lyricSnippet = cleanLines[startIndex];

        let hintCount = 2;
        if (difficulty === 'Easy') hintCount = 3;
        if (difficulty === 'Hard') hintCount = 1;

        const hintSnippet = cleanLines.slice(startIndex + 1, startIndex + 1 + hintCount).join('\n');

        if (!lyricSnippet || !hintSnippet) return null;

        let geniusUrl = undefined;
        try {
          const geniusData = await searchGeniusSong(artistName, track.name);
          if (geniusData) geniusUrl = geniusData.url;
        } catch (e) { }

        return {
          track,
          lyricSnippet,
          hintSnippet,
          geniusUrl
        };
      })
    );

    const match = results.find(r => r !== null);
    if (match) {
      selectedTrack = match.track;
      validQuestion = {
        artistName,
        correctTrack: match.track,
        lyricSnippet: match.lyricSnippet,
        hintSnippet: match.hintSnippet,
        geniusUrl: match.geniusUrl
      };
      break; // Found
    }
  }

  if (!validQuestion || !selectedTrack) {
    throw new Error("Could not find lyrics for any of the tracks.");
  }

  const numDistractors = Math.min(totalOptions - 1, allTracks.length - 1);

  const distractors = getRandomTracks(allTracks, numDistractors, selectedTrack.id);

  return {
    artistName,
    correctTrack: selectedTrack,
    distractors: distractors.sort(() => 0.5 - Math.random()),
    lyricSnippet: validQuestion.lyricSnippet!,
    hintSnippet: validQuestion.hintSnippet!,
    geniusUrl: validQuestion.geniusUrl
  };
};