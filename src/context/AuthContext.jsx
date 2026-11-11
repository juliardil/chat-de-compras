import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './auth-context';
import { insforge, isInsforgeConfigured } from '../lib/insforge';

// =============================================================================
// Autenticación de la app (compradores y comercios).
//
// Modo InsForge (VITE_INSFORGE_URL + VITE_INSFORGE_ANON_KEY presentes):
//   * login/registro/recovery contra InsForge Auth;
//   * la sesión se rehidrata sola al recargar (getCurrentUser usa la cookie
//     httpOnly de refresco), así que el perfil persiste entre cargas;
//   * el perfil editable (nombre, teléfono, fecha de nacimiento y datos del
//     negocio) vive en auth.users.profile (JSONB) y se actualiza con
//     insforge.auth.setProfile.
//
// Modo demostración (sin InsForge configurado): sesión local en localStorage,
// igual que antes, para poder usar la app sin backend.
// =============================================================================

const SESSION_KEY = 'chat_compras_session';
const LOGGED_OUT_KEY = 'chat_compras_logged_out';

// Usuario de demostración que se usa la primera vez que se abre la app. No se
// inventa un nombre: la interfaz muestra "Usuario" si no hay uno guardado.
const DEFAULT_USER = { role: 'user', name: '' };

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

const writeStoredSession = (user) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    localStorage.removeItem(LOGGED_OUT_KEY);
  } catch {
    // La sesión sigue funcionando en memoria aunque no se pueda persistir.
  }
};

const clearStoredSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.setItem(LOGGED_OUT_KEY, '1');
  } catch {
    // Se limpia igualmente el estado en memoria.
  }
};

// -----------------------------------------------------------------------------
// Mapeo del usuario de InsForge hacia el usuario de la app.
// auth.users.profile (JSONB) guarda: name, phone, birth_date, role ('user' |
// 'commerce'), business (datos del comercio) y addresses (direcciones del
// comprador). El correo vive en
// auth.users.email y no se edita desde la app (requiere reverificación).
// -----------------------------------------------------------------------------
const readInsforgeProfile = (authUser) =>
  authUser && typeof authUser.profile === 'object' && authUser.profile !== null
    ? authUser.profile
    : {};

export const mapInsForgeUser = (authUser) => {
  if (!authUser) return null;

  const profile = readInsforgeProfile(authUser);
  const email = authUser.email || '';
  const name = profile.name || authUser.name || (email ? email.split('@')[0] : 'Usuario');
  const business = profile.business && typeof profile.business === 'object' ? profile.business : null;

  return {
    id: authUser.id,
    email,
    name,
    phone: profile.phone || '',
    birthDate: profile.birth_date || '',
    business,
    addresses: Array.isArray(profile.addresses) ? profile.addresses : [],
    role: profile.role === 'commerce' ? 'commerce' : 'user',
  };
};

