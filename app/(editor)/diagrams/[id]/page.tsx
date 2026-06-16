"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import DiagramEditor from "@/components/diagrams/DiagramEditor";

interface DiagramData {
  id: string;
  name: string;
  content: string;
  latestVersion: number;
}

export default function DiagramEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [diagram, setDiagram] = useState<DiagramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/diagrams/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Diagram not found");
        return r.json();
      })
      .then((d) => setDiagram(d.diagram))
      .catch(() => setError("Diagram not found or failed to load."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !diagram || !user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-slate-500">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm">{error || "An error occurred."}</p>
        <button
          onClick={() => router.push("/diagrams")}
          className="text-sm text-brand-600 hover:underline"
        >
          Back to Diagrams
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      <DiagramEditor
        diagramId={diagram.id}
        initialName={diagram.name}
        initialContent={diagram.content}
        initialVersionNumber={diagram.latestVersion}
        userId={user.id}
        userName={user.name}
      />
    </div>
  );
}
