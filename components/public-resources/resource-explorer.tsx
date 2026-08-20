"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { PublicContentFacets } from "@/lib/public-content/service";
import type { PublicAudience, PublicContentItem, PublicContentTopic, PublicContentType } from "@/lib/public-content/catalog";

const ALL = "";

type Filters = { q: string; topic: string; audience: string; type: string };

function typeLabel(type: string) {
  return type.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function filtersFromLocation(): Filters {
  if (typeof window === "undefined") return { q: "", topic: "", audience: "", type: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") ?? "",
    topic: params.get("topic") ?? "",
    audience: params.get("audience") ?? "",
    type: params.get("type") ?? "",
  };
}

export function ResourceExplorer({ items, facets }: { items: PublicContentItem[]; facets: PublicContentFacets }) {
  const [filters, setFilters] = useState<Filters>({ q: "", topic: "", audience: "", type: "" });

  useEffect(() => {
    const sync = () => setFilters(filtersFromLocation());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const filtered = useMemo(() => {
    const normalized = filters.q.trim().toLowerCase();
    return items.filter((item) => {
      const haystack = [item.title, item.summary, item.topic, item.type, ...item.audiences, ...item.collections, ...item.body, ...(item.takeaways ?? [])].join(" ").toLowerCase();
      return (
        (!normalized || haystack.includes(normalized)) &&
        (!filters.topic || item.topic === filters.topic as PublicContentTopic) &&
        (!filters.audience || item.audiences.includes(filters.audience as PublicAudience)) &&
        (!filters.type || item.type === filters.type as PublicContentType)
      );
    });
  }, [filters, items]);

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Filters = {
      q: String(form.get("q") ?? "").trim(),
      topic: String(form.get("topic") ?? ""),
      audience: String(form.get("audience") ?? ""),
      type: String(form.get("type") ?? ""),
    };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.topic) params.set("topic", next.topic);
    if (next.audience) params.set("audience", next.audience);
    if (next.type) params.set("type", next.type);
    const query = params.toString();
    window.history.pushState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}#explore`);
    setFilters(next);
  };

  const reset = () => {
    window.history.pushState(null, "", `${window.location.pathname}#explore`);
    setFilters({ q: "", topic: "", audience: "", type: "" });
  };

  const hasFilters = Boolean(filters.q || filters.topic || filters.audience || filters.type);

  return (
    <section className="resource-section" id="explore" aria-labelledby="explore-title">
      <div className="resource-section-heading resource-section-heading-split">
        <div>
          <p className="eyebrow">Public content search</p>
          <h2 id="explore-title">Explore the library</h2>
        </div>
        <p>Filters are encoded in the browser URL, so the current search can be shared and browser Back/Forward restores the same library state.</p>
      </div>

      <form className="resource-filter-panel" onSubmit={apply}>
        <label className="resource-search-field">
          <span>Search</span>
          <input key={`q-${filters.q}`} name="q" type="search" defaultValue={filters.q} placeholder="Search public resources and content" />
        </label>
        <label>
          <span>Topic</span>
          <select key={`topic-${filters.topic}`} name="topic" defaultValue={filters.topic || ALL}>
            <option value={ALL}>All</option>
            {facets.topics.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>Audience</span>
          <select key={`audience-${filters.audience}`} name="audience" defaultValue={filters.audience || ALL}>
            <option value={ALL}>All</option>
            {facets.audiences.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>Content type</span>
          <select key={`type-${filters.type}`} name="type" defaultValue={filters.type || ALL}>
            <option value={ALL}>All</option>
            {facets.types.map((value) => <option key={value} value={value}>{typeLabel(value)}</option>)}
          </select>
        </label>
        <div className="resource-filter-actions">
          <button className="button button-primary" type="submit">Apply</button>
          {hasFilters ? <button className="button button-secondary" type="button" onClick={reset}>Clear</button> : null}
        </div>
      </form>

      <div className="resource-results-summary">
        <p aria-live="polite">{filtered.length} published public {filtered.length === 1 ? "resource" : "resources"}</p>
      </div>

      {filtered.length > 0 ? (
        <div className="resource-content-grid">
          {filtered.map((item) => (
            <article className="resource-content-card" key={item.slug}>
              <div className="resource-card-meta"><span>{typeLabel(item.type)}</span><span>{item.readingTime}</span></div>
              <p className="resource-card-topic">{item.topic}</p>
              <h3><Link href={`/resources/${item.slug}`}>{item.title}</Link></h3>
              <p>{item.summary}</p>
              <div className="resource-audience-row" aria-label="Audience">{item.audiences.map((value) => <span key={value}>{value}</span>)}</div>
              <Link className="resource-text-link" href={`/resources/${item.slug}`}>Read resource <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="resource-empty-state">
          <strong>No published content matches these filters.</strong>
          <p>Clear a filter or broaden the search. Exchange records are searched separately inside the authenticated chassis.</p>
          <button className="button button-secondary" type="button" onClick={reset}>Reset library</button>
        </div>
      )}
    </section>
  );
}
