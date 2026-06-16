import { readFile } from "fs/promises";
import path from "path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// ---------------------------------------------------------------------------
// Read the CLAUDE.md file at request time (server component)
// ---------------------------------------------------------------------------
async function getContent(): Promise<string> {
  const filePath = path.join(process.cwd(), "CLAUDE.md");
  return readFile(filePath, "utf-8");
}

// ---------------------------------------------------------------------------
// Custom renderers — maps markdown elements to styled HTML
// ---------------------------------------------------------------------------
const components: Components = {
  // Headings
  h1: ({ children }) => (
    <h1 className="mt-8 mb-4 text-2xl font-bold text-slate-900 border-b border-slate-200 pb-3 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 mb-2 text-base font-semibold text-slate-700">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 mb-1.5 text-sm font-semibold text-slate-600 uppercase tracking-wider">{children}</h4>
  ),

  // Paragraphs
  p: ({ children }) => (
    <p className="my-3 text-sm leading-relaxed text-slate-600">{children}</p>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="my-3 space-y-1.5 pl-5 text-sm text-slate-600 list-disc">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 space-y-1.5 pl-5 text-sm text-slate-600 list-decimal">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),

  // Code
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className="block whitespace-pre-wrap text-xs text-slate-700 font-mono leading-relaxed">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-brand-700">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed">
      {children}
    </pre>
  ),

  // Tables
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-50">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-sm text-slate-600">{children}</td>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-brand-300 bg-brand-50 px-4 py-2 text-sm text-brand-700 rounded-r-lg">
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: () => <hr className="my-6 border-slate-200" />,

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-brand-600 hover:underline font-medium"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),

  // Strong / em
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-800">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-slate-600">{children}</em>
  ),
};

// ---------------------------------------------------------------------------
// Table of contents — extract h2 headings from raw markdown
// ---------------------------------------------------------------------------
function extractToc(markdown: string): { id: string; label: string }[] {
  const lines = markdown.split("\n");
  return lines
    .filter((l) => l.startsWith("## "))
    .map((l) => {
      const label = l.replace(/^## /, "").trim();
      const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return { id, label };
    });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function DocsPage() {
  const content = await getContent();
  const toc = extractToc(content);

  return (
    <div className="flex gap-8">

      {/* Sidebar TOC — hidden on small screens */}
      <aside className="hidden xl:block w-56 flex-shrink-0">
        <div className="sticky top-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            On this page
          </p>
          <nav className="space-y-1">
            {toc.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors leading-snug"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Platform Documentation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Technical reference for the Origin Halo Enterprise Architecture Repository.
          </p>
        </div>

        {/* Rendered markdown */}
        <div className="rounded-xl border border-slate-200 bg-white px-8 py-8 shadow-sm">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={components}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>

    </div>
  );
}
