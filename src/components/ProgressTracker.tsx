import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BookOpen, CheckCircle, Clock, Trophy, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface CourseProgress {
  course_id: string;
  course_title: string;
  total_lessons: number;
  completed_lessons: number;
  average_score: number | null;
}

export const ProgressTracker: React.FC = () => {
  const { user, activeTenant } = useAuth();
  const [progressData, setProgressData] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && activeTenant) {
      fetchProgress();
    }
  }, [user, activeTenant]);

  const fetchProgress = async () => {
    setLoading(true);
    try {
      // 1. Get all enrollments for the student in this tenant
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('course_id, courses(title)')
        .eq('user_id', user?.id)
        .eq('tenant_id', activeTenant?.id)
        .eq('role', 'student');

      if (enrollError) throw enrollError;

      const courseProgress: CourseProgress[] = [];

      for (const enrollment of enrollments || []) {
        const courseId = enrollment.course_id;
        const courseTitle = Array.isArray(enrollment.courses) 
          ? enrollment.courses[0]?.title 
          : (enrollment.courses as any)?.title || 'Unknown Course';

        // 2. Get total lessons for this course
        const { data: lessons, error: lessonsError } = await supabase
          .from('lessons')
          .select('id, modules!inner(course_id)')
          .eq('modules.course_id', courseId);

        if (lessonsError) throw lessonsError;

        const totalLessons = lessons?.length || 0;

        // 3. Get completed lessons for this student in this course
        const lessonIds = lessons?.map(l => l.id) || [];
        if (lessonIds.length > 0) {
          const { data: progress, error: progressError } = await supabase
            .from('progress')
            .select('completed, score')
            .eq('user_id', user?.id)
            .in('lesson_id', lessonIds)
            .eq('completed', true);

          if (progressError) throw progressError;

          const completedLessons = progress?.length || 0;
          const scores = progress?.filter(p => p.score !== null).map(p => p.score as number) || [];
          const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

          courseProgress.push({
            course_id: courseId,
            course_title: courseTitle,
            total_lessons: totalLessons,
            completed_lessons: completedLessons,
            average_score: averageScore
          });
        } else {
          courseProgress.push({
            course_id: courseId,
            course_title: courseTitle,
            total_lessons: 0,
            completed_lessons: 0,
            average_score: null
          });
        }
      }

      setProgressData(courseProgress);
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">My Learning Progress</h2>
      </div>

      {progressData.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900">No courses yet</h3>
          <p className="text-slate-500 mt-2">Enroll in a course to start tracking your progress.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {progressData.map((course, index) => {
            const percentage = course.total_lessons > 0 
              ? Math.round((course.completed_lessons / course.total_lessons) * 100) 
              : 0;

            return (
              <motion.div
                key={course.course_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{course.course_title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        {course.total_lessons} Lessons
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        {course.completed_lessons} Completed
                      </span>
                      {course.average_score !== null && (
                        <span className="flex items-center gap-1">
                          <Trophy className="w-4 h-4 text-amber-500" />
                          Avg. Score: {Math.round(course.average_score)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-indigo-600">{percentage}%</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Progress</div>
                  </div>
                </div>

                <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full shadow-[0_0_12px_rgba(79,70,229,0.4)]"
                  />
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Clock className="w-4 h-4" />
                    <span>Last active: Just now</span>
                  </div>
                  <button className="text-indigo-600 font-bold text-sm hover:underline">
                    Continue Learning →
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