const homeFor = (user) => (user?.role === 'commerce' ? '/dashboard' : '/categories');

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(isInsforgeConfigured ? null : readStoredSession);
  // En modo InsForge la sesión se rehidrata de forma asíncrona: exponer
  // `loading` evita que los guardas redirijan a /welcome antes de tiempo.
  const [loading, setLoading] = useState(isInsforgeConfigured);

  useEffect(() => {
    if (!isInsforgeConfigured) return undefined;

    let cancelled = false;
    const hydrate = async () => {
      try {
        const { data, error } = await insforge.auth.getCurrentUser();
        if (cancelled) return;
        setUser(error ? null : mapInsForgeUser(data?.user));
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // Guarda el perfil en auth.users.profile fusionando con lo existente ( así
  // la operación es segura tanto si el backend fusiona como si reemplaza).
  const saveInsforgeProfile = async (patch) => {
    const { data, error } = await insforge.auth.getCurrentUser();
    if (error || !data?.user) {
      throw new Error('No hay una sesión activa para actualizar el perfil.');
    }

    const nextProfile = { ...readInsforgeProfile(data.user), ...patch };
    const { error: saveError } = await insforge.auth.setProfile(nextProfile);
    if (saveError) throw new Error(saveError.message || 'No se pudo guardar el perfil.');

    return { authUser: data.user, profile: nextProfile };
  };

  const login = useCallback(
    async ({ email, password, role } = {}) => {
      if (!isInsforgeConfigured) {
        // Demo: sesión local según el rol (comportamiento original).
        const demoUser = {
          role: role === 'commerce' ? 'commerce' : 'user',
          name: role === 'commerce' ? 'Comercio' : 'Usuario',
        };
        writeStoredSession(demoUser);
        setUser(demoUser);
        navigate(homeFor(demoUser), { replace: true });
        return demoUser;
      }

      const { data, error } = await insforge.auth.signInWithPassword({ email, password });
      if (error || !data?.user) {
        const authError = new Error(error?.message || 'Correo o contraseña incorrectos.');
        if (error?.statusCode) authError.statusCode = error.statusCode;
        throw authError;
      }

      const nextUser = mapInsForgeUser(data.user);
      setUser(nextUser);
      navigate(homeFor(nextUser), { replace: true });
      return nextUser;
    },
    [navigate]
  );

  const register = useCallback(
    async ({ email, password, name, role = 'user', business = null }) => {
      if (!isInsforgeConfigured) {
        const demoUser = {
          role,
          name: role === 'commerce' ? 'Comercio' : name || 'Usuario',
        };
        writeStoredSession(demoUser);
        setUser(demoUser);
        navigate(homeFor(demoUser), { replace: true });
        return { verificationRequired: false };
      }

      const { data, error } = await insforge.auth.signUp({ email, password, name });
      if (error) throw new Error(error.message || 'No se pudo crear la cuenta.');

      // El proyecto exige verificación por código: la página pide el código y
      // llama a confirmRegistration (que completa el rol y el perfil).
      if (data?.requireEmailVerification) {
        return { verificationRequired: true, email };
      }

      const { authUser, profile } = await saveInsforgeProfile({ role, business });
      const nextUser = mapInsForgeUser({ ...authUser, profile });
      setUser(nextUser);
      navigate(homeFor(nextUser), { replace: true });
      return { verificationRequired: false };
    },
    [navigate]
  );

  const confirmRegistration = useCallback(
    async ({ email, otp, role = 'user', business = null }) => {
      if (!isInsforgeConfigured) {
        throw new Error('La verificación por correo solo está disponible con InsForge.');
      }

      const { data, error } = await insforge.auth.verifyEmail({ email, otp });
      if (error || !data?.user) {
        throw new Error(error?.message || 'El código no es válido o expiró.');
      }

      const { authUser, profile } = await saveInsforgeProfile({ role, business });
      const nextUser = mapInsForgeUser({ ...authUser, profile });
      setUser(nextUser);
      navigate(homeFor(nextUser), { replace: true });
      return nextUser;
    },
    [navigate]
  );

  const resendVerificationCode = useCallback(async (email) => {
    if (!isInsforgeConfigured) {
      throw new Error('La verificación por correo solo está disponible con InsForge.');
    }
    const { error } = await insforge.auth.resendVerificationEmail({ email });
    if (error) throw new Error(error.message || 'No se pudo reenviar el código.');
  }, []);

  // Actualiza el perfil del usuario autenticado. Las claves del parche usan
  // los nombres del JSONB: name, phone, birth_date, business.
  const updateProfile = useCallback(async (patch) => {
    if (!isInsforgeConfigured) {
      // Demo: se persiste en la sesión local para que la edición sobreviva
      // la recarga también sin backend.
      const nextUser = {
        ...(user || {}),
        name: patch.name ?? user?.name,
        phone: patch.phone ?? user?.phone ?? '',
        birthDate: patch.birth_date ?? user?.birthDate ?? '',
        business: patch.business ?? user?.business ?? null,
        addresses: patch.addresses ?? user?.addresses ?? [],
      };
      setUser(nextUser);
      writeStoredSession(nextUser);
      return nextUser;
    }

    const { authUser, profile } = await saveInsforgeProfile(patch);
    const nextUser = mapInsForgeUser({ ...authUser, profile });
    setUser(nextUser);
    return nextUser;
  }, [user]);

  const requestPasswordReset = useCallback(async (email) => {
    if (!isInsforgeConfigured) return;
    const { error } = await insforge.auth.sendResetPasswordEmail({ email });
    if (error) throw new Error(error.message || 'No se pudo enviar el código.');
  }, []);

  const confirmPasswordReset = useCallback(async ({ email, code }) => {
    const { data, error } = await insforge.auth.exchangeResetPasswordToken({ email, code });
    if (error || !data?.token) {
      throw new Error(error?.message || 'El código no es válido o expiró.');
    }
    return data.token;
  }, []);

  const completePasswordReset = useCallback(async ({ newPassword, otp }) => {
    const { error } = await insforge.auth.resetPassword({ newPassword, otp });
    if (error) throw new Error(error.message || 'No se pudo cambiar la contraseña.');
  }, []);

  const logout = useCallback(async () => {
    if (!isInsforgeConfigured) {
      clearStoredSession();
      setUser(null);
      navigate('/login', { replace: true });
      return;
    }

    try {
      await insforge.auth.signOut();
    } catch {
      // La sesión local se cierra igualmente.
    }
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        mode: isInsforgeConfigured ? 'insforge' : 'demo',
        login,
        logout,
        register,
        confirmRegistration,
        resendVerificationCode,
        updateProfile,
        requestPasswordReset,
        confirmPasswordReset,
        completePasswordReset,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
