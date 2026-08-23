import type { ReactNode } from "react";

export type AppView = "today" | "review" | "library" | "curriculum" | "progress" | "history";

interface BottomNavProps {
  current: AppView;
  onChange: (view: AppView) => void;
}

const items: Array<{ id: AppView; icon: string; label: string }> = [
  { id: "today", icon: "◒", label: "今日" },
  { id: "review", icon: "↻", label: "復習" },
  { id: "library", icon: "▤", label: "辞書" },
  { id: "curriculum", icon: "▦", label: "Units" },
  { id: "progress", icon: "↗", label: "進捗" },
];

export function BottomNav({ current, onChange }: BottomNavProps): ReactNode {
  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
      {items.map((item) => (
        <button
          className={current === item.id ? "nav-item active" : "nav-item"}
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-current={current === item.id ? "page" : undefined}
        >
          <span className="nav-icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
