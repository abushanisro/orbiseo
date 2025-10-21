// lib/api.ts - API client for backend communication with Enhanced Debugging

// Ensure environment variable is logged for debugging
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

console.log('🔧 [DEBUG] API Configuration Initialized:', {
  API_BASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  timestamp: new Date().toISOString(),
  userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'Server-side',
});

// Custom Error Class for Better Stack Traces and Details
export class BackendAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public endpoint?: string,
    public requestBody?: any,
    public responseData?: any
  ) {
    super(message);
    this.name = 'BackendAPIError';
    Object.setPrototypeOf(this, BackendAPIError.prototype); // Ensure proper prototype chain
  }
}

// Improved fetch wrapper with detailed debugging logs, timeout, and abort handling
async function debugFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log('📤 [DEBUG] API Request Initiated:', {
    url,
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body ? JSON.parse(options.body as string) : undefined,
    timestamp: new Date().toISOString(),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.warn('⏰ [DEBUG] Request Timed Out:', { url, timeout: '30s' });
  }, 30000); // 30-second timeout for debugging slow responses

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);

    console.log('📥 [DEBUG] API Response Received:', {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString(),
    });

    // Clone response for debugging body without consuming it
    const responseClone = response.clone();
    const responseText = await responseClone.text();
    console.log('📄 [DEBUG] Raw Response Body:', responseText.substring(0, 500) + (responseText.length > 500 ? '... [truncated]' : ''));

    if (!response.ok) {
      let errorData: any = { detail: 'Unknown error' };
      try {
        errorData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('⚠️ [DEBUG] Failed to Parse Error Response as JSON:', parseError);
        errorData = { detail: responseText || response.statusText };
      }

      console.error('❌ [DEBUG] API Error Details:', {
        url,
        status: response.status,
        errorData,
        requestBody: options.body ? JSON.parse(options.body as string) : undefined,
      });

      throw new BackendAPIError(
        errorData.detail || `API Error: ${response.status}`,
        response.status,
        endpoint,
        options.body ? JSON.parse(options.body as string) : undefined,
        errorData
      );
    }

    let data: T;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('⚠️ [DEBUG] Failed to Parse Success Response as JSON:', parseError);
      throw new BackendAPIError('Invalid JSON response', response.status, endpoint);
    }

    console.log('✅ [DEBUG] API Success Parsed Data:', {
      url,
      dataKeys: Object.keys(data as any),
      dataSample: JSON.stringify(data).substring(0, 500) + (JSON.stringify(data).length > 500 ? '... [truncated]' : ''),
    });

    return data;
    
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const err = error instanceof Error ? error : new Error('Unknown fetch error');
    
    const errorInfo = {
      url,
      name: err.name,
      message: err.message,
      type: err.constructor.name,
      endpoint,
      requestBody: options.body ? JSON.parse(options.body as string) : undefined,
    };

    if (err.name === 'AbortError') {
      errorInfo.message = 'Request aborted due to timeout (30s)';
      console.warn('⏳ [DEBUG] Abort Error:', errorInfo);
    } else if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
      errorInfo.message = 'Network error - Check backend, CORS, or connectivity';
      console.error('🌐 [DEBUG] Network/Type Error:', errorInfo);
      console.info('💡 [DEBUG] Troubleshooting Tips:', [
        '1. Is the backend running? Try curl http://localhost:8000/health',
        '2. Check browser console for CORS errors',
        '3. Verify NEXT_PUBLIC_API_URL in .env.local',
        '4. Ensure backend allows CORS for your origin',
      ]);
    } else {
      console.error('🔥 [DEBUG] Unexpected Fetch Exception:', errorInfo);
    }

    if (error instanceof BackendAPIError) {
      throw error;
    }

    throw new BackendAPIError(
      err.message || 'Network request failed',
      undefined,
      endpoint,
      options.body ? JSON.parse(options.body as string) : undefined,
      errorInfo
    );
  }
}

