// Re-export skeletons used on the NCERT demo path (lesson-plan, community).
// Kept thin so `import { LessonPlanLoadingOverlay } from "@/components/skeletons"`
// works without callers having to know which file each component lives in.
export {
  RotatingProgressHint,
  LessonPlanResultSkeleton,
  LessonPlanLoadingOverlay,
  LessonPlanFormSkeleton,
} from "./lesson-plan-loading";
export { CommunityFeedSkeleton } from "./community-feed-skeleton";
