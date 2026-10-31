export type Theme = { id: string; name: string; primary: string; accent: string };

export const THEMES: Theme[] = [
  { id: "acai", name: "Açaí", primary: "#4A1259", accent: "#C2185B" },
  { id: "oceano", name: "Oceano", primary: "#0D3B66", accent: "#1E88E5" },
  { id: "floresta", name: "Floresta", primary: "#1B4332", accent: "#2D9D5C" },
  { id: "por-do-sol", name: "Pôr do sol", primary: "#7A2E0E", accent: "#F2711C" },
  { id: "morango", name: "Morango", primary: "#7B1030", accent: "#E53950" },
  { id: "grafite", name: "Grafite", primary: "#1F2933", accent: "#5C6BC0" },
  { id: "limao", name: "Limão", primary: "#33450F", accent: "#8DB31C" },
];

export function applyTheme(id: string, mode: string) {
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0];
  const dark = mode === "escuro";
  const r = document.documentElement.style;
  r.setProperty("--pri", t.primary);
  r.setProperty("--acc", t.accent);
  r.setProperty("--bg", dark ? "#121016" : `color-mix(in srgb, ${t.primary} 7%, white)`);
  r.setProperty("--card", dark ? "#1E1A24" : "#FFFFFF");
  r.setProperty("--txt", dark ? "#F2EEF5" : "#22172A");
  r.setProperty("--mut", dark ? "#A99FB3" : "#776A80");
  r.setProperty("--line", dark ? "#2F2836" : `color-mix(in srgb, ${t.primary} 14%, white)`);
  r.setProperty("--tint", dark ? `color-mix(in srgb, ${t.accent} 22%, #1E1A24)` : `color-mix(in srgb, ${t.accent} 12%, white)`);
  document.documentElement.dataset.mode = dark ? "escuro" : "claro";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.primary);
  localStorage.setItem("motoboy-theme", JSON.stringify({ id: t.id, mode }));
}

export function cachedTheme() {
  try { return JSON.parse(localStorage.getItem("motoboy-theme") || "") as { id: string; mode: string }; } catch { return { id: "acai", mode: "claro" }; }
}
