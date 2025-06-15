# Bill Checker Frontend

## Environment Configuration

The frontend uses a single environment variable for the backend API URL. To set up your environment:

1. Create a `.env` file in the frontend directory
2. Add the following variable:

```env
VITE_API_URL=https://hand-bill-checker.onrender.com
```

For local development, you can set it to your local backend:
```env
VITE_API_URL=http://localhost:8080
```

### Deployment on Netlify

When deploying to Netlify, add the environment variable in the Netlify dashboard:
1. Go to Site settings > Build & deploy > Environment variables
2. Add `VITE_API_URL` with value `https://hand-bill-checker.onrender.com`

Note: The application will use the default API URL (https://hand-bill-checker.onrender.com) if no environment variable is set.

### Environment Variables

- `VITE_API_URL`: Base URL for the backend API

Note: All environment variables must be prefixed with `VITE_` to be exposed to the frontend code. 