# Testing and Modification Guide

This document serves as a comprehensive guide for testing the application's core functionality, validating different user flows, and generating new modifications or features for the Adaptive Learning Platform.

## Table of Contents
1. [Testing the Application](#1-testing-the-application)
2. [Modifying the Application](#2-modifying-the-application)
3. [Component Architecture](#3-component-architecture)
4. [Database & Backend Details](#4-database--backend-details)

---

## 1. Testing the Application

### 1.1 Initial Setup & Validating the Environment
Before testing, make sure your environment is properly configured.
1. **Environment Variables**: Verify that your `.env` contains:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Needed for backend admin tasks)
   - `GEMINI_API_KEY` (Needed for AI Course generation feature)
2. **Database Migrations**: Run the migrations to get the most up-to-date schema:
   ```bash
   npx tsx run_migrations.js
   ```
3. **Starting the Application**: Run the development server:
   ```bash
   npm run dev
   ```

### 1.2 Testing Roles & Permissions
The system relies on a multi-tenant (Schools) architecture using Row Level Security (RLS). You should test these different authentication states:
- **Super Admin**: Has access to all tenants. Can invite School Admins, create new schools, and view global analytics.
- **School Admin**: Can manage a specific school (tenant). They can invite teachers, manage students, view the school's billing, and create custom activities.
- **Teacher**: Can create courses, sub-courses, manage quizzes, view the progress of students in their specific classes.
- **Student**: Can only view enrolled courses, complete activities, earn XP/Badges/Gems, and view their progression/gamification stats.
- **Parent**: Can view connected children's profiles to monitor their progress.

**Test Flow for Roles**:
1. Login with an existing user.
2. In the DB (`memberships` table), manually assign your user the `super_admin` role in the `general` tenant to establish baseline admin access.
3. Use the Dashboard to simulate creating a School, inviting users, and defining courses.

### 1.3 Testing Specific Features
- **AI Course Generation**:
  1. Login as a Teacher or Admin.
  2. Navigate to "Courses" or "My Courses".
  3. Click "AI Architect" and input a topic (e.g., "Intro to Physics").
  4. Watch the progress bar as the frontend hits Gemini and constructs modules, lessons, and multi-media activities.
- **Gamification Mechanics**:
  1. Login as a Student.
  2. Complete an activity inside a lesson.
  3. Verify that XP increases, hearts and gems are updated, and check the "Leaderboard" tab for progress.
- **Adaptive Engine**:
  1. Complete a quiz to test out the adaptive branching engine.
  2. If the score is low, verify that you are redirected to remedial modules depending on the rules present in the `adaptive_branching_rules` table.

---

## 2. Modifying the Application

### 2.1 Generating a New Frontend Feature
To build a new feature (e.g., an "Assignments" tab):
1. **Create the Component**: Create `src/components/Assignments.tsx` covering the UI logic.
2. **Add to Router**: In `src/pages/Dashboard.tsx`, import your new component. Locate the sidebar mapping and add your new navigation tab. Set the `<Route />` definition for your new path.
3. **Tailwind & Styling**: Use `clsx` and `tailwind-merge` (`cn` utility in `src/lib/utils.ts`) alongside Tailwind classes. Avoid writing raw CSS unless overriding native elements.

### 2.2 Adding an API Endpoint
Since the backend uses an Express server (`server.ts`):
1. Locate `server.ts`.
2. Define a new endpoint using the `authenticateUser` middleware where necessary:
   ```typescript
   app.get('/api/assignments', authenticateUser, async (req, res) => {
     // Your custom server logic here
     // Access the verified user from req.user
   });
   ```
3. Restart the dev server to reload the backend paths.

### 2.3 Creating Database Modifications (Migrations)
If you need to store new data (e.g., an `assignments` table), follow the migration strategy:
1. **Create Migration File**: Make a new file inside `/supabase/migrations/` (format: `YYYYMMDDHHMMSS_feature_name.sql`).
2. **Define SQL & RLS**:
   ```sql
   CREATE TABLE assignments (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       tenant_id uuid REFERENCES tenants(id),
       title text NOT NULL
   );
   ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
   -- Important: define the policies
   ```
3. **Run Migration Scripts**:
   ```bash
   npx tsx run_migrations.js
   ```

---

## 3. Component Architecture

The `src/` directory contains standard Vite+React files. Note the following patterns:
- **`Dashboard.tsx`**: The main hub controlling Sidebars and Routing wrappers.
- **`CourseViewer.tsx`**: Controls the multi-step lesson structure.
- **`LearningContent.tsx`**: Renders dynamic activities (from simple HTML to Videos and Quizzes). Look here if you plan to introduce new activity types like an 'interactive diagram' or 'file upload'.
- **`services/`**: Houses independent logic models such as:
  - `adaptiveEngine.ts` (Learning algorithm logic).
  - `geminiService.ts` (Direct AI API integrations).

## 4. Database & Backend Details

- **Supabase Edge vs Server Logic**: The application uses the Express backend `server.ts` connected via the Supabase Admin API key. Use `server.ts` for actions bypassing Row Level Security (RLS) under strictly validated conditions (like inviting users or checking system statuses). Direct client-side connections should always rely heavily on active Sessions & RLS.
- **Authentication Context**: `src/context/AuthContext.tsx` holds user session details, along with roles arrays (`memberships`) and specific `tenant_id` context. Always use `const { activeTenant, user } = useAuth();` to pass context around correctly.
