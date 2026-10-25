import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { gsap } from 'gsap';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Leaf,
  Lock,
  LogOut,
  Menu,
  Minus,
  Moon,
  PenLine,
  Plus,
  Search,
  Square,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import lightHero from './assets/memoira-light-hero.png';
import darkHero from './assets/memoira-dark-hero.png';
import lightMark from './assets/memoira-light.png';
import darkMark from './assets/memoira-dark.png';
import { auth, db } from './firebase';

const todayKey = new Date().toISOString().slice(0, 10);

const navItems = [
  { id: 'daily', label: 'Daily Diary', icon: PenLine },
  { id: 'todos', label: 'To Do List', icon: CheckCircle2 },
  { id: 'past', label: 'Past Diaries', icon: CalendarDays },
];

const doodleColors = ['#4d3b2c', '#7d5b43', '#a45454', '#d68c93', '#758257', '#6a8caf', '#7b67b3'];
const doodleTools = [
  { id: 'type', label: 'Type' },
  { id: 'pen', label: 'Pen' },
  { id: 'marker', label: 'Marker' },
  { id: 'eraser', label: 'Eraser' },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'rectangle', label: 'Square', icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle },
];

const googleProvider = new GoogleAuthProvider();
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('memoira-theme') || 'light');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSuccess, setAuthSuccess] = useState(null);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [todosLoading, setTodosLoading] = useState(false);
  const [activeView, setActiveView] = useState('daily');
  const [entries, setEntries] = useState({});
  const [todos, setTodos] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const entrySaveTimers = useRef({});

  const heroImage = theme === 'dark' ? darkHero : lightHero;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      setAuthError('');
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setEntries({});
      setTodos([]);
      setEntriesLoading(false);
      setTodosLoading(false);
      return undefined;
    }

    setEntriesLoading(true);
    setTodosLoading(true);

    const entriesQuery = query(
      collection(db, 'users', user.uid, 'entries'),
      orderBy('updatedAt', 'desc'),
    );
    const todosQuery = query(
      collection(db, 'users', user.uid, 'todos'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribeEntries = onSnapshot(entriesQuery, (snapshot) => {
      const nextEntries = {};
      snapshot.forEach((entryDoc) => {
        const data = entryDoc.data();
        nextEntries[entryDoc.id] = {
          title: data.title || '',
          mood: data.mood || '',
          body: data.body || '',
          doodle: data.doodle || '',
        };
      });
      setEntries(nextEntries);
      setEntriesLoading(false);
    });

    const unsubscribeTodos = onSnapshot(todosQuery, (snapshot) => {
      const nextTodos = snapshot.docs.map((todoDoc) => {
        const data = todoDoc.data();
        return {
          id: todoDoc.id,
          text: data.text || '',
          done: Boolean(data.done),
        };
      });
      setTodos(nextTodos);
      setTodosLoading(false);
    });

    return () => {
      unsubscribeEntries();
      unsubscribeTodos();
    };
  }, [user]);

  useEffect(() => () => {
    Object.values(entrySaveTimers.current).forEach(clearTimeout);
  }, []);

  function updateTheme(nextTheme) {
    setTheme(nextTheme);
    localStorage.setItem('memoira-theme', nextTheme);
  }

  async function handleAuth(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    setAuthNotice('');

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');

    if (!email) {
      setAuthError('Add your email so Memoira knows which journal is yours.');
      setAuthBusy(false);
      return;
    }

    if (password.length < 6) {
      setAuthError('Your password needs at least 6 characters.');
      setAuthBusy(false);
      return;
    }

    if (authMode === 'signup' && password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      setAuthBusy(false);
      return;
    }

    try {
      if (authMode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(credential.user, { displayName: name });
          setUser({ ...credential.user, displayName: name });
        }
        setAuthSuccess({ type: 'signup', name: name || credential.user.email?.split('@')[0] || 'friend' });
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        setAuthSuccess({
          type: 'login',
          name: credential.user.displayName || credential.user.email?.split('@')[0] || 'friend',
        });
      }
      setAuthMode(null);
      event.currentTarget.reset();
    } catch (error) {
      setAuthError(getAuthMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleGoogleAuth() {
    setAuthBusy(true);
    setAuthError('');
    setAuthNotice('');

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const isNewUser = getAdditionalUserInfo(credential)?.isNewUser;
      setAuthSuccess({
        type: isNewUser ? 'signup' : 'login',
        name: credential.user.displayName || credential.user.email?.split('@')[0] || 'friend',
      });
      setAuthMode(null);
    } catch (error) {
      setAuthError(getAuthMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePasswordReset(email) {
    const trimmedEmail = email.trim();
    setAuthError('');
    setAuthNotice('');

    if (!trimmedEmail) {
      setAuthError('Enter your email first, then I can send the reset note.');
      return;
    }

    setAuthBusy(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setAuthNotice('A password reset link is on its way to your inbox.');
    } catch (error) {
      setAuthError(getAuthMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    setSidebarOpen(false);
  }

  function updateEntry(date, patch) {
    const nextEntry = {
      title: '',
      mood: '',
      body: '',
      doodle: '',
      ...(entries[date] || {}),
      ...patch,
    };

    setEntries((currentEntries) => ({
      ...currentEntries,
      [date]: nextEntry,
    }));

    if (!user) return;

    clearTimeout(entrySaveTimers.current[date]);
    entrySaveTimers.current[date] = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', user.uid, 'entries', date), {
          ...nextEntry,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error('Failed to save entry', error);
      }
    }, 450);
  }

  async function addTodo(text) {
    const trimmedText = text.trim();
    if (!trimmedText || !user) return;

    const todoId = crypto.randomUUID();
    await setDoc(doc(db, 'users', user.uid, 'todos', todoId), {
      text: trimmedText,
      done: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function toggleTodo(id) {
    if (!user) return;
    const todo = todos.find((currentTodo) => currentTodo.id === id);
    if (!todo) return;

    await setDoc(
      doc(db, 'users', user.uid, 'todos', id),
      {
        done: !todo.done,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  async function deleteTodo(id) {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'todos', id));
  }

  const appLoading = authLoading || (!authSuccess && user && (entriesLoading || todosLoading));

  return (
    <main className={`app-shell ${theme}`}>
      {appLoading ? (
        <LoadingScreen theme={theme} setTheme={updateTheme} />
      ) : authSuccess ? (
        <SuccessExperience
          mode={authSuccess.type}
          name={authSuccess.name || user?.displayName || user?.email?.split('@')[0] || 'friend'}
          onComplete={() => setAuthSuccess(null)}
        />
      ) : !user ? (
        authMode ? (
          <AuthExperience
            authBusy={authBusy}
            authError={authError}
            authMode={authMode}
            authNotice={authNotice}
            setAuthMode={setAuthMode}
            setTheme={updateTheme}
            theme={theme}
            onAuth={handleAuth}
            onGoogleAuth={handleGoogleAuth}
            onPasswordReset={handlePasswordReset}
          />
        ) : (
          <Landing
            authBusy={authBusy}
            authError={authError}
            authMode={authMode}
            heroImage={heroImage}
            setAuthMode={setAuthMode}
            setTheme={updateTheme}
            theme={theme}
            onAuth={handleAuth}
          />
        )
      ) : (
        <Dashboard
          activeView={activeView}
          entries={entries}
          selectedDate={selectedDate}
          setActiveView={setActiveView}
          setSelectedDate={setSelectedDate}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          setTheme={updateTheme}
          theme={theme}
          todos={todos}
          updateEntry={updateEntry}
          addTodo={addTodo}
          toggleTodo={toggleTodo}
          deleteTodo={deleteTodo}
          user={user}
          onLogout={handleLogout}
        />
      )}
    </main>
  );
}

function getAuthMessage(error) {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'That email is already in use. Try logging in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email or password does not look right.';
    case 'auth/weak-password':
      return 'Choose a stronger password with at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function LoadingScreen({ theme, setTheme }) {
  return (
    <section className="landing">
      <nav className="top-nav" aria-label="Main navigation">
        <a className="brand" href="#home">
          MEMOIRA <Leaf size={31} />
        </a>
        <div className="nav-actions">
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </nav>
      <div className="hero-grid" id="home">
        <div className="hero-copy">
          <div className="pill">
            <Leaf size={20} /> syncing your writing space
          </div>
          <h1>MEMOIRA</h1>
          <p className="tagline">Loading your memories...</p>
          <div className="memory-loader" role="status" aria-live="polite" aria-label="Memoira is loading">
            <div className="loader-notebook" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="loader-progress" aria-hidden="true">
              <span />
            </div>
            <p>Turning to your saved page</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ThemeToggle({ theme, setTheme }) {
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun size={18} />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      <Moon size={18} />
    </button>
  );
}

function AuthExperience({
  authBusy,
  authError,
  authMode,
  authNotice,
  setAuthMode,
  setTheme,
  theme,
  onAuth,
  onGoogleAuth,
  onPasswordReset,
}) {
  const isSignup = authMode === 'signup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordHint =
    password && password.length < 6
      ? 'Use at least 6 characters.'
      : isSignup && confirmPassword && password !== confirmPassword
        ? 'Passwords are not matching yet.'
        : '';

  return (
    <section className="auth-page">
      <nav className="auth-nav" aria-label="Authentication navigation">
        <button className="brand brand-button" type="button" onClick={() => setAuthMode(null)}>
          MEMOIRA <Leaf size={31} />
        </button>
        <div className="nav-actions">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <button className="ghost-button" type="button" onClick={() => setAuthMode(isSignup ? 'login' : 'signup')}>
            {isSignup ? 'Log In' : 'Create Account'}
          </button>
        </div>
      </nav>

      <div className="auth-split">
        <MemoryRoom active={isSignup ? 'signup' : 'login'} />

        <motion.section
          key={authMode}
          className="memory-auth-card"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          aria-label={isSignup ? 'Start your story' : 'Welcome back'}
        >
          <div className="auth-card-heading">
            <p className="section-kicker"><Sparkles size={15} /> {isSignup ? 'A fresh page' : 'Your journal is here'}</p>
            <h1>{isSignup ? 'Start Your Story' : 'Welcome Back'}</h1>
            <p>
              {isSignup
                ? 'Create your personal space for memories, reflections, and growth.'
                : 'Your memories have been waiting for you.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={onAuth}>
            <AnimatePresence initial={false}>
              {isSignup && (
                <motion.label
                  key="name"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28 }}
                >
                  Name
                  <input name="name" type="text" placeholder="Your name" autoComplete="name" required />
                </motion.label>
              )}
            </AnimatePresence>

            <motion.label initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              Email
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </motion.label>

            <motion.label initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
              Password
              <span className="password-field">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  minLength="6"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </motion.label>

            <AnimatePresence initial={false}>
              {isSignup && (
                <motion.label
                  key="confirm"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28 }}
                >
                  Confirm Password
                  <span className="password-field">
                    <input
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      required
                      minLength="6"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                    <button
                      className="password-toggle"
                      type="button"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      onClick={() => setShowConfirmPassword((current) => !current)}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </motion.label>
              )}
            </AnimatePresence>

            {passwordHint && <p className="field-hint">{passwordHint}</p>}
            {authError && <p className="auth-message">{authError}</p>}
            {authNotice && <p className="auth-message success">{authNotice}</p>}

            <motion.button
              className="primary-button full auth-submit"
              type="submit"
              disabled={authBusy}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
            >
              {authBusy ? 'Opening your journal...' : isSignup ? 'Create Account' : 'Log In'}
            </motion.button>
          </form>

          <button className="google-button" type="button" onClick={onGoogleAuth} disabled={authBusy}>
            <GoogleGlyph /> Continue with Google
          </button>

          <div className="auth-links">
            {!isSignup && (
              <button className="link-button" type="button" onClick={() => onPasswordReset(email)} disabled={authBusy}>
                Forgot Password
              </button>
            )}
            <button className="link-button" type="button" onClick={() => setAuthMode(isSignup ? 'login' : 'signup')}>
              {isSignup ? 'Already have an account?' : 'Create Account'}
            </button>
          </div>
        </motion.section>
      </div>
    </section>
  );
}

function GoogleGlyph() {
  return (
    <svg className="google-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285f4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.3-1 2.4-2.1 3.1v2.6h3.4c2-1.8 3.4-4.5 3.4-7.7z" />
      <path fill="#34a853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.4-2.6c-.9.6-2.2 1-3.9 1-3 0-5.5-2-6.4-4.7H2.1v2.7C3.9 20.4 7.6 23 12 23z" />
      <path fill="#fbbc05" d="M5.6 14c-.2-.6-.4-1.3-.4-2s.1-1.4.4-2V7.3H2.1C1.4 8.7 1 10.3 1 12s.4 3.3 1.1 4.7L5.6 14z" />
      <path fill="#ea4335" d="M12 5.3c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.5 2.1 15 1 12 1 7.6 1 3.9 3.6 2.1 7.3L5.6 10C6.5 7.3 9 5.3 12 5.3z" />
    </svg>
  );
}

function MemoryRoom({ active = 'login' }) {
  return (
    <motion.section
      className={`memory-room ${active}`}
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Cozy illustrated memory room"
    >
      <div className="sunbeam" />
      <div className="dust-field">
        {Array.from({ length: 12 }).map((_, index) => (
          <span key={index} style={{ '--i': index }} />
        ))}
      </div>
      <div className="room-window">
        <div className="sky">
          <span className="cloud cloud-one" />
          <span className="cloud cloud-two" />
        </div>
        <div className="window-frame" />
      </div>
      <div className="plant tall-plant">
        <span />
        <span />
        <span />
      </div>
      <div className="plant desk-plant">
        <span />
        <span />
        <span />
      </div>
      <div className="room-shelf">
        <i />
        <i />
        <i />
      </div>
      <div className="desk">
        <div className="mug" />
        <div className="notebook-illustration">
          <span />
        </div>
      </div>
      <p className="room-caption">
        {active === 'signup' ? 'A quiet desk is ready for your first page.' : 'The notebook remembers where you left off.'}
      </p>
    </motion.section>
  );
}

function SuccessExperience({ mode, name, onComplete }) {
  const sceneRef = useRef(null);
  const isSignup = mode === 'signup';

  useEffect(() => {
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: 'power2.out' },
        onComplete,
      });

      if (isSignup) {
        timeline
          .from('.success-room', { opacity: 0, scale: 0.98, duration: 0.2 })
          .to('.success-cat', { x: 130, opacity: 1, duration: 0.72 }, 0.15)
          .to('.success-cat', { y: -18, duration: 0.28 }, 0.82)
          .to('.success-cat', { y: 0, duration: 0.28 }, 1.1)
          .to('.success-notebook', { rotateX: 0, scale: 1.04, duration: 0.52 }, 1.05)
          .from('.success-note-text', { opacity: 0, y: 12, duration: 0.38 }, 1.42)
          .to('.success-notebook', { scale: 7.4, y: -40, duration: 0.8, ease: 'power3.inOut' }, 2.05)
          .to('.success-room', { opacity: 0, duration: 0.28 }, 2.48);
        return;
      }

      timeline
        .from('.success-room', { opacity: 0, scale: 0.99, duration: 0.18 })
        .to('.success-notebook', { rotateX: 0, scale: 1.06, duration: 0.36 }, 0.1)
        .from('.success-note-text', { opacity: 0, y: 10, duration: 0.28 }, 0.34)
        .to('.success-page', { rotateY: -165, duration: 0.42, transformOrigin: 'left center' }, 0.72)
        .to('.success-notebook', { scale: 7.2, y: -40, duration: 0.52, ease: 'power3.inOut' }, 1.05)
        .to('.success-room', { opacity: 0, duration: 0.18 }, 1.38);
    }, sceneRef);

    return () => context.revert();
  }, [isSignup, onComplete]);

  return (
    <section className={`success-room ${isSignup ? 'signup' : 'login'}`} ref={sceneRef} aria-live="polite">
      <div className="success-sunbeam" />
      <div className="success-leaves">
        <span />
        <span />
        <span />
      </div>
      <div className="success-table">
        {isSignup && (
          <div className="success-cat" aria-hidden="true">
            <span className="cat-tail" />
            <span className="cat-body" />
            <span className="cat-head" />
            <span className="cat-ear left" />
            <span className="cat-ear right" />
            <span className="cat-paw" />
          </div>
        )}
        <div className="success-notebook">
          <div className="success-page" />
          <p className="success-note-text">
            {isSignup ? `Welcome, ${name}` : `Welcome Back, ${name}`}
          </p>
        </div>
      </div>
    </section>
  );
}

