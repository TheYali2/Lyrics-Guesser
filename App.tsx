import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Music2, Mic2, HelpCircle, RefreshCcw, Trophy, LogOut, User as UserIcon, SkipForward, PlayCircle, Disc, Calendar, ArrowLeft, Heart, XCircle, AlertTriangle, Share2, Timer, ListMusic } from 'lucide-react';
import html2canvas from 'html2canvas';

import { Artist, GameState, Difficulty, UserProfile } from './types';
import { searchArtists } from './services/spotify';
import { generateGameRound } from './services/gameLogic';
import { BlurTransition } from './components/BlurTransition';
import { loginUser, getCurrentUser, logoutUser, updateUserStats, deleteUser } from './services/auth';
import { ToastContainer, ToastMessage } from './components/Toast';

const MAX_LIVES = 3;
const MAX_SKIPS = 3;

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [usernameInput, setUsernameInput] = useState('');

  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');

  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: MAX_LIVES,
    currentRound: 0,
    totalRounds: 0,
    questions: [],
    status: 'login',
    selectedArtist: null,
    skipsRemaining: MAX_SKIPS,
    skipsUsed: 0
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [roundResult, setRoundResult] = useState<'correct' | 'incorrect' | null>(null);

  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [maxTime, setMaxTime] = useState<number>(0);

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const existingUser = getCurrentUser();
    if (existingUser) {
      setUser(existingUser);
      setGameState(prev => ({ ...prev, status: 'menu' }));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedQuery.trim().length > 0 && gameState.status === 'search') {
      setLoading(true);
      searchArtists(debouncedQuery)
        .then((artists) => {
          setSearchResults(artists);
          setLoading(false);
        })
        .catch((err) => {
          setLoading(false);
          addToast("Failed to search artists", 'error');
        });
    } else {
      setSearchResults([]);
    }
  }, [debouncedQuery, gameState.status]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (gameState.status === 'playing' && timeLeft > 0 && !selectedAnswer) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && gameState.status === 'playing' && !selectedAnswer) {
      handleTimeUp();
    }

    return () => clearInterval(interval);
  }, [timeLeft, gameState.status, selectedAnswer]);

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      const loggedInUser = loginUser(usernameInput.trim());
      setUser(loggedInUser);
      setGameState(prev => ({ ...prev, status: 'menu' }));
      setUsernameInput('');
    }
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    if (user) {
      deleteUser(user.username);
      setUser(null);
      setGameState(prev => ({ ...prev, status: 'login' }));
      setShowLogoutConfirm(false);
      addToast("User deleted and logged out.", 'success');
    }
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const getRoundDuration = (diff: Difficulty) => {
    if (diff === 'Easy') return 30;
    if (diff === 'Medium') return 15;
    return Math.floor(Math.random() * (10 - 5 + 1) + 5);
  };

  const getTotalRounds = (diff: Difficulty) => {
    switch (diff) {
      case 'Easy': return 5;
      case 'Medium': return 8;
      case 'Hard': return 13;
      default: return 8;
    }
  };

  const startRoundTimer = () => {
    const duration = getRoundDuration(difficulty);
    setMaxTime(duration);
    setTimeLeft(duration);
  };

  const startGame = async (artist: Artist) => {
    const totalRounds = getTotalRounds(difficulty);

    setGameState(prev => ({
      ...prev,
      status: 'loading',
      selectedArtist: artist,
      score: 0,
      lives: MAX_LIVES,
      currentRound: 1,
      totalRounds: totalRounds,
      skipsRemaining: MAX_SKIPS,
      skipsUsed: 0,
      questions: []
    }));

    try {
      const question = await generateGameRound(artist, difficulty);
      setGameState(prev => ({
        ...prev,
        questions: [question],
        status: 'playing',
      }));
      setHintRevealed(false);
      setSelectedAnswer(null);
      setRoundResult(null);
      startRoundTimer();
    } catch (error) {
      console.error(error);
      setGameState(prev => ({ ...prev, status: 'search' }));
      addToast("Could not find lyrics for this artist. Please try another.", 'error');
    }
  };

  const handleExitClick = () => {
    setShowExitConfirm(true);
  };

  const confirmExitGame = () => {
    setShowExitConfirm(false);
    setGameState(prev => ({ ...prev, status: 'menu' }));
  };

  const cancelExitGame = () => {
    setShowExitConfirm(false);
  };

  const handleSkip = async () => {
    if (gameState.skipsRemaining <= 0) return;

    setGameState(prev => ({
      ...prev,
      status: 'loading',
      skipsRemaining: prev.skipsRemaining - 1,
      skipsUsed: prev.skipsUsed + 1
    }));

    try {
      const nextQuestion = await generateGameRound(gameState.selectedArtist!, difficulty);
      setGameState(prev => ({
        ...prev,
        questions: [...prev.questions.slice(0, -1), nextQuestion],
        status: 'playing',
      }));
      setHintRevealed(false);
      setSelectedAnswer(null);
      setRoundResult(null);
      startRoundTimer();
    } catch (e) {
      addToast("Failed to skip. No more songs found.", 'error');
      setGameState(prev => ({ ...prev, status: 'playing' }));
    }
  };

  const handleTimeUp = () => {
    setRoundResult('incorrect');
    setSelectedAnswer('TIME_UP');

    let newLives = gameState.lives - 1;
    setGameState(prev => ({ ...prev, lives: newLives }));

    processRoundEnd(newLives, gameState.score);
  };

  const handleAnswer = (trackId: string) => {
    if (selectedAnswer || timeLeft === 0) return;

    setSelectedAnswer(trackId);
    const currentQuestion = gameState.questions[gameState.questions.length - 1];
    const isCorrect = trackId === currentQuestion.correctTrack.id;

    setRoundResult(isCorrect ? 'correct' : 'incorrect');

    let newLives = gameState.lives;
    let newScore = gameState.score;

    if (isCorrect) {
      newScore += 1;
      setGameState(prev => ({ ...prev, score: newScore }));
    } else {
      newLives -= 1;
      setGameState(prev => ({ ...prev, lives: newLives }));
    }

    processRoundEnd(newLives, newScore);
  };

  const processRoundEnd = (newLives: number, newScore: number) => {
    setTimeout(async () => {
      const roundsCompleted = gameState.currentRound >= gameState.totalRounds;

      if (newLives === 0 || roundsCompleted) {
        if (user && gameState.selectedArtist) {
          updateUserStats(user.username, newScore, gameState.totalRounds, gameState.selectedArtist.name, difficulty);
          const updatedUser = getCurrentUser();
          if (updatedUser) setUser(updatedUser);
        }
        setGameState(prev => ({ ...prev, status: 'game_over' }));
      } else {
        setGameState(prev => ({ ...prev, status: 'loading', currentRound: prev.currentRound + 1 }));
        try {
          const nextQuestion = await generateGameRound(gameState.selectedArtist!, difficulty);
          setGameState(prev => ({
            ...prev,
            questions: [...prev.questions, nextQuestion],
            status: 'playing',
          }));
          setHintRevealed(false);
          setSelectedAnswer(null);
          setRoundResult(null);
          startRoundTimer();
        } catch (e) {
          if (user && gameState.selectedArtist) {
            updateUserStats(user.username, newScore, gameState.totalRounds, gameState.selectedArtist.name, difficulty);
            const updatedUser = getCurrentUser();
            if (updatedUser) setUser(updatedUser);
          }
          setGameState(prev => ({ ...prev, status: 'game_over' }));
        }
      }
    }, 2500);
  }

  const resetGame = () => {
    setGameState({
      score: 0,
      lives: MAX_LIVES,
      currentRound: 0,
      totalRounds: 0,
      questions: [],
      status: 'menu',
      selectedArtist: null,
      skipsRemaining: MAX_SKIPS,
      skipsUsed: 0
    });
    setSearchQuery('');
    setSearchResults([]);
    setHintRevealed(false);
    setSelectedAnswer(null);
    setRoundResult(null);
  };

  const handleShareProfile = async () => {
    if (!profileRef.current) return;

    try {
      const canvas = await html2canvas(profileRef.current, {
        backgroundColor: '#050505',
        scale: 2,
        useCORS: true
      });

      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          const item = new ClipboardItem({ 'image/png': blob });
          navigator.clipboard.write([item]).then(() => {
            addToast("Profile image copied to clipboard!", 'success');
          }).catch(() => {
            addToast("Failed to copy to clipboard.", 'error');
          });
        }
      }, 'image/png');
    } catch (e) {
      console.error(e);
      addToast("Failed to generate image.", 'error');
    }
  };

  const DifficultyBadge = ({ level, active, onClick }: { level: Difficulty, active: boolean, onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`px-3 py-2 md:px-4 md:py-2 text-sm md:text-base rounded-full border transition-all ${active ? 'bg-purple-600 border-purple-600 text-white' : 'bg-transparent border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}
    >
      {level}
    </button>
  );

  return (
    <div className="min-h-screen bg-black text-white selection:bg-purple-500 selection:text-white overflow-x-hidden flex flex-col items-center p-4 md:p-8 font-sans">

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <header className="absolute top-0 left-0 w-full p-4 md:p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2 text-xl md:text-2xl font-bold tracking-tighter cursor-pointer" onClick={() => user && setGameState(prev => ({ ...prev, status: 'menu' }))}>
          <Music2 className="text-purple-500 w-6 h-6 md:w-8 md:h-8" />
          <span className="hidden sm:inline bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Lyrics Guesser
          </span>
        </div>
        {user && (
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setGameState(prev => ({ ...prev, status: 'profile' }))} className="flex items-center gap-2 text-sm font-semibold hover:text-purple-400 transition-colors bg-neutral-900/50 md:bg-transparent px-3 py-1.5 md:p-0 rounded-full md:rounded-none border md:border-none border-neutral-800">
              <UserIcon className="w-4 h-4 md:w-5 md:h-5" />
              <span className="max-w-[100px] truncate">{user.username}</span>
            </button>
            <button onClick={handleLogoutClick} className="p-2 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </header>

      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-red-900/20 rounded-full text-red-500">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Quit Game?</h3>
                  <p className="text-neutral-400 text-sm leading-relaxed">
                    Are you sure you want to exit? Your current progress will not be saved.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full pt-2">
                  <button
                    onClick={cancelExitGame}
                    className="py-3 px-4 rounded-xl font-semibold bg-neutral-800 text-white hover:bg-neutral-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmExitGame}
                    className="py-3 px-4 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Yes, Quit
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-red-900/20 rounded-full text-red-500">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Delete User?</h3>
                  <p className="text-neutral-400 text-sm leading-relaxed">
                    Warning: Logging out will <strong>delete your user profile</strong> and all progress permanently.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full pt-2">
                  <button
                    onClick={cancelLogout}
                    className="py-3 px-4 rounded-xl font-semibold bg-neutral-800 text-white hover:bg-neutral-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmLogout}
                    className="py-3 px-4 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Delete & Logout
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-5xl relative min-h-screen flex flex-col items-center justify-center pt-24 pb-10">
        <AnimatePresence mode="wait">

          {gameState.status === 'login' && (
            <BlurTransition key="login" className="w-full max-w-md mx-auto">
              <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-8 rounded-3xl shadow-2xl">
                <div className="text-center mb-8">
                  <Music2 className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                  <h1 className="text-3xl font-bold mb-2">Welcome</h1>
                  <p className="text-neutral-400">Enter your username to start playing!</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Username"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors text-white placeholder-neutral-500"
                  />
                  <button
                    type="submit"
                    disabled={!usernameInput.trim()}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Playing
                  </button>
                </form>
                <p className="text-center mt-6 text-xs text-neutral-500">
                  Your progress is saved locally in this browser.
                </p>
              </div>
            </BlurTransition>
          )}

          {gameState.status === 'menu' && (
            <BlurTransition key="menu" className="flex flex-col items-center gap-8 text-center px-4">
              <div className="space-y-2">
                <h1 className="text-5xl md:text-7xl font-bold tracking-tighter">Ready to <span className="text-purple-500">Play?</span></h1>
                <p className="text-xl text-neutral-400">Select your challenge level</p>
              </div>

              <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((level) => (
                  <DifficultyBadge
                    key={level}
                    level={level}
                    active={difficulty === level}
                    onClick={() => setDifficulty(level)}
                  />
                ))}
              </div>

              <div className="p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800 max-w-sm">
                <p className="text-sm text-neutral-400">
                  {difficulty === 'Easy' && "30s Timer, 5 Rounds, 3 Options."}
                  {difficulty === 'Medium' && "15s Timer, 8 Rounds, 4 Options."}
                  {difficulty === 'Hard' && "5-10s Timer, 13 Rounds, 6 Options."}
                </p>
              </div>

              <button
                onClick={() => setGameState(prev => ({ ...prev, status: 'search' }))}
                className="bg-white text-black px-8 py-4 rounded-full font-bold text-xl hover:scale-105 transition-transform flex items-center gap-2"
              >
                <Search className="w-6 h-6" /> Pick an Artist
              </button>
            </BlurTransition>
          )}

          {gameState.status === 'search' && (
            <BlurTransition key="search" className="w-full flex flex-col items-center space-y-6 md:space-y-8">

              <div className="w-full max-w-2xl flex flex-col md:flex-row gap-4 md:items-center">
                <button
                  onClick={() => setGameState(prev => ({ ...prev, status: 'menu' }))}
                  className="self-start md:self-auto px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium border border-neutral-800"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>

                <div className="relative flex-1 group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                  <div className="relative flex items-center bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-2xl">
                    <Search className="w-5 h-5 md:w-6 md:h-6 text-neutral-500 mr-4" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for an artist..."
                      className="w-full bg-transparent text-lg md:text-xl text-white placeholder-neutral-500 outline-none font-medium"
                      autoFocus
                    />
                    {loading && (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-neutral-600 border-t-white ml-2"></div>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mt-4">
                {searchResults.map((artist) => (
                  <motion.button
                    key={artist.id}
                    onClick={() => startGame(artist)}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.05)" }}
                    whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center p-4 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-neutral-800 group"
                  >
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden mb-4 shadow-lg ring-2 ring-neutral-800 group-hover:ring-purple-500 transition-all">
                      {artist.images[0] ? (
                        <img src={artist.images[0].url} alt={artist.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                          <Mic2 className="w-10 h-10 text-neutral-600" />
                        </div>
                      )}
                    </div>
                    <span className="font-semibold text-base md:text-lg text-center truncate w-full">{artist.name}</span>
                  </motion.button>
                ))}
              </div>
            </BlurTransition>
          )}

          {gameState.status === 'loading' && (
            <BlurTransition key="loading" className="flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="absolute -inset-4 bg-purple-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                <Disc className="w-16 h-16 text-purple-500 animate-spin" />
              </div>
              <p className="text-xl font-medium text-neutral-400 animate-pulse">Loading...</p>
            </BlurTransition>
          )}

          {gameState.status === 'playing' && gameState.questions.length > 0 && (
            <BlurTransition key="game" className="w-full max-w-4xl flex flex-col items-center">

              <div className="w-full mb-6">
                <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden mb-4 relative">
                  <motion.div
                    className={`h-full ${timeLeft <= 5 ? 'bg-red-500' : 'bg-purple-500'}`}
                    initial={{ width: '100%' }}
                    animate={{ width: `${(timeLeft / maxTime) * 100}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </div>

                <div className="w-full flex flex-col md:flex-row justify-between items-center border-b border-neutral-800 pb-4 gap-4 md:gap-0">
                  <div className="w-full md:w-auto flex items-center justify-between gap-4">
                    <button
                      onClick={handleExitClick}
                      className="text-neutral-500 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-neutral-800"
                      title="Quit Game"
                    >
                      <XCircle className="w-6 h-6" />
                    </button>

                    <div className="flex items-center gap-3">
                      {gameState.selectedArtist?.images[0] && (
                        <img src={gameState.selectedArtist.images[0].url} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover ring-2 ring-neutral-800" />
                      )}
                      <div>
                        <h2 className="text-[10px] md:text-xs text-neutral-400 uppercase tracking-widest font-bold">Artist</h2>
                        <p className="font-semibold text-sm md:text-base text-white">{gameState.selectedArtist?.name}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800">
                      <ListMusic className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-bold text-white">Round {gameState.currentRound}/{gameState.totalRounds}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800">
                      <Timer className="w-4 h-4 text-neutral-400" />
                      <span className={`text-sm font-bold font-mono ${timeLeft <= 5 ? 'text-red-500' : 'text-white'}`}>{timeLeft}s</span>
                    </div>
                  </div>

                  <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-4">
                    <button
                      onClick={handleSkip}
                      disabled={gameState.skipsRemaining <= 0 || !!selectedAnswer}
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      <SkipForward className="w-4 h-4" /> Skip ({gameState.skipsRemaining})
                    </button>
                    <div className="flex gap-1">
                      {[...Array(MAX_LIVES)].map((_, i) => (
                        <Heart
                          key={i}
                          className={`w-5 h-5 ${i < gameState.lives ? 'text-red-500 fill-red-500' : 'text-neutral-800 fill-neutral-800'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full bg-neutral-900/50 backdrop-blur-md rounded-3xl p-6 md:p-12 border border-neutral-800 shadow-2xl relative overflow-hidden mb-6 md:mb-8 transition-all">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-pink-500"></div>

                <div className="mb-6 pt-4">
                  <p className="text-xl md:text-3xl font-bold leading-relaxed text-white font-serif italic text-center">
                    "{gameState.questions[gameState.questions.length - 1].lyricSnippet}"
                  </p>
                </div>

                <AnimatePresence>
                  {hintRevealed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-neutral-800/50 rounded-xl p-4 border border-neutral-700 mt-4">
                        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">HINT (NEXT LINE)</h4>
                        <p className="text-base md:text-lg text-neutral-300 whitespace-pre-line text-center">
                          {gameState.questions[gameState.questions.length - 1].hintSnippet}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!hintRevealed && !selectedAnswer && (
                  <button
                    onClick={() => setHintRevealed(true)}
                    className="mt-4 mx-auto flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-purple-400 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4" /> Reveal Hint
                  </button>
                )}
              </div>

              <div className={`w-full grid gap-3 md:gap-4 ${(gameState.questions[gameState.questions.length - 1].distractors.length + 1) === 3
                ? 'grid-cols-1 md:grid-cols-3'
                : (gameState.questions[gameState.questions.length - 1].distractors.length + 1) === 4
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                }`}>
                {[gameState.questions[gameState.questions.length - 1].correctTrack, ...gameState.questions[gameState.questions.length - 1].distractors]
                  .sort((a, b) => a.id.localeCompare(b.id))
                  .map((track) => {
                    let statusClass = "bg-neutral-900 border-neutral-800 hover:border-purple-500 hover:bg-neutral-800";
                    if (selectedAnswer) {
                      if (track.id === gameState.questions[gameState.questions.length - 1].correctTrack.id) {
                        statusClass = "bg-green-900/30 border-green-500 text-green-100";
                      } else if (track.id === selectedAnswer) {
                        statusClass = "bg-red-900/30 border-red-500 text-red-100";
                      } else {
                        statusClass = "bg-neutral-900 border-neutral-800 opacity-20 blur-sm";
                      }
                    }

                    return (
                      <motion.button
                        key={track.id}
                        onClick={() => handleAnswer(track.id)}
                        disabled={!!selectedAnswer || timeLeft === 0}
                        whileHover={(!selectedAnswer && timeLeft > 0) ? { scale: 1.02 } : {}}
                        whileTap={(!selectedAnswer && timeLeft > 0) ? { scale: 0.98 } : {}}
                        className={`p-3 md:p-4 rounded-xl border text-left transition-all duration-300 flex items-center gap-3 md:gap-4 ${statusClass}`}
                      >
                        {track.album.images[0] ? (
                          <img src={track.album.images[0].url} className="w-10 h-10 md:w-12 md:h-12 rounded-md shadow-sm shrink-0" />
                        ) : (
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-neutral-800 rounded-md flex items-center justify-center shrink-0">
                            <Music2 className="w-5 h-5 text-neutral-600" />
                          </div>
                        )}
                        <div className="flex-1 overflow-hidden min-w-0">
                          <p className="font-semibold truncate text-sm md:text-base">{track.name}</p>
                          <p className="text-xs text-neutral-400 truncate">{track.album.name}</p>
                        </div>
                        {selectedAnswer && track.id === gameState.questions[gameState.questions.length - 1].correctTrack.id && (
                          <PlayCircle className="w-5 h-5 text-green-500 shrink-0" />
                        )}
                      </motion.button>
                    );
                  })}
              </div>
            </BlurTransition>
          )}

          {gameState.status === 'game_over' && (
            <BlurTransition key="result" className="text-center flex flex-col items-center w-full max-w-lg mx-auto">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-orange-900/50"
              >
                <Trophy className="w-12 h-12 md:w-16 md:h-16 text-white" />
              </motion.div>

              <h2 className="text-4xl md:text-5xl font-bold mb-2">
                {gameState.lives > 0 ? "Victory!" : "Game Over!"}
              </h2>
              <div className="flex items-center gap-2 mb-8">
                <span className="bg-neutral-800 text-neutral-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{difficulty} Mode</span>
              </div>

              <p className="text-neutral-400 text-lg mb-2">Final Score</p>
              <div className="text-7xl md:text-8xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-600 mb-8">
                {gameState.score}
              </div>

              <div className="grid grid-cols-2 gap-4 w-full mb-8">
                <button
                  onClick={resetGame}
                  className="col-span-1 bg-white text-black py-4 rounded-xl font-bold text-lg hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCcw className="w-5 h-5" /> Menu
                </button>
                <button
                  onClick={() => startGame(gameState.selectedArtist!)}
                  className="col-span-1 bg-neutral-800 text-white py-4 rounded-xl font-bold text-lg hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2"
                >
                  <PlayCircle className="w-5 h-5" /> Replay
                </button>
              </div>
            </BlurTransition>
          )}

          {gameState.status === 'profile' && user && (
            <BlurTransition key="profile" className="w-full max-w-3xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <button onClick={() => setGameState(prev => ({ ...prev, status: 'menu' }))} className="text-neutral-500 hover:text-white flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Back to Menu
                </button>
                <button
                  onClick={handleShareProfile}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-sm font-semibold transition-colors"
                >
                  <Share2 className="w-4 h-4" /> Share Stats
                </button>
              </div>

              <div ref={profileRef} className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-xl">
                <div className="flex items-center gap-6 mb-8 border-b border-neutral-800 pb-8">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-2xl md:text-3xl font-bold">
                    {user.username[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold">{user.username}</h2>
                    <p className="text-neutral-400">Guessing since {new Date().getFullYear()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-neutral-800/50 p-4 rounded-xl">
                    <div className="text-neutral-400 text-xs uppercase font-bold mb-1">Total Games</div>
                    <div className="text-2xl font-bold">{user.gamesPlayed}</div>
                  </div>
                  <div className="bg-neutral-800/50 p-4 rounded-xl">
                    <div className="text-neutral-400 text-xs uppercase font-bold mb-1">Total Score</div>
                    <div className="text-2xl font-bold">{user.totalScore}</div>
                  </div>
                  <div className="bg-neutral-800/50 p-4 rounded-xl">
                    <div className="text-neutral-400 text-xs uppercase font-bold mb-1">High Score</div>
                    <div className="text-2xl font-bold text-yellow-500">{user.highScore}</div>
                  </div>
                  <div className="bg-neutral-800/50 p-4 rounded-xl">
                    <div className="text-neutral-400 text-xs uppercase font-bold mb-1">Top Artist</div>
                    <div className="text-lg font-bold truncate">
                      {Object.entries(user.favoriteArtists).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-neutral-500" /> Recent Plays
                </h3>
                <div className="space-y-3">
                  {user.history.length === 0 ? (
                    <p className="text-neutral-500">No games played!</p>
                  ) : (
                    user.history.map((match, i) => (
                      <div key={i} className="flex justify-between items-center bg-neutral-800/30 p-4 rounded-xl border border-neutral-800/50">
                        <div>
                          <p className="font-bold text-white text-sm md:text-base">{match.artistName}</p>
                          <p className="text-xs text-neutral-500">{new Date(match.date).toLocaleDateString()} • {match.difficulty}</p>
                        </div>
                        <div className="text-lg md:text-xl font-bold text-neutral-300">
                          {match.score} Correct
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </BlurTransition>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default App;