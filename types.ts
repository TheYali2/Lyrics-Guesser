export interface Artist {
  id: string;
  name: string;
  images: { url: string; height: number; width: number }[];
  genres: string[];
}

export interface Track {
  id: string;
  name: string;
  album: {
    images: { url: string }[];
    name: string;
  };
}

export interface Question {
  artistName: string;
  correctTrack: Track;
  distractors: Track[];
  lyricSnippet: string;
  hintSnippet: string;
  geniusUrl?: string;
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface GameSettings {
  difficulty: Difficulty;
}

export interface GameState {
  score: number;
  lives: number;
  currentRound: number;
  totalRounds: number;
  questions: Question[];
  status: 'login' | 'menu' | 'search' | 'loading' | 'playing' | 'round_result' | 'game_over' | 'profile';
  selectedArtist: Artist | null;
  skipsRemaining: number;
  skipsUsed: number;
}

export interface MatchHistory {
  date: string;
  artistName: string;
  score: number;
  totalRounds: number;
  difficulty: Difficulty;
}

export interface UserProfile {
  username: string;
  gamesPlayed: number;
  totalScore: number;
  highScore: number;
  history: MatchHistory[];
  favoriteArtists: Record<string, number>;
}