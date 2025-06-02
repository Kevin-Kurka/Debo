# {{projectName}}

A full-stack Next.js 14 application with TypeScript, Tailwind CSS, and Prisma.

## Getting Started

```bash
npm install
npm run dev
```

## Features

- 🚀 Next.js 14 with App Router
- 📝 TypeScript for type safety
- 🎨 Tailwind CSS for styling
- 🗄️ Prisma for database ORM
- 🔐 Environment variables support
- 📱 Responsive design

## Database Setup

1. Copy `.env.example` to `.env`
2. Update DATABASE_URL in `.env`
3. Run `npx prisma migrate dev`

## Project Structure

```
app/              # App router pages and layouts
components/       # Reusable components
lib/             # Utility functions and libraries
prisma/          # Database schema and migrations
public/          # Static assets
```
