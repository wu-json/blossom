import { useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";

export function useQueryParams() {
  const search = useSearch();
  const [location, setLocation] = useLocation();

  const params = useMemo(() => {
    return new URLSearchParams(search);
  }, [search]);

  const setQueryParams = useCallback(
    (newParams: Record<string, string | number | undefined>) => {
      const urlParams = new URLSearchParams(search);

      for (const [key, value] of Object.entries(newParams)) {
        if (value === undefined || value === "" || value === 0) {
          urlParams.delete(key);
        } else {
          urlParams.set(key, String(value));
        }
      }

      const queryString = urlParams.toString();
      const basePath = location.split("?")[0];
      const newPath = queryString ? `${basePath}?${queryString}` : basePath;

      setLocation(newPath, { replace: true });
    },
    [location, search, setLocation]
  );

  return { params, setQueryParams };
}
