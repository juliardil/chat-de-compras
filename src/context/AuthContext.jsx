import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './auth-context';

const SESSION_KEY = 'chat_compras_session';
const LOGGED_OUT_KEY = 'chat_compras_logged_out';

// Usuario de demostración que se usa la primera vez que se abre la app.
const DEFAULT_USER = { role: 'user', name: 'Julia' };

const readStoredSession = () => {
  try {
    // Si el usuario cerró sesión explícitamente, no se restaura la demo.
    if (localStorage.getItem(LOGGED_OUT_KEY) === '1') return null;

    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return DEFAULT_USER;

    const parsed = JSON.parse(raw);
    if (parsed && (parsed.role === 'user' || parsed.role === 'commerce')) {
      return parsed;
    }
    return DEFAULT_USER;
  } catch {
    // Si el almacenamiento no está disponible, se mantiene la demo funcional.
    return DEFAULT_USER;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredSession);
  const navigate = useNavigate();

  const login = (role) => {
    const newUser = {
      role,
      name: role === 'commerce' ? 'Comercio Demo' : 'Julia'
    };

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
      localStorage.removeItem(LOGGED_OUT_KEY);
    } catch {
      // La sesión sigue funcionando en memoria aunque no se pueda persistir.
    }

    setUser(newUser);
    navigate(role === 'user' ? '/categories' : '/dashboard', { replace: true });
  };

  const logout = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.setItem(LOGGED_OUT_KEY, '1');
    } catch {
      // Se limpia igualmente el estado en memoria.
    }

    setUser(null);
    navigate('/login', { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
