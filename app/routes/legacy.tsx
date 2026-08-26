import { useEffect, useState } from "react";
import type { ComponentType } from "react";

export default function LegacyRoute() {
  const [Component, setComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    import("../../src/App").then((mod) => {
      setComponent(() => mod.App || mod.default);
    });
  }, []);

  if (!Component) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-paper text-ink-muted">
        <div className="text-center font-serif">
          <div className="text-xl font-medium tracking-wide">Verso</div>
          <div className="mt-2 text-sm text-ink-faint">载入工作台中…</div>
        </div>
      </div>
    );
  }

  return <Component />;
}

