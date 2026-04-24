# Detailed Pages and Features Documentation

This document provides a systematic breakdown of every page and feature within the Nexus Adaptive Learning Platform.

---

## 1. Authentication and Onboarding

### 1.1 Auth Hub
- **Location**: `src/pages/AuthPage.tsx`
- **Features**: 
  - Login/Register toggle.
  - Multi-tenant aware: Users can belong to multiple schools.
  - Grade-based registration for students.
  - Role-based redirection after login.

### 1.2 Student Onboarding
- **Location**: `src/components/StudentOnboarding.tsx`
- **Features**:
  - Interactive walkthrough for new students.
  - Avatar selection and profile setup.
  - Initial assessment/interest mapping (optional).

---

## 2. Learning Experience

### 2.1 Course Directory (`/courses`)
- **Location**: `src/components/CourseList.tsx`
- **Features**:
  - Browse available courses.
  - Search and filter by category/tag.
  - Enroll in courses.
  - **AI Architect Button**: Triggers AI generation for admins/teachers.

### 2.2 Course Player (`/courses/:slug`)
- **Location**: `src/components/CourseViewer.tsx`
- **Features**:
  - Multi-module and multi-lesson navigation.
  - Progress persistence.
  - **LearningContent.tsx**: Dynamic activity renderer.
    - **HTML Content**: Rich text and diagrams.
    - **Video**: Embedded YouTube/Vimeo support.
    - **Quiz**: Integrated assessment engine with scoring.

### 2.3 Adaptive Engine
- **Service**: `src/services/adaptiveEngine.ts`
- **Features**:
  - Analyzes student performance in real-time.
  - **Branching Logic**: If a student fails a quiz, the engine suggests/forces a remedial module or a different learning path based on pre-defined teacher rules.

---

## 3. AI Capabilities

### 3.1 AI Course Generator (AI Architect)
- **Component**: `src/components/AICourseGenerator.tsx`
- **Service**: `src/services/geminiService.ts`
- **Features**:
  - User enters a topic (e.g., "Advanced Algebra").
  - Google Gemini generates a full curriculum: Modules -> Lessons -> Actual HTML Content & Quizzes.
  - One-click deployment to the database.

---

## 4. Gamification and Social Features

### 4.1 Gamification Engine
- **Components**: `GamificationWidget.tsx`, `GamificationOverlay.tsx`
- **Features**:
  - **XP & Levels**: Earned via activity completion.
  - **Hearts (Lives)**: Depleted on quiz errors, regrow over time or via Gems.
  - **Gems (Currency)**: Earned for streaks and achievements.
  - **Badges**: Milestone-based rewards.

### 4.2 Social Hub (`/social`)
- **Component**: `src/components/SocialHub.tsx`
- **Features**:
  - School announcements and news.
  - Interactive student social wall.
  - Discussion forums for specific lessons.

### 4.3 Leaderboards (`/leaderboard`)
- **Components**: `GlobalLeaderboard.tsx`, `CourseLeaderboard.tsx`
- **Features**:
  - Monthly and all-time rankings.
  - League system (Bronze, Silver, Gold).

---

## 5. Management & Administration

### 5.1 School Management (`/schools`)
- **Component**: `src/components/SchoolManagement.tsx`
- **Role**: Super Admin Only.
- **Features**:
  - Create new tenants (Schools).
  - Manage school status (Active/Pending).
  - Subscription tier assignments.

### 5.2 User Management (`/user-management`)
- **Component**: `src/components/UserManagement.tsx`
- **Role**: Admin / Teacher.
- **Features**:
  - Invite new members.
  - Role assignment (Teacher, Student, School Admin).
  - Student performance overview.

### 5.3 Bulk Import (`/bulk-import`)
- **Component**: `src/components/BulkImport.tsx`
- **Features**:
  - Import students/users via CSV/JSON.
  - Batch course creation.

### 5.4 School Settings (`/school-settings`)
- **Component**: `src/components/SchoolSettings.tsx`
- **Features**:
  - Rename school.
  - Customize URL slug.
  - Branding configuration.

---

## 6. Parent & Guardian Tools

### 6.1 Parent Dashboard (`/children`)
- **Component**: `src/components/ParentDashboard.tsx` & `ManagedUsers.tsx`
- **Features**:
  - Linked student accounts.
  - Real-time progress monitoring for children.
  - Subscription management for children's accounts.

---

## 7. Integrations & Technical Tools

### 7.1 Integration Manager (`/integrations`)
- **Component**: `src/components/IntegrationManager.tsx`
- **Features**:
  - Webhook configurations.
  - Sync triggers for external LMS.
  - **xAPI / LRS Support**: Service at `src/services/xapiService.ts`.

### 7.2 Permissions Debugger
- **Component**: `src/components/PermissionsDebugger.tsx`
- **Features**:
  - Development tool to see exactly what role permissions are active for the current user in the current tenant.
