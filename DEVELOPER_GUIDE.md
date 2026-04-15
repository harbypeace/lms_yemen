# Developer Guide: Integrating Your Custom Lesson Player

This guide explains how to integrate your existing lesson player components and data with this Adaptive Learning Platform, or how to use this platform as a template for your existing repository.

## Architecture Overview

This platform is built with:
*   **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion, Lucide Icons.
*   **Backend/Database**: Supabase (PostgreSQL), Row Level Security (RLS).
*   **Core Features**: Multi-tenant architecture (Schools), Role-based access (Super Admin, School Admin, Teacher, Parent, Student), Adaptive Slide Engine, Quizzes, Notes, and Gamification.

---

## Option A: Using this project as a template (Recommended)

If you want to keep the powerful backend, auth, and adaptive engine we've built here, and simply drop your custom UI/Player into it, follow these steps:

### 1. Where to put your components
Drop your custom React components into the `/src/components/` directory. If you have a complex player, you might want to create a dedicated folder like `/src/components/player/`.

### 2. Replacing the Default Lesson Player
Currently, lessons are rendered in the `CourseViewer.tsx` component. 

To use your custom player:
1. Open `/src/components/CourseViewer.tsx`.
2. Locate the `activeTab === 'content'` section (around line 300).
3. Replace the default mapping of `lesson_blocks` with your custom component:

```tsx
// Example Integration in CourseViewer.tsx
import { MyCustomPlayer } from './player/MyCustomPlayer';

// Inside the render block:
{activeTab === 'content' && (
  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
    {/* Pass the selected lesson data to your player */}
    <MyCustomPlayer 
      lessonId={selectedLesson.id} 
      lessonData={selectedLesson.content_json} // Or however your data is structured
      onComplete={() => handleLessonComplete(selectedLesson.id)}
    />
  </div>
)}
```

### 3. Adapting the Database Schema
Currently, lesson content is stored in the `lesson_blocks` table. If your custom player uses a specific JSON structure, you have two choices:

**Choice 1: Use the existing `content_json` column**
You can store your entire custom JSON payload inside the `content_json` column of the `lesson_blocks` table.

**Choice 2: Modify the Database Schema**
If you need a different table structure, you can create a new migration file in `/supabase/migrations/`:
1. Create a new file, e.g., `20240402008000_custom_player_schema.sql`.
2. Write your SQL to alter the `lessons` table or create a new `custom_lesson_data` table.
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
3. The schema includes tables for `tenants`, `profiles`, `courses`, `lessons`, `quizzes`, `notes`, and `adaptive_branching_rules`.

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
5.  **Lesson Blocks (`lesson_blocks`)**: The actual content of the lesson. *This is what you will likely replace with your custom JSON data.*
6.  **Quizzes (`quizzes`)**: Polymorphic. Can be attached to a Course, Module, or Lesson via `target_id` and `target_type`.

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
