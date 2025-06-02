# {{projectName}}

Express.js REST API with MongoDB, JWT authentication, and best practices.

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

## Features

- 🔐 JWT Authentication
- 📝 Request validation with Joi
- 🗄️ MongoDB with Mongoose
- 🔒 Security with Helmet
- ⚡ Rate limiting
- 📊 Logging with Winston
- 🧪 Testing with Jest

## API Endpoints

### Authentication
- POST /api/auth/register - Register new user
- POST /api/auth/login - Login user

### Users
- GET /api/users - Get all users (protected)
- GET /api/users/:id - Get user by ID (protected)

## Environment Variables

See `.env.example` for required environment variables.

## Testing

```bash
npm test
```
