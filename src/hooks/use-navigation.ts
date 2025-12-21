import { useLocation } from "wouter";

interface MeadowQueryParams {
  q?: string;
  page?: number;
}

export function useNavigation() {
  const [, setLocation] = useLocation();

  return {
    navigateToChat: (id?: string) => {
      setLocation(id ? `/chat/${id}` : "/chat");
    },
    navigateToMeadow: (word?: string, query?: MeadowQueryParams) => {
      let path = word ? `/meadow/${encodeURIComponent(word)}` : "/meadow";

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
    navigateToYouTube: (options?: { translationId?: string; videoId?: string; timestamp?: number }) => {
      let path = "/youtube";
      const params = new URLSearchParams();

      if (options?.translationId) {
        params.set("tid", options.translationId);
      } else if (options?.videoId) {
        params.set("v", options.videoId);
        if (options?.timestamp !== undefined) {
          params.set("t", String(Math.floor(options.timestamp)));
        }
      }

      const queryString = params.toString();
      if (queryString) {
        path += `?${queryString}`;
      }

      setLocation(path);
    },
  };
}
