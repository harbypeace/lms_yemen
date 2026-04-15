# Developer Guide: Integrating Your Custom Lesson Player

This guide explains how to integrate your existing lesson player components and data with this Adaptive Learning Platform, or how to use this platform as a template for your existing repository.

## Architecture Overview

This platform is built with:
*   **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion, Lucide Icons.
*   **Backend/Database**: Supabase (PostgreSQL), Row Level Security (RLS).
*   **Core Features**: Multi-tenant architecture (Schools), Role-based access (Super Admin, School Admin, Teacher, Parent, Student), Adaptive Slide Engine, Quizzes, Notes, Activities, and Gamification.

---

## Option A: Using this project as a template (Recommended)

If you want to keep the powerful backend, auth, and adaptive engine we've built here, and simply drop your custom UI/Player into it, follow these steps:

### 1. Where to put your components
Drop your custom React components into the `/src/components/` directory. If you have a complex player, you might want to create a dedicated folder like `/src/components/player/`.

### 2. Replacing the Default Lesson Content Renderer
Currently, lesson activities are rendered in the `LessonContent.tsx` component, which is called by `CourseViewer.tsx`. 

To use your custom player:
1. Open `/src/components/LessonContent.tsx`.
2. You can either add a new `activity_type` to the switch/mapping logic or replace the entire rendering loop.

```tsx
// Example Integration in LessonContent.tsx
import { MyCustomPlayer } from './player/MyCustomPlayer';

// Inside the activities.map loop:
{activity.activity_type === 'custom_type' && (
  <MyCustomPlayer 
    activityId={activity.activity_id} 
    content={activity.content} 
    onComplete={(score) => markActivityComplete(activity.activity_id, score)}
  />
)}
```

### 3. Adapting the Database Schema
Currently, lesson content is stored in the `activities` table. If your custom player uses a specific JSON structure, you have two choices:

**Choice 1: Use the existing `content` column**
You can store your entire custom JSON payload inside the `content` (JSONB) column of the `activities` table.

**Choice 2: Modify the Database Schema**
If you need a different table structure, you can create a new migration file in `/supabase/migrations/`:
1. Create a new file, e.g., `20240402013000_custom_player_schema.sql`.
2. Write your SQL to alter the `activities` table or create a new `custom_activity_data` table.
3. Run the migration using `npx tsx run_migrations.js`.

---

## Option B: Adding this platform's features to your existing repo

If you already have a large, established repository and just want to extract the Adaptive Engine, Auth, and Database schema from this project:

### 1. Export this project
1. In AI Studio, click the **Settings** icon (top right).
2. Select **Export to ZIP** or **Export to GitHub**.

### 2. Copy the Database Schema (Supabase)
The most valuable part of this platform is the PostgreSQL schema and RLS policies.
1. Copy the entire `/supabase/migrations/` folder into your repository.
2. If you use Supabase CLI, you can run `supabase db push` to apply these to your database.
3. The schema includes tables for `tenants`, `profiles`, `courses`, `lessons`, `activities`, `quizzes`, `notes`, and `adaptive_branching_rules`.

### 3. Copy the Core Services
Copy the following files into your project's `src/` directory:
*   `/src/services/adaptiveEngine.ts`: The logic that calculates the next lesson based on scores and preferences.
*   `/src/lib/supabase.ts`: The Supabase client initialization.
*   `/src/context/AuthContext.tsx`: The authentication and role-management state.

### 4. Install Required Dependencies
Ensure your `package.json` has the necessary packages:
```bash
npm install @supabase/supabase-js lucide-react motion
```

### 5. Environment Variables
Copy the `.env.example` variables to your local `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Understanding the Data Hierarchy

When mapping your data to this system, keep this hierarchy in mind:

1.  **Tenant (`tenants`)**: A school or organization.
2.  **Course (`courses`)**: Belongs to a tenant.
3.  **Module (`modules`)**: Belongs to a course (e.g., "Chapter 1").
4.  **Lesson (`lessons`)**: Belongs to a module. This is where the Adaptive Engine routes users.
5.  **Activities (`activities`)**: The actual content of the lesson. Replaces the old `lesson_blocks`. Supports multiple types (video, quiz, html, etc.) and granular tracking via `activity_progress`.
6.  **Quizzes (`quizzes`)**: Now specifically linked to lessons via `lesson_id`. Contains `quiz_questions` and records `quiz_submissions`.
7.  **User Progress (`user_progress`)**: Tracks lesson completion status, scores, and XP.
8.  **User Stats (`user_stats`)**: Global gamification data (XP, Level, Streaks, Hearts, Gems).

## The Adaptive Engine API

If you are building your own UI, you can call the Adaptive Engine directly to figure out where the user should go next:

```typescript
import { adaptiveEngine } from './services/adaptiveEngine';

// When a user finishes a lesson or quiz:
const nextLessonId = await adaptiveEngine.getNextLesson(
  userId, 
  currentLessonId, 
  tenantId
);

if (nextLessonId) {
  // Route user to the specific branched lesson
  navigateToLesson(nextLessonId);
} else {
  // Fallback to standard linear progression
  goToNextChronologicalLesson();
}
```
