// public/shared/langSelector.js
import { getLang, setLang } from "../js/i18n.js";

const LANGS = [
  { code: "es", label: "ES", flag: "🇵🇷" },
  { code: "en", label: "EN", flag: "🇺🇸" },
  { code: "fr", label: "FR", flag: "🇫🇷" },
  { code: "pt", label: "PT", flag: "🇵🇹" },
  { code: "de", label: "DE", flag: "🇩🇪" },
  { code: "it", label: "IT", flag: "🇮🇹" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
];

function getLangMeta(lang) {
  const base = (lang || "es").toLowerCase().split("-")[0];
  return LANGS.find((l) => l.code === base) || LANGS[0];
}

export function mountLangSelector(containerSelector = "#langSwitcherMenu") {
  const root = document.querySelector(containerSelector);
  if (!root) return;

  // Prevent duplicates if called twice
  root.innerHTML = "";

  const current = getLangMeta(getLang());

  const wrapper = document.createElement("div");
  wrapper.className = "relative";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "flex items-center gap-1.5 px-2 py-1 bg-white/90 backdrop-blur border border-black/10 shadow-sm text-[11px] font-semibold text-gray-800 hover:bg-white transition";
  btn.innerHTML = `<span class="text-sm">${current.flag}</span><span>${current.label}</span>`;

  const menu = document.createElement("div");
  menu.className =
    "absolute z-50 mt-2 right-0 w-44 rounded-xl bg-white shadow-lg border border-black/5 overflow-hidden hidden";

  menu.innerHTML = LANGS.map(
    (l) => `
    <button type="button"
      class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5"
      data-lang="${l.code}">
      <span class="text-base">${l.flag}</span>
      <span class="font-semibold">${l.label}</span>
    </button>
  `
  ).join("");

  wrapper.appendChild(btn);
  wrapper.appendChild(menu);
  root.appendChild(wrapper);

  function close() {
    menu.classList.add("hidden");
  }
  function toggle() {
    menu.classList.toggle("hidden");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  menu.addEventListener("click", (e) => {
    const target = e.target.closest("[data-lang]");
    if (!target) return;
    const lang = target.getAttribute("data-lang");
    close();
    setLang(lang);
  });

  document.addEventListener("click", () => close());

  // Update button label when language changes anywhere
  window.addEventListener("lang:changed", () => {
    const meta = getLangMeta(getLang());
    btn.innerHTML = `<span class="text-base">${meta.flag}</span><span>${meta.label}</span>`;
  });
}
