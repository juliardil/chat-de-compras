import { useContext } from 'react';
import { AdminAuthContext } from './admin-auth-context';

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth debe usarse dentro de AdminAuthProvider.');
  }
  return context;
}
