import { useChatStore } from "../../store/chat-store";
import { FlowerCard } from "./flower-card";

export function FlowerList() {
  const { flowers, selectFlower } = useChatStore();

  return (
    <div className="grid gap-3 max-w-2xl mx-auto">
      {flowers.map((flower) => (
        <FlowerCard
          key={flower.word}
          flower={flower}
          onClick={() => selectFlower(flower.word)}
        />
      ))}
    </div>
  );
}