function Landing({
  authBusy,
  authError,
  authMode,
  heroImage,
  setAuthMode,
  setTheme,
  theme,
  onAuth,
}) {
  const isSignup = authMode === 'signup';
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <section className="landing">
      <nav className="top-nav" aria-label="Main navigation">
        <a className="brand" href="#home">
          MEMOIRA <Leaf size={31} />
        </a>
        <div className="nav-links">
          <a className="active" href="#home">Home</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#why-memoira">Why Memoira</a>
          <a href="#privacy">Privacy</a>
          <a href="#get-started">Get Started</a>
        </div>
        <div className="nav-actions">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <button className="ghost-button" type="button" onClick={() => setAuthMode('login')}>
            Log In
          </button>
          <button className="primary-button" type="button" onClick={() => setAuthMode('signup')}>
            Sign Up
          </button>
        </div>
      </nav>

      <div className="hero-grid" id="home">
        <div className="hero-copy">
          <div className="pill">
            <Leaf size={20} /> your space. your story.
          </div>
          <h1>MEMOIRA</h1>
          <p className="tagline">Write. Reflect. Grow.</p>
          <p className="hero-text">
            A daily diary for your thoughts, memories, and everything in between.
            All in a space that feels like you.
          </p>
          <div className="hero-actions">
            <button className="primary-button large" type="button" onClick={() => setAuthMode('signup')}>
              Start Writing <Leaf size={20} />
            </button>
            <a className="outline-button large" href="#how-it-works">
              Learn More <ChevronRight size={19} />
            </a>
          </div>
        </div>

        <div className="hero-art" aria-label="Memoira diary room preview" style={{ '--hero-image': `url(${heroImage})` }}>
          <img src={heroImage} alt="Illustrated Memoira writing desk" />
        </div>
      </div>

      {authMode && (
        <section className="auth-overlay" aria-label={isSignup ? 'Create account' : 'Log in'}>
          <div className="auth-panel">
            <button className="icon-button auth-close" type="button" aria-label="Close auth form" onClick={() => setAuthMode(null)}>
              <X size={20} />
            </button>
            <div>
              <p className="section-kicker">{isSignup ? 'Create your space' : 'Welcome back'}</p>
              <h2>{isSignup ? 'Start your private diary' : 'Open your Memoira'}</h2>
            </div>
            <form onSubmit={onAuth}>
              {isSignup && (
                <label>
                  Name
                  <input name="name" type="text" placeholder="Your name" required />
                </label>
              )}
              <label>
                Email
                <input name="email" type="email" placeholder="you@example.com" required />
              </label>
              <label>
                Password
                <span className="password-field">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    required
                    minLength="6"
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              {isSignup && (
                <label>
                  Confirm password
                  <span className="password-field">
                    <input
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter your password"
                      required
                      minLength="6"
                    />
                    <button
                      className="password-toggle"
                      type="button"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      onClick={() => setShowConfirmPassword((current) => !current)}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
              )}
              {authError && <p className="auth-message">{authError}</p>}
              <button className="primary-button full" type="submit" disabled={authBusy}>
                {authBusy ? 'Please wait...' : isSignup ? 'Sign Up' : 'Log In'}
              </button>
            </form>
            <button className="link-button" type="button" onClick={() => setAuthMode(isSignup ? 'login' : 'signup')}>
              {isSignup ? 'Already have an account? Log in' : 'New here? Create an account'}
            </button>
          </div>
        </section>
      )}

      <section className="feature-row" id="how-it-works">
        <Feature tone="blush" icon={UserRound} title="Create Your Space" text="Sign up once and open a private diary dashboard." />
        <Feature tone="sage" icon={PenLine} title="Write Daily" text="Capture thoughts, tasks, moods, and small moments." />
        <Feature tone="peach" icon={CalendarDays} title="Look Back" text="Use the calendar to revisit past entries by date." />
        <Feature tone="lavender" icon={Lock} title="Keep It Yours" text="Your diary is saved with your account in Firebase." />
      </section>

      <section className="landing-section" id="why-memoira">
        <div>
          <p className="section-kicker"><Sparkles size={15} /> Why Memoira</p>
          <h2>A calm home for your everyday story.</h2>
          <p>
            Memoira is built around the feeling of opening a notebook at the end of the day:
            simple writing, gentle reflection, and a soft place to return to your memories.
          </p>
        </div>
        <div className="section-card-list">
          <article>
            <BookOpen size={24} />
            <strong>Diary first</strong>
            <span>No feeds, likes, or noise. Just your words.</span>
          </article>
          <article>
            <CheckCircle2 size={24} />
            <strong>Day planning</strong>
            <span>Keep tiny tasks beside your thoughts.</span>
          </article>
          <article>
            <Leaf size={24} />
            <strong>Gentle growth</strong>
            <span>Notice patterns without turning journaling into homework.</span>
          </article>
        </div>
      </section>

      <section className="landing-section privacy-section" id="privacy">
        <div>
          <p className="section-kicker"><Lock size={15} /> Privacy</p>
          <h2>Private by design.</h2>
          <p>
            Your account, diary entries, and to-dos now sync with Firebase so you can come back
            to your writing from the same signed-in account.
          </p>
        </div>
        <button className="primary-button large" type="button" onClick={() => setAuthMode('signup')}>
          Start Free <Leaf size={20} />
        </button>
      </section>

      <section className="get-started-strip" id="get-started">
        <span><Sparkles size={18} /> Ready when you are.</span>
        <button className="primary-button" type="button" onClick={() => setAuthMode('signup')}>
          Create Free Account
        </button>
      </section>
    </section>
  );
}

