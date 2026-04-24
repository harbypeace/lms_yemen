# Adaptive Learning Platform

Welcome to the Adaptive Learning Platform repository. This is a multi-tenant React application built with an Express backend, using Supabase (PostgreSQL) and the Gemini API to deliver AI-generated courses, gamification mechanics, and adaptive learning experiences.

## Technical Stack
- **Frontend**: React 19, Vite, Tailwind CSS
- **Backend**: Express (running via `server.ts` with vite middleware)
- **Database**: Supabase (PostgreSQL with RLS)
- **AI**: Google Gemini API integration

## Quick Start
1. Ensure your `.env` is configured with Supabase and Gemini keys (refer to `.env.example`).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run migrations to initialize your database state:
   ```bash
   npx tsx run_migrations.js
   ```
4. Start the application:
   ```bash
   npm run dev
   ```

## Documentation Hub

- **[Installation & Tech Stack](./README.md)**: Getting started, migrations, and environment setup.
- **[Pages & Features Breakdown](./PAGES_AND_FEATURES_DOC.md)**: A systematic guide to every module (AI, Gamification, Admin, Student/Parent views).
- **[Testing & Modification Guide](./TESTING_AND_MODIFICATION_GUIDE.md)**: How to test roles, run learning paths, and modify the source code.
- **[Developer Component Guide](./DEVELOPER_GUIDE.md)**: Low-level architecture details for extending activity types.
