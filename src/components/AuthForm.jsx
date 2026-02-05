import React, { useState } from 'react';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, setDoc, doc } from 'firebase/firestore';

export default function AuthForm({ onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const auth = getAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let userCred;
      if (isSignUp) {
        if (!firstName.trim() || !lastName.trim()) {
          setError('First Name and Last Name are required.');
          setLoading(false);
          return;
        }
        userCred = await createUserWithEmailAndPassword(auth, email, password);
        // Save to Firestore players collection
        const db = getFirestore();
        await setDoc(doc(collection(db, 'players'), userCred.user.uid), {
          userId: userCred.user.uid,
          email,
        //   firstName,
        //   lastName,
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          handicap: 0,
          isActive: true
        });
      } else {
        userCred = await signInWithEmailAndPassword(auth, email, password);
      }
      onAuth(userCred.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    onAuth(null);
  };

  return (
    <div className="auth-bg-center">
      <form onSubmit={handleSubmit} className="auth-form-box">
        <h1 className="auth-form-main-title">Mesquite 2026</h1>
        <h2 className="auth-form-title">{isSignUp ? 'Sign Up' : 'Sign In'}</h2>
        {isSignUp && (
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            required
            className="auth-form-input"
            style={{ marginBottom: 10 }}
          />
        )}
        {isSignUp && (
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            required
            className="auth-form-input"
            style={{ marginBottom: 10 }}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="auth-form-input"
        />
        <div style={{ width: '100%' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="auth-form-input"
          />
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '8px', marginBottom: '10px' }}>
            <button
              type="button"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(v => !v)}
              className="auth-form-eye-btn auth-form-eye-btn-style"
            >
              {showPassword ? 'Hide Password' : 'Show Password'}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="auth-form-btn"
        >
          {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="auth-form-toggle"
        >
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
        {error && <div className="auth-form-error">{error}</div>}
      </form>
    </div>
  );
}
