# Ustaad — Frontend

React 19 + Vite + Tailwind CSS v4 + React Router + Redux Toolkit + Axios.

```bash
npm install
npm run dev     # http://localhost:5173, /api is proxied to http://localhost:5001
npm run build
```

- Set `VITE_PROXY_TARGET` to proxy to another API port in development (e.g. demo mode on 5051).
- Set `VITE_API_URL` (e.g. `https://your-api.onrender.com/api`) when the API is on another domain in production.

See the main [README](../README.md) for features and the API.
