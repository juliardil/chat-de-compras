import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

function buildAppUser(authUser, profile) {
  if (!authUser) return null;
  const role = profile?.role || authUser.user_metadata?.role || 'user';
  return {
    id: authUser.id,
    role,
    email: authUser.email,
    name:
      profile?.full_name ||
      profile?.trade_name ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.trade_name ||
      authUser.email,
    avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url || null,
    profile,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchProfile = async (authUserId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, user_profiles(*), commerce_profiles(*)')
        .eq('id', authUserId)
        .maybeSingle();

      if (error) console.warn('[Auth] Error cargando perfil:', error.message);
      if (!data) return null;

      const profile = {
        ...data,
        ...(data.user_profiles?.[0] || {}),
        ...(data.commerce_profiles?.[0] || {}),
      };
      delete profile.user_profiles;
      delete profile.commerce_profiles;
      return profile;
    } catch (e) {
      console.warn('[Auth] Excepción cargando perfil:', e);
      return null;
    }
  };

  const hydrateSession = async (authUser) => {
    if (!authUser) {
      setUser(null);
      return;
    }
    const profile = await fetchProfile(authUser.id);
    setUser(buildAppUser(authUser, profile));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) await hydrateSession(session?.user || null);

        if (mounted && location.pathname === '/') {
          const u = session?.user;
          if (!u) navigate('/welcome', { replace: true });
          else {
            const profile = u.user_metadata;
            const role = profile?.role || 'user';
            if (role === 'user') navigate('/categories', { replace: true });
            else if (role === 'commerce') navigate('/dashboard', { replace: true });
          }
        }
      } catch (e) {
        setError(e.message);
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await hydrateSession(session?.user || null);
      if (!session?.user) {
        if (location.pathname !== '/welcome' && location.pathname !== '/login') {
          navigate('/welcome', { replace: true });
        }
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [navigate, location.pathname]);

  const login = async (email, password) => {
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      throw error;
    }
    const authUser = data?.user;
    if (!authUser) throw new Error('No se pudo iniciar sesión');

    const profile = await fetchProfile(authUser.id);
    const appUser = buildAppUser(authUser, profile);
    if (appUser.role === 'user') navigate('/categories', { replace: true });
    else navigate('/dashboard', { replace: true });
    return appUser;
  };

  const signupUser = async ({ name, email, password }) => {
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'user',
          full_name: name,
        },
        emailRedirectTo: window.location.origin + '/welcome',
      },
    });
    if (error) {
      setError(error.message);
      throw error;
    }
    return data;
  };

  const signupCommerce = async (commerceData) => {
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: commerceData.email,
      password: commerceData.password,
      options: {
        data: {
          role: 'commerce',
          trade_name: commerceData.tradeName,
          legal_name: commerceData.legalName,
          phone: commerceData.phone,
          full_name: commerceData.tradeName,
        },
        emailRedirectTo: window.location.origin + '/dashboard',
      },
    });
    if (error) {
      setError(error.message);
      throw error;
    }
    if (data?.user) {
      try {
        const profile = {
          trade_name: commerceData.tradeName,
          legal_name: commerceData.legalName,
          address: commerceData.address,
          main_category: commerceData.mainCategory,
          vehicle_types: commerceData.vehicleTypes || [],
          inventory_systems: commerceData.inventorySystems || [],
          services: commerceData.services || [],
          years_experience: commerceData.yearsExperience ? Number(commerceData.yearsExperience) : null,
        };
        await supabase.from('commerce_profiles').upsert(profile, { onConflict: 'id' });
      } catch (e) {
        console.warn('[Auth] Error completando perfil comercio:', e);
      }
    }
    return data;
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
    } catch (e) {
      console.error('[Auth] Error en logout Supabase:', e);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      setUser(null);
      navigate('/login', { replace: true });
    }
  };

  const updateProfile = async (patch) => {
    if (!user?.id) throw new Error('Sin sesión activa');
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: patch.fullName ?? patch.full_name ?? patch.tradeName ?? undefined,
        phone: patch.phone ?? undefined,
        avatar_url: patch.avatar_url ?? undefined,
      })
      .eq('id', user.id);
    if (error) {
      setError(error.message);
      throw error;
    }
    if (user.role === 'user') {
      const upatch = {};
      if (patch.birthDate) upatch.birth_date = patch.birthDate;
      if (Object.keys(upatch).length) {
        const err = (await supabase.from('user_profiles').update(upatch).eq('id', user.id)).error;
        if (err) console.warn('[Auth] Error actualizando user_profiles:', err.message);
      }
    }
    const fresh = await fetchProfile(user.id);
    const authUser = (await supabase.auth.getUser()).data.user;
    setUser(buildAppUser(authUser, fresh));
  };

  const resetPassword = async (email) => {
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/change-password',
    });
    if (error) {
      setError(error.message);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        signupUser,
        signupCommerce,
        updateProfile,
        resetPassword,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
