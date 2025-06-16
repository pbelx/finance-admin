import axios from 'axios';

export default function ({ app }, inject) {
  // Attempt to get the token from localStorage
  // Note: localStorage is not available on the server-side during SSR.
  // If SSR is used and auth is critical on first load, token handling might need
  // to be more sophisticated (e.g., using cookies or Nuxt server-side auth).
  // For client-side rendering or SPA mode, this is generally fine.
  let token = null;
  if (process.client) { // Ensure localStorage is only accessed on the client-side
    token = localStorage.getItem('token');
  }

  // Create an Axios instance
  const api = axios.create({
    baseURL: 'https://finance.flflstore.com/api', // Or your primary API base URL
    // baseURL: process.env.API_URL || 'http://localhost:3001/api', // Example using env variable
    headers: {
      'Content-Type': 'application/json',
    }
  });

  // Set Authorization header if token exists
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    // Optional: Handle cases where token is not found, e.g., redirect to login
    // This depends on your app's auth flow. For now, we just log a warning if no token.
    if (process.client) { // Only log warning on client-side if no token
        console.warn('Authorization token not found in localStorage. API calls may fail if authentication is required.');
    }
  }

  // Optional: Add request interceptor to dynamically set token if it can change during app lifecycle
  // api.interceptors.request.use(config => {
  //   if (process.client) {
  //     const currentToken = localStorage.getItem('token');
  //     if (currentToken) {
  //       config.headers.Authorization = `Bearer ${currentToken}`;
  //     }
  //   }
  //   return config;
  // }, error => {
  //   return Promise.reject(error);
  // });

  // Inject the configured Axios instance into the Nuxt context as $api
  inject('api', api);
}
