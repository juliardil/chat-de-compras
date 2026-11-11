import { useEffect, useRef, useState } from 'react';
import { describeError } from './appData';

// Hook de lectura para los módulos de la app. El loader puede devolver
// `{ items, error, notice, extra }`; cualquier excepción se convierte en un
// mensaje amigable en lugar de romper la pantalla.
export function useModuleData(loader, deps = []) {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState({
    items: [],
    loading: true,
    error: null,
    notice: null,
    extra: null,
  });

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true }));

    Promise.resolve()
      .then(() => loaderRef.current())
      .then((result) => {
        if (cancelled) return;
        setState({
          items: Array.isArray(result?.items) ? result.items : [],
          loading: false,
          error: result?.error ?? null,
          notice: result?.notice ?? null,
          extra: result?.extra ?? null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          items: [],
          loading: false,
          error: describeError(error),
          notice: null,
          extra: null,
        });
      });

    return () => {
      cancelled = true;
    };
    // `deps` lo define cada pantalla para evitar bucles con loaders inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  return {
    ...state,
    reload: () => setReloadToken((token) => token + 1),
  };
}
