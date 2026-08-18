"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicContentItem } from "@/lib/public-content/catalog";

const ALL = "All";

function typeLabel(type: PublicContentItem["type"]) {
  return type
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ResourceExplorer({ items }: { items: PublicContentItem[] }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState(ALL);
  const [audience, setAudience] = useState(ALL);
  const [type, setType] = useState(ALL);

  const topics = useMemo(() => Array.from(new Set(items.map((item) => item.topic))), [items]);
  const audiences = useMemo(() => Array.from(new Set(items.flatMap((item) => item.audiences))), [items]);
  const types = useMemo(() => Array.from(new Set(items.map((item) => item.type))), [items]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const haystack = [item.title, item.summary, item.topic, item.type, ...item.audiences].join(" ").toLowerCase();
      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (topic === ALL || item.topic === topic) &&
        (audience === ALL || item.audiences.includes(audience as PublicContentItem["audiences"][number])) &&
        (type === ALL || item.type === type)
      );
    });
  }, [audience, items, query, topic, type]);

  const reset = () => {
    setQuery("");
    setTopic(ALL);
    setAudience(ALL);
    setType(ALL);
  };

  return (
    <section className="resource-section" id="explore" aria-labelledby="explore-title">
      <div className="resource-section-heading resource-section-heading-split">
        <div>
          <p className="eyebrow">Public content search</p>
          <h2 id="explore-title">Explore the library</h2>
        </div>
        <p>Search public guides, templates, insights, case studies, reference material, and learning sessions.</p>
      </div>

      <div className="resource-filter-panel">
        <label className="resource-search-field">
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search public resources and content"
          />
        </label>
        <label>
          <span>Topic</span>
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option>{ALL}</option>
            {topics.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>Audience</span>
          <select value={audience} onChange={(event) => setAudience(event.target.value)}>
            <option>{ALL}</option>
            {audiences.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>Content type</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option>{ALL}</option>
            {types.map((value) => <option key={value} value={value}>{typeLabel(value)}</option>)}
          </select>
        </label>
      </div>

      <div className="resource-results-summary">
        <p aria-live="polite">{filtered.length} public {filtered.length === 1 ? "resource" : "resources"}</p>
        {(query || topic !== ALL || audience !== ALL || type !== ALL) && (
          <button type="button" onClick={reset}>Clear filters</button>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="resource-content-grid">
          {filtered.map((item) => (
            <article className="resource-content-card" key={item.slug}>
              <div className="resource-card-meta">
                <span>{typeLabel(item.type)}</span>
                <span>{item.readingTime}</span>
              </div>
              <p className="resource-card-topic">{item.topic}</p>
              <h3><Link href={`/resources/${item.slug}`}>{item.title}</Link></h3>
              <p>{item.summary}</p>
              <div className="resource-audience-row" aria-label="Audience">
                {item.audiences.map((value) => <span key={value}>{value}</span>)}
              </div>
              <Link className="resource-text-link" href={`/resources/${item.slug}`}>Read resource <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="resource-empty-state">
          <strong>No matching public content.</strong>
          <p>Clear a filter or broaden the search. Exchange records are searched separately inside the authenticated chassis.</p>
          <button className="button button-secondary" type="button" onClick={reset}>Reset library</button>
        </div>
      )}
    </section>
  );
}
