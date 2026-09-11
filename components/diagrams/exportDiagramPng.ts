/**
 * Client-only helper — uses Excalidraw's exportToBlob (canvas API).
 * Returns a base64 data URL for the PNG, or null for empty/invalid scenes.
 */
export async function exportDiagramPng(content: string): Promise<string | null> {
  try {
    const { exportToBlob } = await import("@excalidraw/excalidraw");
    const parsed = JSON.parse(content);
    const elements: { isDeleted: boolean }[] = parsed.elements ?? [];
    if (elements.filter((el) => !el.isDeleted).length === 0) return null;

    /* eslint-disable @typescript-eslint/no-explicit-any -- persisted diagram JSON doesn't match Excalidraw's strict AppState type */
    const blob = await exportToBlob({
      elements: parsed.elements,
      appState: {
        exportBackground: true,
        exportWithDarkMode: false,
        ...(parsed.appState ?? {}),
      } as any,
      files: parsed.files ?? {},
      exportPadding: 16,
      maxWidthOrHeight: 2048,
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
