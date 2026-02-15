import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Simulate checking session
    const checkSession = async () => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2s splash delay
      
      // MOCK: Change this to test different flows
      // const mockUser = { role: 'user', name: 'Julia' }; 
      const mockUser = { role: 'commerce', name: 'TechMaster' };
      // const mockUser = null; 

      setUser(mockUser);
      setLoading(false);

      // Navigation logic based on role (Screen 0 logic)
      if (location.pathname === '/') {
        if (!mockUser) {
          navigate('/welcome');
        } else if (mockUser.role === 'user') {
          navigate('/categories');
        } else if (mockUser.role === 'commerce') {
          navigate('/dashboard');
        }
      }
    };

    checkSession();
  }, []);

  const login = (role) => {
    const newUser = { role, name: 'Test User' };
    setUser(newUser);
    if (role === 'user') navigate('/categories');
    else navigate('/dashboard');
  };

  const logout = () => {
    setUser(null);
    navigate('/welcome');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