// API Methods with Async/Await and Debugging Wrapped
export const backendAPI = {
  /**
   * Semantic keyword search with debug logs
   * FIXED: Removed /api prefix from endpoint
   */
  async semanticSearch(params: {
    query: string;
    topK?: number;
    includeIntent?: boolean;
    minSimilarity?: number;
    useDataForSEO?: boolean;
    includeMetrics?: boolean;
    locationCode?: number;
    languageCode?: string;
  }) {
    console.log('🔍 [DEBUG] semanticSearch Method Called:', {
      params,
      timestamp: new Date().toISOString(),
    });

    const body = JSON.stringify({
      query: params.query,
      topK: params.topK || 20,
      includeIntent: params.includeIntent !== false,
      minSimilarity: params.minSimilarity || 0.5,
      useDataForSEO: params.useDataForSEO !== false,
      includeMetrics: params.includeMetrics !== false,
      locationCode: params.locationCode || 2840,
      languageCode: params.languageCode || 'en',
    });

    // FIXED: Backend uses /api prefix
    return debugFetch('/api/semantic-search-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  },

  /**
   * Keyword expansion with debug logs
   * FIXED: Removed /api prefix from endpoint
   */
  async expandKeywords(params: {
    seed_keyword: string;
    expansion_count?: number;
    include_dataforseo?: boolean;
    include_ai?: boolean;
    include_metrics?: boolean;
    locationCode?: number;
    languageCode?: string;
  }) {
    console.log('📈 [DEBUG] expandKeywords Method Called:', {
      params,
      timestamp: new Date().toISOString(),
    });

    const body = JSON.stringify({
      seed_keyword: params.seed_keyword,
      expansion_count: params.expansion_count || 50,
      include_dataforseo: params.include_dataforseo !== false,
      include_ai: params.include_ai !== false,
      include_metrics: params.include_metrics !== false,
      locationCode: params.locationCode || 2840,
      languageCode: params.languageCode || 'en',
    });

    // FIXED: Backend uses /api prefix
    return debugFetch('/api/expand-keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  },

  /**
   * SERP analysis with debug logs
   * FIXED: Removed /api prefix from endpoint
   */
  async serpAnalysis(params: {
    keyword: string;
    locationCode?: number;
    languageCode?: string;
  }) {
    console.log('🌐 [DEBUG] serpAnalysis Method Called:', {
      params,
      timestamp: new Date().toISOString(),
    });

    const body = JSON.stringify({
      keyword: params.keyword,
      locationCode: params.locationCode || 2840,
      languageCode: params.languageCode || 'en',
    });

    // FIXED: Backend uses /api prefix
    return debugFetch('/api/dataforseo/serp-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  },

  /**
   * Health check with debug logs
   * Backend uses /health (no /api prefix)
   */
  async healthCheck() {
    console.log('🩺 [DEBUG] healthCheck Method Called:', {
      url: `${API_BASE_URL}/health`,
      timestamp: new Date().toISOString(),
    });

    return debugFetch('/health', { method: 'GET' });
  },

  /**
   * Additional Debug Method: Test Connection with Comprehensive Diagnostics
   */
  async testConnection(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    diagnostics?: any;
  }> {
    console.log('🧪 [DEBUG] testConnection Initiated:', {
      API_BASE_URL,
      timestamp: new Date().toISOString(),
    });

    try {
      // Step 1: Root endpoint accessibility
      console.log('Step 1: Testing root endpoint...');
      const rootResponse = await fetch(API_BASE_URL, { method: 'GET', mode: 'cors' });
      console.log('Root Response:', { status: rootResponse.status });

      // Step 2: Health check via wrapper
      console.log('Step 2: Performing health check...');
      const healthData = await this.healthCheck();
      console.log('Health Check Success:', healthData);

      return {
        success: true,
        data: healthData,
        diagnostics: {
          rootStatus: rootResponse.status,
          healthStatus: healthData,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      console.error('❌ [DEBUG] testConnection Failed:', {
        name: err.name,
        message: err.message,
        stack: err.stack?.split('\n').slice(0, 5), // Limit stack for logs
      });

      return {
        success: false,
        error: err.message,
        diagnostics: {
          API_BASE_URL,
          errorType: err.name,
          possibleCauses: [
            'Backend server not running',
            'Incorrect port or URL',
            'CORS policy blocking',
            'Network firewall',
            'Environment variable misconfigured',
          ],
          troubleshooting: [
            'Run: curl http://localhost:8000/health',
            'Check server logs for errors',
            'Inspect browser DevTools > Network tab',
            'Verify .env.local file',
          ],
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
};

// Helper: Auto-run connection test on client-side load for debug
if (typeof window !== 'undefined') {
  console.log('🚀 [DEBUG] Auto-Running API Connection Test on Page Load...');
  backendAPI.testConnection().then((result) => {
    if (result.success) {
      console.log('🎉 [DEBUG] Backend Connection Successful!', result.data);
    } else {
      console.warn('⚠️ [DEBUG] Backend Connection Issue Detected!', result.error);
      console.table(result.diagnostics?.possibleCauses);
      console.table(result.diagnostics?.troubleshooting);
    }
  }).catch((unexpectedError) => {
    console.error('💥 [DEBUG] Unexpected Error in Auto-Test:', unexpectedError);
  });
}

export default backendAPI;