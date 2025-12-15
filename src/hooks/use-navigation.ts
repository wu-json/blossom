import { useLocation } from "wouter";

interface GardenQueryParams {
  q?: string;
  page?: number;
}

export function useNavigation() {
  const [, setLocation] = useLocation();

  return {
    navigateToChat: (id?: string) => {
      setLocation(id ? `/chat/${id}` : "/chat");
    },
    navigateToGarden: (word?: string, query?: GardenQueryParams) => {
      let path = word ? `/garden/${encodeURIComponent(word)}` : "/garden";

      const params = new URLSearchParams();
      if (query?.q) {
        params.set("q", query.q);
      }
      if (query?.page && query.page > 1) {
        params.set("page", String(query.page));
      }

      const queryString = params.toString();
      if (queryString) {
        path += `?${queryString}`;
      }

      setLocation(path);
    },
    navigateToTeacher: () => setLocation("/teacher"),
    navigateToSettings: () => setLocation("/settings"),
  };
}
