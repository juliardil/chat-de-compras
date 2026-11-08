import { useAdminAuth } from './useAdminAuth';

// Oculta contenido sin permiso. El servidor vuelve a validar cada operación:
// esto es solo presentación.
export default function PermissionGate({ permission, children, fallback = null }) {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission(permission)) return fallback;
  return children;
}
