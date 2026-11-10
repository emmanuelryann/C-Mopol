/**
 * API Client with automatic credentials (cookies) and token refresh.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  constructor(message, status = 500, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  refreshQueue = [];
};

export async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
    credentials: 'include', // Ensures httpOnly cookies (accessToken, refreshToken) are sent
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    throw new ApiError('Network error. Please check your internet connection or backend server.', 0);
  }

  // Handle 401 Unauthorized by attempting to refresh token
  if (response.status === 401 && !endpoint.includes('/refresh') && !endpoint.includes('/login')) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then(() => request(endpoint, options));
    }

    isRefreshing = true;

    try {
      const refreshResponse = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (refreshResponse.ok) {
        processQueue(null);
        return request(endpoint, options);
      } else {
        processQueue(new Error('Session expired'));
      }
    } catch (refreshErr) {
      processQueue(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      response.statusText ||
      'An unexpected error occurred';
    throw new ApiError(errorMessage, response.status, data);
  }

  return data;
}

export default request;
