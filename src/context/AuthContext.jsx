import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './auth-context';
import { insforge, isInsforgeConfigured } from '../lib/insforge';
import { ensureProfile, fetchCommerceIdForUser } from '../data/appData';
import {
  fetchMySellerMembership,
  SELLER_DISABLED_MESSAGE,
} from '../data/commerceSellers';
import { fetchMyWorkshop } from '../data/workshop';

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
const SELLER_DISABLED_KEY = 'chat_compras_seller_disabled';

// El aviso de desactivación debe sobrevivir al cierre de sesión y a la
// redirección a /login, pero no a un inicio de sesión correcto.
const readSellerDisabledNotice = () => {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(SELLER_DISABLED_KEY) || null;
  } catch {
    return null;
  }
};

const writeSellerDisabledNotice = (message) => {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(SELLER_DISABLED_KEY, message);
  } catch {
    // El aviso en memoria sigue disponible durante esta carga.
  }
};

const clearSellerDisabledNotice = () => {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(SELLER_DISABLED_KEY);
  } catch {
    // No hay nada que limpiar si el navegador bloquea el almacenamiento.
  }
};

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
    if (parsed && ['user', 'commerce', 'seller'].includes(parsed.role)) {
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

// Normaliza los arreglos de segmentación del negocio antes de guardar el
// perfil: sin duplicados, sin valores vacíos y sin espacios accidentales.
const normalizeStringList = (values) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
    )
  );

// Solo toca las claves presentes para no inventar segmentación cuando un
// parche de perfil no incluye datos del negocio.
const normalizeBusiness = (business) => {
  if (!business || typeof business !== 'object' || Array.isArray(business)) {
    return business;
  }

  const next = { ...business };
  if (Object.prototype.hasOwnProperty.call(business, 'vehicleTypes')) {
    next.vehicleTypes = normalizeStringList(business.vehicleTypes);
  }
  if (Object.prototype.hasOwnProperty.call(business, 'inventorySystems')) {
    next.inventorySystems = normalizeStringList(business.inventorySystems);
  }
  return next;
};

// -----------------------------------------------------------------------------
// Mapeo del usuario de InsForge hacia el usuario de la app.
// auth.users.profile (JSONB) guarda: name, phone, birth_date, role ('user' |
// 'commerce'), business (datos del comercio), addresses (direcciones del
// comprador) y location (coordenadas del comprador para calcular distancias).
// El correo vive en auth.users.email y no se edita desde la app (requiere
// reverificación).
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
  const location = profile.location && typeof profile.location === 'object' ? profile.location : null;

  return {
    id: authUser.id,
    email,
    name,
    phone: profile.phone || '',
    birthDate: profile.birth_date || '',
    avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : '',
    business,
    addresses: Array.isArray(profile.addresses) ? profile.addresses : [],
    location,
    role: profile.role === 'commerce' ? 'commerce' : 'user',
  };
};

const homeFor = (user) =>
  user?.role === 'commerce' || user?.role === 'seller' ? '/dashboard' : '/categories';

