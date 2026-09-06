"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

// swagger-ui-react manipulates the DOM directly and doesn't support SSR.
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export function SwaggerUIWrapper({ spec }: { spec: object }) {
  return (
    <div className="swagger-ui-container">
      <SwaggerUI spec={spec} docExpansion="list" defaultModelsExpandDepth={-1} />
    </div>
  );
}
