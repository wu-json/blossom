import { useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useChatStore } from "../../store/chat-store";
import { MeadowPage } from "./meadow-page";

export function MeadowRoute() {
  const params = useParams<{ word?: string }>();
  const selectedFlower = useChatStore((state) => state.selectedFlower);
  const selectFlower = useChatStore((state) => state.selectFlower);
  const clearSelectedFlower = useChatStore((state) => state.clearSelectedFlower);
  const lastLoadedWord = useRef<string | null>(null);

  useEffect(() => {
    const urlWord = params.word ? decodeURIComponent(params.word) : undefined;

    if (urlWord) {
      // URL has a word - load it if different from current
      if (lastLoadedWord.current !== urlWord) {
        lastLoadedWord.current = urlWord;
        selectFlower(urlWord);
      }
    } else {
      // No word in URL - clear selection
      if (selectedFlower !== null) {
        lastLoadedWord.current = null;
        clearSelectedFlower();
      }
    }
  }, [params.word, selectedFlower, selectFlower, clearSelectedFlower]);

  return <MeadowPage />;
}