// Un vendedor no guarda su rol en auth.users.profile: se deriva de
// commerce_members. Al actualizar el perfil hay que conservar esa identidad
// aunque el JSONB no traiga `role`.
const keepSessionIdentity = (next, previous) => ({
  ...next,
  role: previous?.role === 'seller' ? 'seller' : next.role,
  avatarUrl: next.avatarUrl || previous?.avatarUrl || '',
  sellerCommerceName: previous?.sellerCommerceName || '',
});

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(isInsforgeConfigured ? null : readStoredSession);
  // En modo InsForge la sesión se rehidrata de forma asíncrona: exponer
  // `loading` evita que los guardas redirijan a /welcome antes de tiempo.
  const [loading, setLoading] = useState(isInsforgeConfigured);

  // Un taller verificado conserva su rol de comprador, pero puede activar la
  // vista de empresa para cotizar servicios. Estos dos valores son de sesión:
  // no se guardan en localStorage ni cambian el `role` persistido en el backend.
  const [workshopVerified, setWorkshopVerified] = useState(false);
  const [viewMode, setViewModeState] = useState('buyer');
  const [sellerMembership, setSellerMembership] = useState(null);
  const [sellerCommerceName, setSellerCommerceName] = useState('');
  const [authNotice, setAuthNotice] = useState(() => readSellerDisabledNotice());

  const clearAuthNotice = useCallback(() => {
    clearSellerDisabledNotice();
    setAuthNotice(null);
  }, []);

  // Cierra la sesión completa. `keepNotice` se usa solo cuando el motivo es la
  // desactivación del vendedor: el mensaje debe verse en la pantalla de login.
  const performLogout = useCallback(
    async ({ keepNotice = false } = {}) => {
      if (!isInsforgeConfigured) {
        clearStoredSession();
      } else {
        try {
          await insforge.auth.signOut();
        } catch {
          // La sesión local se cierra igualmente.
        }
      }

      setUser(null);
      setWorkshopVerified(false);
      setViewModeState('buyer');
      setSellerMembership(null);
      setSellerCommerceName('');

      if (keepNotice) {
        setAuthNotice(readSellerDisabledNotice() || SELLER_DISABLED_MESSAGE);
      } else {
        clearSellerDisabledNotice();
        setAuthNotice(null);
      }

      navigate('/login', { replace: true });
    },
    [navigate]
  );

  // Resuelve la membresía del usuario autenticado. Un seller activo conserva
  // los datos de la empresa para el encabezado; uno inactivo se marca para
  // cerrar sesión de inmediato.
  const resolveSellerIdentity = useCallback(async (baseUser) => {
    if (!baseUser || !isInsforgeConfigured) {
      return { user: baseUser, membership: null, commerceName: '', disabled: false };
    }

    const result = await fetchMySellerMembership();
    const membership = result.item;
    if (!membership) {
      return { user: baseUser, membership: null, commerceName: '', disabled: false };
    }

    if (membership.role === 'seller' && !membership.is_active) {
      writeSellerDisabledNotice(SELLER_DISABLED_MESSAGE);
      return { user: baseUser, membership, commerceName: '', disabled: true };
    }

    if (membership.role !== 'seller') {
      return { user: baseUser, membership, commerceName: '', disabled: false };
    }

    const commerce = await fetchCommerceIdForUser(baseUser.id);
    const commerceName = commerce.item?.trade_name || '';
    return {
      user: {
        ...baseUser,
        role: 'seller',
        name: membership.full_name || baseUser.name,
        avatarUrl: membership.avatar_url || baseUser.avatarUrl,
        sellerCommerceName: commerceName,
      },
      membership,
      commerceName,
      disabled: false,
    };
  }, []);

  // Lee la credencial del taller desde la RPC aislada del módulo. Si falla, la
  // app sigue funcionando como comprador: nunca bloquea el inicio de sesión.
  const refreshWorkshopCapability = useCallback(async () => {
    if (!isInsforgeConfigured) {
      setWorkshopVerified(false);
      return false;
    }
    try {
      const { items } = await fetchMyWorkshop();
      const verified = Boolean(items?.[0]?.is_verified);
      setWorkshopVerified(verified);
      return verified;
    } catch {
      setWorkshopVerified(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isInsforgeConfigured) return undefined;

    let cancelled = false;
    const hydrate = async () => {
      try {
        const { data, error } = await insforge.auth.getCurrentUser();
        if (cancelled) return;
        const baseUser = error ? null : mapInsForgeUser(data?.user);

        if (!baseUser) {
          setUser(null);
          setSellerMembership(null);
          setSellerCommerceName('');
          setWorkshopVerified(false);
          return;
        }

        const identity = await resolveSellerIdentity(baseUser);
        if (cancelled) return;

        if (identity.disabled) {
          setAuthNotice(SELLER_DISABLED_MESSAGE);
          await performLogout({ keepNotice: true });
          return;
        }

        setUser(identity.user);
        setSellerMembership(identity.membership);
        setSellerCommerceName(identity.commerceName);
        // Solo el dueño/comprador necesita aprovisionar su perfil; el vendedor
        // pertenece al comercio y no debe crear un perfil propio de comprador.
        if (!identity.membership || identity.membership.role === 'owner') {
          void ensureProfile();
        }
        if (['commerce', 'seller'].includes(identity.user.role)) setViewModeState('business');
        await refreshWorkshopCapability();
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
  }, [performLogout, refreshWorkshopCapability, resolveSellerIdentity]);

  // Verificación periódica de la membresía: si el dueño desactiva al vendedor
  // desde otro dispositivo, la sesión se cierra sin esperar una recarga.
  useEffect(() => {
    if (!isInsforgeConfigured || user?.role !== 'seller') return undefined;

    let cancelled = false;
    const verify = async () => {
      try {
        const result = await fetchMySellerMembership();
        const membership = result.item;
        if (cancelled || !membership || membership.role !== 'seller') return;

        if (!membership.is_active) {
          writeSellerDisabledNotice(SELLER_DISABLED_MESSAGE);
          setAuthNotice(SELLER_DISABLED_MESSAGE);
          await performLogout({ keepNotice: true });
          return;
        }

        setSellerMembership(membership);
        setUser((current) =>
          current
            ? {
                ...current,
                role: 'seller',
                name: membership.full_name || current.name,
                avatarUrl: membership.avatar_url || current.avatarUrl,
              }
            : current
        );
      } catch {
        // Una falla de red no cierra la sesión: se reintenta en el próximo ciclo.
      }
    };

    void verify();
    const interval = setInterval(verify, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [performLogout, user?.role]);

  // Guarda el perfil en auth.users.profile fusionando con lo existente ( así
  // la operación es segura tanto si el backend fusiona como si reemplaza).
  const saveInsforgeProfile = async (patch) => {
    const { data, error } = await insforge.auth.getCurrentUser();
    if (error || !data?.user) {
      throw new Error('No hay una sesión activa para actualizar el perfil.');
    }

    const nextProfile = { ...readInsforgeProfile(data.user), ...patch };
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'business')) {
      nextProfile.business = normalizeBusiness(patch.business);
    }
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
        setWorkshopVerified(false);
        setSellerMembership(null);
        setSellerCommerceName('');
        clearSellerDisabledNotice();
        setAuthNotice(null);
        setViewModeState(demoUser.role === 'commerce' ? 'business' : 'buyer');
        navigate(homeFor(demoUser), { replace: true });
        return demoUser;
      }

      const { data, error } = await insforge.auth.signInWithPassword({ email, password });
      if (error || !data?.user) {
        const authError = new Error(error?.message || 'Correo o contraseña incorrectos.');
        if (error?.statusCode) authError.statusCode = error.statusCode;
        throw authError;
      }

      const identity = await resolveSellerIdentity(mapInsForgeUser(data.user));
      if (identity.disabled) {
        setAuthNotice(SELLER_DISABLED_MESSAGE);
        await performLogout({ keepNotice: true });
        throw new Error(SELLER_DISABLED_MESSAGE);
      }

      const nextUser = identity.user;
      setUser(nextUser);
      setSellerMembership(identity.membership);
      setSellerCommerceName(identity.commerceName);
      if (!identity.membership || identity.membership.role === 'owner') {
        await ensureProfile();
      }
      await refreshWorkshopCapability();
      if (['commerce', 'seller'].includes(nextUser.role)) setViewModeState('business');
      clearSellerDisabledNotice();
      setAuthNotice(null);
      navigate(homeFor(nextUser), { replace: true });
      return nextUser;
    },
    [navigate, performLogout, refreshWorkshopCapability, resolveSellerIdentity]
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
        setWorkshopVerified(false);
        setSellerMembership(null);
        setSellerCommerceName('');
        clearSellerDisabledNotice();
        setAuthNotice(null);
        setViewModeState(demoUser.role === 'commerce' ? 'business' : 'buyer');
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
      await ensureProfile();
      await refreshWorkshopCapability();
      if (role === 'commerce') setViewModeState('business');
      const nextUser = mapInsForgeUser({ ...authUser, profile });
      setUser(nextUser);
      navigate(homeFor(nextUser), { replace: true });
      return { verificationRequired: false };
    },
    [navigate, refreshWorkshopCapability]
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
      await ensureProfile();
      await refreshWorkshopCapability();
      if (role === 'commerce') setViewModeState('business');
      const nextUser = mapInsForgeUser({ ...authUser, profile });
      setUser(nextUser);
      navigate(homeFor(nextUser), { replace: true });
      return nextUser;
    },
    [navigate, refreshWorkshopCapability]
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
        avatarUrl: patch.avatar_url ?? user?.avatarUrl ?? '',
        business: Object.prototype.hasOwnProperty.call(patch, 'business')
          ? normalizeBusiness(patch.business)
          : user?.business ?? null,
        addresses: patch.addresses ?? user?.addresses ?? [],
        location: patch.location ?? user?.location ?? null,
      };
      setUser(nextUser);
      writeStoredSession(nextUser);
      return nextUser;
    }

    const { authUser, profile } = await saveInsforgeProfile(patch);

    // La URL de la foto se guarda en auth.users.profile (para la vista propia)
    // y en buyer_profiles/commerce_profiles (para que la contraparte la lea).
    if (Object.prototype.hasOwnProperty.call(patch, 'avatar_url')) {
      const { error: avatarError } = await insforge.database.rpc('app_set_avatar_url', {
        p_avatar_url: patch.avatar_url || null,
      });
      if (avatarError) {
        throw new Error(avatarError.message || 'No se pudo guardar la foto de perfil.');
      }
    }

    if (user?.role !== 'seller') await ensureProfile();
    await refreshWorkshopCapability();
    const nextUser = keepSessionIdentity(mapInsForgeUser({ ...authUser, profile }), user);
    if (user?.role === 'seller') {
      const membershipResult = await fetchMySellerMembership();
      if (membershipResult.item) setSellerMembership(membershipResult.item);
    }
    setUser(nextUser);
    return nextUser;
  }, [refreshWorkshopCapability, user]);

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
    await performLogout();
  }, [performLogout]);

  // Cambia la vista activa. Un usuario normal no puede activar el modo empresa:
  // solo un comercio o un Taller Verificado pueden hacerlo.
  const setViewMode = useCallback(
    (next) => {
      const target = next === 'business' ? 'business' : 'buyer';
      if (user?.role === 'seller') {
        setViewModeState('business');
        return true;
      }
      if (target === 'business' && user?.role !== 'commerce' && !workshopVerified) {
        return false;
      }
      setViewModeState(target);
      return true;
    },
    [user?.role, workshopVerified]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        mode: isInsforgeConfigured ? 'insforge' : 'demo',
        workshopVerified,
        viewMode,
        setViewMode,
        sellerMembership,
        sellerCommerceName,
        authNotice,
        clearAuthNotice,
        refreshWorkshopCapability,
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
