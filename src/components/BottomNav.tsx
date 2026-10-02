import type { ReactNode } from "react";

export type AppView = "today" | "review" | "library" | "curriculum" | "progress" | "lessonHome" | "legacyLibrary" | "legacyReview" | "legacyProgress";

interface BottomNavProps {
  current: AppView;
  onChange: (view: AppView) => void;
}

const items: Array<{ id: AppView; icon: string; label: string }> = [
  { id: "today", icon: "◒", label: "今日" },
  { id: "library", icon: "▤", label: "単語帳" },
  { id: "review", icon: "↻", label: "復習" },
  { id: "progress", icon: "↗", label: "記録" },
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
