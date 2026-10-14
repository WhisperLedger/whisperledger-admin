const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://whisperledger-api-dozavowbya-el.a.run.app/api/v1';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  avatar_url?: string;
  role: 'user' | 'household_admin' | 'platform_admin' | 'admin';
  is_active: boolean;
  household_id?: string;
  plan: 'pro' | 'starter_free';
  status: 'active' | 'suspended' | 'flagged';
  push_ready: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AdminMetrics {
  total_users: number;
  total_households: number;
  total_expenses_tracked: number;
  total_volume_tracked: number;
  total_receivables_pending: number;
  active_users_7_days: number;
  generated_at: string;
}

export interface DailyVolumeStat {
  date: string;
  amount: number;
  count: number;
}

export interface SystemLogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

export interface CloudTelemetry {
  service: string;
  region: string;
  revision: string;
  environment: string;
  status: string;
  uptime_seconds: number;
  go_version: string;
  memory_alloc_mb: number;
  memory_sys_mb: number;
  db_pool_total: number;
  db_pool_idle: number;
  db_pool_acquired: number;
  daily_volumes: DailyVolumeStat[];
  recent_logs: SystemLogEntry[];
  gcp_console_links: Record<string, string>;
}

export interface BroadcastNotification {
  id: string;
  app_name: string;
  title: string;
  body: string;
  image_url?: string;
  target: 'all' | 'pro_only' | 'single_user' | string;
  target_user_id?: string;
  type: 'promo' | 'system' | 'security' | 'update' | string;
  delivered_count: number;
  dispatch_status: 'delivered' | 'queued' | 'failed' | string;
  sent_at: string;
  created_at?: string;
}

class AdminApiService {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('whisperledger_access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  }

  async getMe(): Promise<{ success: boolean; data?: User; error?: { message: string } }> {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async getAdminMetrics(): Promise<{ success: boolean; data?: AdminMetrics; error?: { message: string } }> {
    const res = await fetch(`${API_BASE_URL}/admin/metrics`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async getAdminUsers(limit = 100, offset = 0): Promise<{ success: boolean; data?: User[]; meta?: { total: number }; error?: { message: string } }> {
    const res = await fetch(`${API_BASE_URL}/admin/users?limit=${limit}&offset=${offset}`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async updateUserSubscription(userId: string, plan: 'pro' | 'starter_free', status: 'active' | 'suspended' | 'flagged') {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/subscription`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ plan, status }),
    });
    return res.json();
  }

  async getCloudTelemetry(): Promise<{ success: boolean; data?: CloudTelemetry; error?: { message: string } }> {
    const res = await fetch(`${API_BASE_URL}/admin/telemetry`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async sendBroadcastNotification(data: {
    app_name?: string;
    title: string;
    body: string;
    image_url?: string;
    target: string;
    target_user_id?: string | null;
    type: string;
    delivered_count?: number;
  }) {
    const res = await fetch(`${API_BASE_URL}/admin/notifications`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async getBroadcastNotifications(limit = 20): Promise<{ success: boolean; data?: BroadcastNotification[]; error?: { message: string } }> {
    const res = await fetch(`${API_BASE_URL}/admin/notifications?limit=${limit}`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  logout() {
    localStorage.removeItem('whisperledger_access_token');
    localStorage.removeItem('whisperledger_admin_user');
  }
}

export const api = new AdminApiService();
