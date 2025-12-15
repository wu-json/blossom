import { useLocation } from "wouter";

export function useNavigation() {
  const [, setLocation] = useLocation();

  return {
    navigateToChat: (id?: string) => {
      setLocation(id ? `/chat/${id}` : "/chat");
    },
    navigateToGarden: (word?: string) => {
      setLocation(word ? `/garden/${encodeURIComponent(word)}` : "/garden");
    },
    navigateToTeacher: () => setLocation("/teacher"),
    navigateToSettings: () => setLocation("/settings"),
  };
}
