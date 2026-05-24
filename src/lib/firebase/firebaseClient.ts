export interface FirebasePlaceholderStatus {
  configured: boolean;
  projectId: string | null;
  message: string;
}

export function getFirebasePlaceholderStatus(): FirebasePlaceholderStatus {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || null;
  const configured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && projectId);

  return {
    configured,
    projectId,
    message: configured ? "Firebase environment values are present." : "Firebase is intentionally not configured in Step 1."
  };
}
