-- Migration: Notifications for Progress and Course Completion

-- Trigger function to notify parents when a student completes a lesson
CREATE OR REPLACE FUNCTION notify_parents_on_lesson_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_id UUID;
  v_student_name TEXT;
  v_lesson_title TEXT;
  v_course_title TEXT;
  v_tenant_id UUID;
BEGIN
  -- Only trigger if status changed to completed
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status != 'completed') THEN
    
    -- Get student name
    SELECT full_name INTO v_student_name FROM profiles WHERE id = NEW.user_id;
    
    -- Get lesson and course details
    SELECT l.title, c.title, c.tenant_id INTO v_lesson_title, v_course_title, v_tenant_id
    FROM lessons l
    JOIN modules m ON l.module_id = m.id
    JOIN courses c ON m.course_id = c.id
    WHERE l.id = NEW.lesson_id;

    -- Find all parents for this student
    FOR v_parent_id IN 
      SELECT parent_id FROM parent_student WHERE student_id = NEW.user_id
    LOOP
      -- Insert notification
      PERFORM create_notification(
        v_tenant_id,
        v_parent_id,
        'Lesson Completed',
        v_student_name || ' has completed the lesson "' || v_lesson_title || '" in course "' || v_course_title || '".',
        'success',
        NULL,
        'parent_alert'
      );
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user_progress table
DROP TRIGGER IF EXISTS on_lesson_completion_notify_parents ON user_progress;
CREATE TRIGGER on_lesson_completion_notify_parents
  AFTER INSERT OR UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION notify_parents_on_lesson_completion();
