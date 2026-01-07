import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080",
});

// 🔐 Attach token to EVERY request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// 🚨 Handle 401 errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login"; // Force redirect
    }
    return Promise.reject(error);
  }
);

export default api;
