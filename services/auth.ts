import { UserProfile, MatchHistory } from '../types';

const STORAGE_KEY = 'lyrics_guesser_users';
const CURRENT_USER_KEY = 'lyrics_guesser_current_user';

export const getUsers = (): Record<string, UserProfile> => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : {};
};

export const saveUser = (user: UserProfile) => {
  const users = getUsers();
  users[user.username] = user;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
};

export const loginUser = (username: string): UserProfile => {
  const users = getUsers();
  if (!users[username]) {
    const newUser: UserProfile = {
      username,
      gamesPlayed: 0,
      totalScore: 0,
      highScore: 0,
      history: [],
      favoriteArtists: {}
    };
    saveUser(newUser);
    localStorage.setItem(CURRENT_USER_KEY, username);
    document.cookie = `user=${username}; path=/; max-age=31536000`;
    return newUser;
  }

  localStorage.setItem(CURRENT_USER_KEY, username);
  document.cookie = `user=${username}; path=/; max-age=31536000`;
  return users[username];
};

export const getCurrentUser = (): UserProfile | null => {
  const username = localStorage.getItem(CURRENT_USER_KEY);
  if (!username) return null;
  const users = getUsers();
  return users[username] || null;
};

export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
  document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
};

export const deleteUser = (username: string) => {
  const users = getUsers();
  if (users[username]) {
    delete users[username];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }
  logoutUser();
};

export const updateUserStats = (
  username: string,
  score: number,
  totalRounds: number,
  artistName: string,
  difficulty: any
) => {
  const users = getUsers();
  const user = users[username];
  if (!user) return;

  user.gamesPlayed += 1;
  user.totalScore += score;
  if (score > user.highScore) {
    user.highScore = score;
  }

  const historyItem: MatchHistory = {
    date: new Date().toISOString(),
    artistName,
    score,
    totalRounds,
    difficulty
  };

  user.history = [historyItem, ...user.history].slice(0, 20);

  user.favoriteArtists[artistName] = (user.favoriteArtists[artistName] || 0) + 1;

  saveUser(user);
};