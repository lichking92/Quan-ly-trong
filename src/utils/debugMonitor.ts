/**
 * UTILITY: FRONTEND PERFORMANCE & INFINITE LOOP MONITOR
 * Tracks and exposes:
 * - Component render counts
 * - API call counts
 * - Supabase queries
 * - Realtime subscriptions
 */

class DebugMonitor {
  private renders: Record<string, number> = {};
  private apiCalls: Record<string, number> = {};
  private supabaseQueries: Record<string, number> = {};
  private subscriptions: Record<string, number> = {};

  private hasChanges = false;
  private intervalId: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Start a reporting interval every 10 seconds to show diagnostic table if there are changes
      this.intervalId = setInterval(() => {
        this.reportIfNeeded();
      }, 10000);

      // Expose globally for browser console investigation
      (window as any).__DEBUG_MONITOR__ = this;
    }
  }

  public trackRender(componentName: string) {
    this.renders[componentName] = (this.renders[componentName] || 0) + 1;
    this.hasChanges = true;

    // Warning if rendering exceeds 100 times in a short span
    if (this.renders[componentName] > 150 && this.renders[componentName] % 50 === 0) {
      console.warn(
        `🚨 [LOOP DETECTED] Component '${componentName}' has rendered ${this.renders[componentName]} times! ` +
        `This might indicate an infinite loop or unstable dependencies.`
      );
    }
  }

  public trackApiCall(apiName: string) {
    this.apiCalls[apiName] = (this.apiCalls[apiName] || 0) + 1;
    this.hasChanges = true;
  }

  public trackSupabaseQuery(tableName: string, operation: string = 'query') {
    const key = `${tableName}:${operation}`;
    this.supabaseQueries[key] = (this.supabaseQueries[key] || 0) + 1;
    this.hasChanges = true;
  }

  public trackSubscription(channelName: string) {
    this.subscriptions[channelName] = (this.subscriptions[channelName] || 0) + 1;
    this.hasChanges = true;
  }

  public getStats() {
    return {
      renders: { ...this.renders },
      apiCalls: { ...this.apiCalls },
      supabaseQueries: { ...this.supabaseQueries },
      subscriptions: { ...this.subscriptions }
    };
  }

  public reportIfNeeded() {
    if (!this.hasChanges) return;
    this.hasChanges = false;

    console.groupCollapsed('📊 [Frontend Performance Monitor] Diagnostic Summary');
    console.log('Time:', new Date().toLocaleTimeString());
    
    console.log('--- Component Renders ---');
    console.table(Object.entries(this.renders).map(([name, count]) => ({ 'Component Name': name, 'Render Count': count })));

    if (Object.keys(this.apiCalls).length > 0) {
      console.log('--- API Calls ---');
      console.table(Object.entries(this.apiCalls).map(([name, count]) => ({ 'API Endpoint': name, 'Call Count': count })));
    }

    if (Object.keys(this.supabaseQueries).length > 0) {
      console.log('--- Supabase Queries ---');
      console.table(Object.entries(this.supabaseQueries).map(([key, count]) => {
        const [table, op] = key.split(':');
        return { 'Database Table': table, 'Operation': op, 'Count': count };
      }));
    }

    if (Object.keys(this.subscriptions).length > 0) {
      console.log('--- Realtime Subscriptions ---');
      console.table(Object.entries(this.subscriptions).map(([name, count]) => ({ 'Channel Name': name, 'Subscription Count': count })));
    }

    console.groupEnd();
  }

  public clear() {
    this.renders = {};
    this.apiCalls = {};
    this.supabaseQueries = {};
    this.subscriptions = {};
    this.hasChanges = false;
    console.log('🧹 performance stats cleared.');
  }
}

export const monitor = new DebugMonitor();
