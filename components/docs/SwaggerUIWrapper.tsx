"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

// swagger-ui-react manipulates the DOM directly and doesn't support SSR.
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export function SwaggerUIWrapper({ spec }: { spec: object }) {
  // swagger-ui-react ships one fixed light theme (dark text, no dark-mode
  // variant of its own) — its CSS sets `.swagger-ui { color: #3b4151 }`
  // globally with no background, so on this app's dark theme that text
  // renders on the dark page background and is unreadable. Rather than
  // fight swagger-ui's hundreds of hardcoded classes with overrides, force
  // this subtree to always render as a light surface (`color-scheme: light`
  // also keeps native form controls, e.g. the "Try it out" selects, light).
  return (
    <div
      className="swagger-ui-container rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
      style={{ colorScheme: "light" }}
    >
      <SwaggerUI spec={spec} docExpansion="list" defaultModelsExpandDepth={-1} />
    </div>
  );
}
