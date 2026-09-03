const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

async function request(path: string, options: RequestInit = {}) {
  if (!API_BASE) throw new Error("UniPool API is not configured");
  const response = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error: any = new Error(data?.detail || response.statusText || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export type CollegeSignupPreview = {
  roll_number?: string | null;
  school_name?: string | null;
  branch_name?: string | null;
  degree_level_name?: string | null;
  batch_year?: number | null;
};

export type CollegeSignupChallenge = {
  challenge_id: string;
  email: string;
  expires_in_seconds: number;
  student_preview: CollegeSignupPreview;
};

export const collegeSignupApi = {
  start: (body: { email: string; password: string; name: string; username?: string; turnstile_token?: string | null }) =>
    request("/auth/signup/college/start", { method: "POST", body: JSON.stringify(body) }) as Promise<CollegeSignupChallenge>,
  confirm: (challengeId: string, code: string) =>
    request("/auth/signup/college/confirm", { method: "POST", body: JSON.stringify({ challenge_id: challengeId, code }) }),
};

export function isMahindraCollegeEmail(value: string) {
  return /^[^@\s]+@mahindrauniversity\.edu\.in$/i.test((value || "").trim());
}