function Feature({ icon: Icon, id, title, text, tone }) {
  return (
    <article className={`feature-card ${tone}`} id={id}>
      <span><Icon size={30} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Dashboard(props) {
  const {
    activeView,
    entries,
    selectedDate,
    setActiveView,
    setSelectedDate,
    sidebarOpen,
    setSidebarOpen,
    setTheme,
    theme,
    todos,
    updateEntry,
    addTodo,
    toggleTodo,
    deleteTodo,
    user,
    onLogout,
  } = props;

  const selectedEntry = entries[selectedDate] || { title: '', mood: '', body: '' };
  const displayName = user.displayName || user.email?.split('@')[0] || 'Memoira user';
  const workspaceMark = theme === 'dark' ? darkMark : lightMark;

  function chooseView(view) {
    setActiveView(view);
    setSidebarOpen(false);
  }

  return (
    <section className="dashboard">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-head">
          <a className="brand compact" href="#daily">
            MEMOIRA <Leaf size={25} />
          </a>
          <button className="icon-button mobile-only" type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="profile-card">
          <span><UserRound size={25} /></span>
          <div>
            <strong>{displayName}</strong>
            <small>{user.email}</small>
          </div>
        </div>
        <nav className="side-nav" aria-label="Diary sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeView === item.id ? 'active' : ''}
                key={item.id}
                type="button"
                onClick={() => chooseView(item.id)}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <button className="logout-button" type="button" onClick={onLogout}>
          <LogOut size={19} /> Log out
        </button>
      </aside>

      <div className="workspace" style={{ '--workspace-mark': `url(${workspaceMark})` }}>
        <header className="workspace-header">
          <button className="icon-button mobile-only" type="button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
            <Menu size={21} />
          </button>
          <div>
            <p className="section-kicker">
              <Sparkles size={15} /> {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1>{activeView === 'daily' ? 'Daily Diary' : activeView === 'todos' ? 'To Do List' : 'Past Diaries'}</h1>
          </div>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </header>

        {activeView === 'daily' && (
          <DiaryEditor
            date={todayKey}
            entry={entries[todayKey] || { title: '', mood: '', body: '', doodle: '' }}
            theme={theme}
            updateEntry={updateEntry}
          />
        )}
        {activeView === 'todos' && (
          <TodoList
            todos={todos}
            addTodo={addTodo}
            toggleTodo={toggleTodo}
            deleteTodo={deleteTodo}
          />
        )}
        {activeView === 'past' && (
          <PastDiaries
            entries={entries}
            selectedDate={selectedDate}
            selectedEntry={selectedEntry}
            setSelectedDate={setSelectedDate}
            theme={theme}
            updateEntry={updateEntry}
          />
        )}
      </div>
    </section>
  );
}

function DiaryEditor({ date, entry, theme, updateEntry }) {
  const pageArtwork = themeToArtwork(theme);

  return (
    <section className="content-grid">
      <article className="diary-editor notebook-page" style={{ '--page-art': `url(${pageArtwork})` }}>
        <div className="page-stitch" aria-hidden="true" />
        <div className="page-header">
          <div className="page-date-block">
            <span className="page-chip">Dear diary</span>
            <label>
              Date
              <input type="date" value={date} readOnly />
            </label>
          </div>
          <label>
            Mood
            <input
              value={entry.mood}
              placeholder="How are you feeling today?"
              onChange={(event) => updateEntry(date, { mood: event.target.value })}
            />
          </label>
        </div>
        <label>
          Title
          <input
            className="diary-title-input"
            value={entry.title}
            placeholder="Give today a title"
            onChange={(event) => updateEntry(date, { title: event.target.value })}
          />
        </label>
        <DoodleStudio
          body={entry.body}
          doodle={entry.doodle || ''}
          onBodyChange={(body) => updateEntry(date, { body })}
          onDoodleChange={(doodle) => updateEntry(date, { doodle })}
          theme={theme}
        />
      </article>
      <aside className="reflection-panel">
        <h2>Today&apos;s gentle prompts</h2>
        <ul>
          <li>What made you feel most like yourself?</li>
          <li>What can tomorrow-you thank you for?</li>
          <li>What tiny moment is worth keeping?</li>
        </ul>
      </aside>
    </section>
  );
}

function themeToArtwork(theme) {
  return theme === 'dark' ? darkMark : lightMark;
}

function DoodleStudio({ body, doodle, onBodyChange, onDoodleChange, theme }) {
  const canvasRef = useRef(null);
  const surfaceRef = useRef(null);
  const fileInputRef = useRef(null);
  const drawingRef = useRef(false);
  const startPointRef = useRef(null);
  const snapshotRef = useRef(null);
  const renderedDoodleRef = useRef('');
  const [mounted, setMounted] = useState(false);
  const [tool, setTool] = useState('type');
  const [color, setColor] = useState(theme === 'dark' ? '#f1e7d9' : doodleColors[0]);
  const [brushSize, setBrushSize] = useState(4);

  useEffect(() => {
    setColor(theme === 'dark' ? '#f1e7d9' : doodleColors[0]);
  }, [theme]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;

    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) return undefined;

    const context = canvas.getContext('2d');

    function renderFromDataUrl(dataUrl = renderedDoodleRef.current) {
      const { width, height } = surface.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      configureContext(context, tool, color, brushSize);

      if (dataUrl) {
        const image = new Image();
        image.onload = () => {
          context.save();
          context.globalCompositeOperation = 'source-over';
          context.globalAlpha = 1;
          context.drawImage(image, 0, 0, width, height);
          context.restore();
        };
        image.src = dataUrl;
      }
    }

    renderedDoodleRef.current = doodle || '';
    renderFromDataUrl(doodle || '');
    window.addEventListener('resize', renderFromDataUrl);
    return () => window.removeEventListener('resize', renderFromDataUrl);
  }, [doodle, mounted]);

  function configureContext(context, activeTool, activeColor, activeBrushSize) {
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
    context.globalAlpha = activeTool === 'marker' ? 0.35 : 1;
    context.lineWidth =
      activeTool === 'marker'
        ? activeBrushSize * 3
        : activeTool === 'eraser'
          ? activeBrushSize * 2.4
          : activeBrushSize;
    context.strokeStyle = activeColor;
  }

  function pointFromEvent(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startDrawing(event) {
    if (tool === 'type') return;
    const context = canvasRef.current.getContext('2d');
    const point = pointFromEvent(event);
    configureContext(context, tool, color, brushSize);
    drawingRef.current = true;
    startPointRef.current = point;
    canvasRef.current.setPointerCapture(event.pointerId);

    if (tool === 'pen' || tool === 'marker' || tool === 'eraser') {
      context.beginPath();
      context.moveTo(point.x, point.y);
      return;
    }

    snapshotRef.current = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  function draw(event) {
    if (!drawingRef.current) return;
    const context = canvasRef.current.getContext('2d');
    const point = pointFromEvent(event);

    if (tool === 'pen' || tool === 'marker' || tool === 'eraser') {
      context.lineTo(point.x, point.y);
      context.stroke();
      return;
    }

    context.putImageData(snapshotRef.current, 0, 0);
    drawShape(context, startPointRef.current, point, tool);
  }

  function drawShape(context, startPoint, endPoint, activeTool) {
    const width = endPoint.x - startPoint.x;
    const height = endPoint.y - startPoint.y;

    context.beginPath();
    if (activeTool === 'line') {
      context.moveTo(startPoint.x, startPoint.y);
      context.lineTo(endPoint.x, endPoint.y);
      context.stroke();
      return;
    }
    if (activeTool === 'rectangle') {
      context.strokeRect(startPoint.x, startPoint.y, width, height);
      return;
    }
    if (activeTool === 'circle') {
      context.ellipse(
        startPoint.x + width / 2,
        startPoint.y + height / 2,
        Math.abs(width) / 2,
        Math.abs(height) / 2,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
  }

  function stopDrawing(event) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (event?.pointerId !== undefined) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
    const nextDoodle = canvasRef.current.toDataURL('image/png');
    renderedDoodleRef.current = nextDoodle;
    onDoodleChange(nextDoodle);
  }

  function clearDoodle() {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    renderedDoodleRef.current = '';
    onDoodleChange('');
  }

  function openImagePicker() {
    fileInputRef.current?.click();
  }

  function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const maxWidth = width * 0.82;
        const maxHeight = height * 0.72;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const x = (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;

        context.save();
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = 1;
        context.drawImage(image, x, y, drawWidth, drawHeight);
        context.restore();
        const nextDoodle = canvas.toDataURL('image/png');
        renderedDoodleRef.current = nextDoodle;
        onDoodleChange(nextDoodle);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  return (
    <section className="thoughts-shell">
      <div className="thoughts-header thoughts-toolbar">
        <div>
          <strong>Your thoughts</strong>
          <p>Type normally, then switch tools whenever you want to draw on the same page.</p>
        </div>
        <div className="doodle-controls">
          <div className="tool-row">
          {doodleTools.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`tool-chip ${tool === item.id ? 'active' : ''}`}
                key={item.id}
                type="button"
                onClick={() => setTool(item.id)}
              >
                {Icon ? <Icon size={16} /> : null}
                {item.label}
              </button>
            );
          })}
          </div>
          <div className="tool-row palette-row">
          {doodleColors.map((swatch) => (
            <button
              className={`color-dot ${color === swatch ? 'active' : ''}`}
              key={swatch}
              type="button"
              aria-label={`Use ${swatch} color`}
              style={{ '--swatch': swatch }}
              onClick={() => setColor(swatch)}
            />
          ))}
          </div>
          <div className="tool-row action-row">
            <label className="brush-size">
              Brush
              <input
                type="range"
                min="2"
                max="16"
                step="1"
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
              />
            </label>
            <button className="outline-button doodle-clear" type="button" onClick={openImagePicker}>
              Add image
            </button>
            <button className="outline-button doodle-clear" type="button" onClick={clearDoodle}>
              Clear
            </button>
            <input
              ref={fileInputRef}
              hidden
              accept="image/*"
              type="file"
              onChange={handleImageUpload}
            />
          </div>
        </div>
      </div>
      <div className="thought-surface" ref={surfaceRef}>
        <label className="lined-entry merged-entry">
          <span className="sr-only">Your thoughts</span>
          <textarea
            value={body}
            placeholder="Write what you want to remember..."
            onChange={(event) => onBodyChange(event.target.value)}
          />
        </label>
        <canvas
          ref={canvasRef}
          className={`doodle-canvas surface-canvas ${tool === 'type' ? 'typing-mode' : 'drawing-mode'}`}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
        />
      </div>
    </section>
  );
}

function TodoList({ todos, addTodo, toggleTodo, deleteTodo }) {
  const [text, setText] = useState('');

  async function submitTodo(event) {
    event.preventDefault();
    await addTodo(text);
    setText('');
  }

  return (
    <section className="todo-panel">
      <form className="todo-form" onSubmit={submitTodo}>
        <input
          value={text}
          placeholder="Add a task for your day"
          onChange={(event) => setText(event.target.value)}
        />
        <button className="primary-button" type="submit">
          <Plus size={19} /> Add
        </button>
      </form>
      <div className="todo-list">
        {todos.map((todo) => (
          <article className={`todo-item ${todo.done ? 'done' : ''}`} key={todo.id}>
            <button className="check-button" type="button" aria-label="Toggle task" onClick={() => toggleTodo(todo.id)}>
              {todo.done ? <CheckCircle2 size={22} /> : <Circle size={22} />}
            </button>
            <span>{todo.text}</span>
            <button className="icon-button" type="button" aria-label="Delete task" onClick={() => deleteTodo(todo.id)}>
              <Trash2 size={18} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function PastDiaries({ entries, selectedDate, selectedEntry, setSelectedDate, theme, updateEntry }) {
  const markedDates = useMemo(() => new Set(Object.keys(entries)), [entries]);

  return (
    <section className="past-grid">
      <article className="calendar-panel">
        <div className="calendar-intro">
          <span><Search size={18} /></span>
          <div>
            <strong>Choose a day</strong>
            <p>{formatDiaryDate(selectedDate)}</p>
          </div>
        </div>
        <MemoiraCalendar
          markedDates={markedDates}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
        <div className="saved-dates">
          <strong className="saved-dates-title">Pages you&apos;ve kept</strong>
          {Object.keys(entries).sort().reverse().map((date) => (
            <button
              className={selectedDate === date ? 'active' : ''}
              key={date}
              type="button"
              onClick={() => setSelectedDate(date)}
            >
              <CalendarDays size={17} />
              {date}
              {markedDates.has(date) && <span />}
            </button>
          ))}
        </div>
      </article>
      <DiaryEditor date={selectedDate} entry={selectedEntry} theme={theme} updateEntry={updateEntry} />
    </section>
  );
}

function MemoiraCalendar({ markedDates, selectedDate, setSelectedDate }) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(parseDateKey(selectedDate)));

  useEffect(() => {
    setVisibleMonth(monthStart(parseDateKey(selectedDate)));
  }, [selectedDate]);

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  function moveMonth(offset) {
    setVisibleMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  }

  return (
    <div className="memoira-calendar" aria-label="Choose diary date">
      <div className="calendar-topline">
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
          <ChevronLeft size={18} />
        </button>
        <strong>{monthFormatter.format(visibleMonth)}</strong>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {weekdayLabels.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-days">
        {calendarDays.map((day) => {
          const dateKey = toDateKey(day.date);
          const isSelected = dateKey === selectedDate;
          const isCurrentMonth = day.date.getMonth() === visibleMonth.getMonth();
          const isMarked = markedDates.has(dateKey);
          return (
            <button
              className={[
                isSelected ? 'selected' : '',
                isCurrentMonth ? '' : 'muted',
                isMarked ? 'marked' : '',
              ].filter(Boolean).join(' ')}
              key={dateKey}
              type="button"
              aria-label={`Open diary for ${formatDiaryDate(dateKey)}`}
              aria-pressed={isSelected}
              onClick={() => setSelectedDate(dateKey)}
            >
              {day.date.getDate()}
              {isMarked && <span aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildCalendarDays(monthDate) {
  const firstDay = monthStart(monthDate);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date };
  });
}

function formatDiaryDate(dateKey) {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default App;
