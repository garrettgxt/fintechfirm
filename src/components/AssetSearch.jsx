import { useEffect, useRef, useState } from "react";
import { ASSET_CATALOG } from "../assetCatalog.js";

const CATEGORY_TABS = [
  { key: "all", label: "All" },
  { key: "stock", label: "Stocks" },
  { key: "etf", label: "ETFs" },
  { key: "forex", label: "Forex" },
  { key: "crypto", label: "Crypto" },
];

// Search over the static catalog (src/assetCatalog.js) — no backend
// needed, it's a fixed list. onSelect receives the whole asset object
// ({ symbol, name, type }).
export default function AssetSearch({ onSelect, placeholder = "Search name or symbol" }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const byCategory = category === "all" ? ASSET_CATALOG : ASSET_CATALOG.filter((a) => a.type === category);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? byCategory.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
    : byCategory;
  const results = filtered.slice(0, 8);

  function handleSelect(asset) {
    setOpen(false);
    setQuery("");
    onSelect(asset);
  }

  return (
    <div ref={containerRef} className="asset-search">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        className="asset-search-input"
      />
      {open && (
        <div className="asset-search-dropdown">
          <div className="asset-search-tabs">
            {CATEGORY_TABS.map((c) => (
              <button key={c.key} className={category === c.key ? "active" : ""} onClick={() => setCategory(c.key)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="asset-search-results">
            {results.length === 0 ? (
              <div className="asset-search-empty">No matches</div>
            ) : (
              results.map((a) => (
                <button key={a.symbol} className="asset-search-row" onClick={() => handleSelect(a)}>
                  <span>
                    <strong>{a.symbol}</strong> <span className="asset-search-row-name">{a.name}</span>
                  </span>
                  <span className="asset-search-row-type">{a.type}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
