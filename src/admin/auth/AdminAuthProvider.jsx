import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminAuthContext } from './admin-auth-context';
import { adminMode, adminRepository } from '../data';
import {
  createSessionWindow,
  isWindowExpired,
  SESSION_WARNING_MS,
  touchSessionWindow,
} from './sessionPolicy';

const WINDOW_KEY = 'chat_compras_admin_window_v1';

const readWindow = () => {
  try {
    const raw = sessionStorage.getItem(WINDOW_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeWindow = (value) => {
  try {
    if (!value) sessionStorage.removeItem(WINDOW_KEY);
    else sessionStorage.setItem(WINDOW_KEY, JSON.stringify(value));
  } catch {
    // La sesión sigue activa en memoria.
  }
};

export function AdminAuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [session, setSession] = useState(null);
  const [sessionWindow, setSessionWindow] = useState(null);
  const [warning, setWarning] = useState(false);
  const [bootError, setBootError] = useState(null);
  const lastTouchRef = useRef(0);

  const clearSession = useCallback(() => {
    setSession(null);
    setSessionWindow(null);
    setWarning(false);
    writeWindow(null);
  }, []);

  const expire = useCallback(async () => {
    clearSession();
    setStatus('expired');
    try {
      await adminRepository.logout();
    } catch {
      // La sesión local ya quedó cerrada.
    }
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const storedWindow = readWindow();

      if (storedWindow && isWindowExpired(storedWindow)) {
        writeWindow(null);
        if (!cancelled) setStatus('expired');
        try {
          await adminRepository.logout();
        } catch {
          // Sin backend, la sesión local ya quedó cerrada.
        }
        return;
      }

      try {
        const current = await adminRepository.getSession();
        if (cancelled) return;

        if (!current) {
          clearSession();
          setStatus('anonymous');
          return;
        }

        const activeWindow = storedWindow || createSessionWindow();
        setSession(current);
        setSessionWindow(activeWindow);
        writeWindow(activeWindow);
        setStatus('authenticated');
      } catch (error) {
        if (cancelled) return;
        setBootError(error.message);
        clearSession();
        setStatus('anonymous');
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  useEffect(() => {
    if (status !== 'authenticated') return undefined;

    const onActivity = () => {
      const now = Date.now();
      if (now - lastTouchRef.current < 5000) return;
      lastTouchRef.current = now;

      setSessionWindow((current) => {
        if (!current) return current;
        const next = touchSessionWindow(current, now);
        writeWindow(next);
        return next;
      });
      setWarning(false);
    };

    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    const interval = window.setInterval(() => {
      setSessionWindow((current) => {
        if (!current) return current;
        const now = Date.now();
        if (isWindowExpired(current, now)) {
          expire();
          return null;
        }
        setWarning(current.expiresAt - now <= SESSION_WARNING_MS);
        return current;
      });
    }, 15000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      window.clearInterval(interval);
    };
  }, [status, expire]);

  const login = useCallback(async ({ email, password }) => {
    setBootError(null);
    const nextSession = await adminRepository.login({ email, password });
    const nextWindow = createSessionWindow();
    setSession(nextSession);
    setSessionWindow(nextWindow);
    writeWindow(nextWindow);
    setStatus('authenticated');
    setWarning(false);
    return nextSession;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminRepository.logout();
    } finally {
      clearSession();
      setStatus('anonymous');
    }
  }, [clearSession]);

  const extendSession = useCallback(() => {
    setSessionWindow((current) => {
      const next = touchSessionWindow(current);
      writeWindow(next);
      return next;
    });
    setWarning(false);
  }, []);

  const hasPermission = useCallback(
    (permissionKey) => {
      if (!permissionKey) return true;
      return Array.isArray(session?.permissions) && session.permissions.includes(permissionKey);
    },
    [session]
  );

  const value = useMemo(
    () => ({
      status,
      session,
      mode: adminMode,
      warning,
      bootError,
      login,
      logout,
      extendSession,
      hasPermission,
      expiresAt: sessionWindow?.expiresAt || null,
    }),
    [status, session, warning, bootError, login, logout, extendSession, hasPermission, sessionWindow]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
