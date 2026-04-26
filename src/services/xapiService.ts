import { supabase } from '../lib/supabase';

export interface XApiParams {
  activityId: string;
  activityType?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
  isPublic?: boolean;
}

export interface XApiEndParams extends XApiParams {
  success?: boolean;
  completion?: boolean;
  duration?: string; // ISO 8601 duration format or similar
}

export interface XApiScoreParams extends XApiParams {
  score: number;
  maxScore?: number;
}

export interface XApiStoreParams extends XApiParams {
  verb: string;
}

class XApiLiteService {
  private async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  async start(params: XApiParams) {
    const session = await this.getSession();
    if (!session) return null;

    const response = await fetch('/api/xapi/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(params)
    });

    return response.json();
  }

  async end(params: XApiEndParams) {
    const session = await this.getSession();
    if (!session) return null;

    const response = await fetch('/api/xapi/end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(params)
    });

    return response.json();
  }

  async score(params: XApiScoreParams) {
    const session = await this.getSession();
    if (!session) return null;

    const response = await fetch('/api/xapi/score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(params)
    });

    return response.json();
  }

  async store(params: XApiStoreParams) {
    const session = await this.getSession();
    if (!session) return null;

    const response = await fetch('/api/xapi/store', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(params)
    });

    return response.json();
  }

  async getPublic(activityId?: string) {
    try {
      const url = activityId ? `/api/xapi/public?activityId=${encodeURIComponent(activityId)}` : '/api/xapi/public';
      const response = await fetch(url);
      if (!response.ok) {
        return { success: true, statements: [] };
      }
      return response.json();
    } catch (err) {
      console.warn('XApi getPublic failed:', err);
      return { success: true, statements: [] };
    }
  }
}

export const xapiLite = new XApiLiteService();
