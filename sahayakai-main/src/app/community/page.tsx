"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Card, CardContent, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FileTypeIcon, type FileType } from '@/components/file-type-icon';
import { LanguageSelector } from '@/components/language-selector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getLibraryResources, getFollowingIdsAction,
  likeResourceAction, saveResourceToLibraryAction,
} from '@/app/actions/community';
import {
  Loader2, Search, Library, Flame, UserCheck,
  School, BookOpen, Bookmark, ArrowRight, Heart, MessageCircle,
} from 'lucide-react';
import { TeacherSuggestions } from '@/components/teacher-suggestions';
import { CreatePostDialog } from '@/components/community/create-post-dialog';
import { TeacherDirectory } from '@/components/community/teacher-directory';
import { CommunityChat } from '@/components/community/community-chat';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

type Resource = {
  id: string;
  title: string;
  type: FileType;
  author: string;
  authorId: string;
  likes: number;
  language: string;
  imageUrl?: string;
  gradeLevel?: string;
  subject?: string;
};

// ── Resource-type config ─────────────────────────────────────────────────────
// Each type gets a coloured top border + matching icon bg so teachers can
// recognise the resource kind before reading the title — important for
// low-literacy tech users scanning on a small phone screen.

const TYPE_CONFIG: Record<string, {
  border: string; bg: string; text: string; label: string; route: string;
}> = {
  'lesson-plan':        { border: 'border-t-orange-400',  bg: 'bg-orange-50',  text: 'text-orange-600',  label: 'Lesson Plan',  route: 'lesson-planner' },
  'quiz':               { border: 'border-t-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-600',    label: 'Quiz',         route: 'quiz-generator' },
  'worksheet':          { border: 'border-t-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Worksheet',    route: 'worksheet-wizard' },
  'rubric':             { border: 'border-t-violet-400',  bg: 'bg-violet-50',  text: 'text-violet-600',  label: 'Rubric',       route: 'rubric-generator' },
  'image':              { border: 'border-t-pink-400',    bg: 'bg-pink-50',    text: 'text-pink-600',    label: 'Visual Aid',   route: 'visual-aid-designer' },
  'visual-aid':         { border: 'border-t-pink-400',    bg: 'bg-pink-50',    text: 'text-pink-600',    label: 'Visual Aid',   route: 'visual-aid-designer' },
  'virtual-field-trip': { border: 'border-t-teal-400',   bg: 'bg-teal-50',    text: 'text-teal-600',    label: 'Field Trip',   route: 'virtual-field-trip' },
  'teacher-training':   { border: 'border-t-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-600',   label: 'Training',     route: 'teacher-training' },
};

const cfg = (type: string) =>
  TYPE_CONFIG[type] ?? { border: 'border-t-slate-300', bg: 'bg-slate-50', text: 'text-slate-500', label: 'Resource', route: 'instant-answer' };

// ── Localisation helpers ─────────────────────────────────────────────────────

const LANG_SHORT: Record<string, string> = {
  en: 'EN', hi: 'HI', bn: 'BN', te: 'TE', mr: 'MR',
  ta: 'TA', gu: 'GU', kn: 'KN', pa: 'PA', ml: 'ML', or: 'OR',
};

// ── Type filter chips ────────────────────────────────────────────────────────

const TYPE_CHIPS = [
  { value: 'all',               label: 'All' },
  { value: 'lesson-plan',       label: 'Lessons' },
  { value: 'quiz',              label: 'Quizzes' },
  { value: 'worksheet',         label: 'Worksheets' },
  { value: 'rubric',            label: 'Rubrics' },
  { value: 'visual-aid',        label: 'Visual Aids' },
  { value: 'virtual-field-trip',label: 'Field Trips' },
];

// ── Skeleton card ────────────────────────────────────────────────────────────

const CardSkeleton = () => (
  <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden animate-pulse">
    <div className="h-1.5 bg-slate-200 w-full" />
    <div className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-slate-100 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-slate-100 rounded w-4/5" />
          <div className="h-3 bg-slate-100 rounded w-2/5" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-slate-100 rounded-full" />
        <div className="h-5 w-12 bg-slate-100 rounded-full" />
      </div>
    </div>
    <div className="px-4 py-3 border-t border-slate-50 flex justify-between">
      <div className="h-6 w-10 bg-slate-100 rounded" />
      <div className="flex gap-2">
        <div className="h-7 w-14 bg-slate-100 rounded-lg" />
        <div className="h-7 w-16 bg-orange-100 rounded-lg" />
      </div>
    </div>
  </div>
);

// ── Resource card ────────────────────────────────────────────────────────────

const ResourceCard = ({
  resource,
  isLiked,
  isSaved,
  onLike,
  onSave,
}: {
  resource: Resource;
  isLiked: boolean;
  isSaved: boolean;
  onLike: (r: Resource) => void;
  onSave: (r: Resource) => void;
}) => {
  const router = useRouter();
  const c = cfg(resource.type);

  const handleUseThis = () => {
    const params = new URLSearchParams();
    if (resource.title)      params.set('topic', resource.title);
    if (resource.gradeLevel) params.set('gradeLevel', resource.gradeLevel);
    if (resource.subject)    params.set('subject', resource.subject);
    if (resource.language)   params.set('language', resource.language);
    router.push(`/${c.route}?${params.toString()}`);
  };

  // Initials for avatar fallback — handles single-word names gracefully
  const initials = resource.author
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <Card
      className={cn(
        'flex flex-col group transition-all duration-300',
        'hover:shadow-lg hover:-translate-y-0.5',
        'border border-slate-100 border-t-4 rounded-2xl bg-white overflow-hidden',
        c.border,
      )}
    >
      {/* Header */}
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start gap-3">
          {/* Type icon with matching bg */}
          <div className={cn('p-2 rounded-xl shrink-0 transition-all duration-200', c.bg, 'group-hover:scale-105')}>
            <FileTypeIcon type={resource.type} className={cn('h-5 w-5', c.text)} />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            {/* Title — clamp to 2 lines, links colour on hover */}
            <CardTitle className="text-sm font-bold leading-snug text-slate-900 group-hover:text-primary transition-colors line-clamp-2 font-headline">
              {resource.title}
            </CardTitle>

            {/* Author row */}
            <div className="flex items-center gap-1.5">
              <Avatar className={cn('h-5 w-5 ring-1 ring-white shadow-sm shrink-0')}>
                <AvatarImage src={undefined} />
                <AvatarFallback className={cn('text-[9px] font-bold', c.bg, c.text)}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold text-slate-500 truncate">
                {resource.author}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Body: image preview OR metadata tags */}
      <CardContent className="px-4 py-2 flex-grow">
        {resource.imageUrl ? (
          <div className="relative h-28 w-full overflow-hidden rounded-xl border border-slate-100 transition-all group-hover:border-slate-200">
            <Image
              src={resource.imageUrl}
              alt={resource.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        ) : (
          /* Grade / subject / type chips replace the meaningless placeholder quote */
          <div className="flex flex-wrap gap-1.5 pt-1">
            {resource.gradeLevel && (
              <Badge className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 font-semibold border-0 rounded-full">
                {resource.gradeLevel}
              </Badge>
            )}
            {resource.subject && (
              <Badge className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 font-semibold border-0 rounded-full">
                {resource.subject}
              </Badge>
            )}
            <Badge className={cn('text-[10px] px-2 py-0.5 font-semibold border-0 rounded-full', c.bg, c.text)}>
              {c.label}
            </Badge>
          </div>
        )}
      </CardContent>

      {/* Footer */}
      <CardFooter className="px-4 py-2.5 border-t border-slate-50 bg-slate-50/40 flex justify-between items-center gap-2 mt-auto">
        {/* Language badge + like toggle */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-white border-slate-200 text-slate-500 text-[10px] font-bold px-1.5 py-0 rounded-md shrink-0"
          >
            {LANG_SHORT[resource.language] ?? resource.language?.toUpperCase() ?? 'EN'}
          </Badge>

          {/* Like button — filled heart when liked, optimistic toggle */}
          <button
            onClick={() => onLike(resource)}
            className={cn(
              'flex items-center gap-1 text-xs font-bold transition-all duration-200 rounded-lg px-1.5 py-0.5',
              isLiked
                ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-slate-400 hover:text-red-400 hover:bg-red-50',
            )}
            aria-label={isLiked ? 'Unlike this resource' : 'Like this resource'}
          >
            <Heart className={cn('h-3 w-3 transition-all', isLiked && 'fill-red-500')} />
            <span>{resource.likes + (isLiked ? 0 : 0)}</span>
          </button>
        </div>

        {/* Save + Use actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            disabled={isSaved}
            className={cn(
              'h-7 px-2 text-[11px] font-semibold rounded-lg gap-1 transition-all',
              isSaved
                ? 'text-primary bg-primary/10 cursor-default'
                : 'text-slate-500 hover:text-primary hover:bg-primary/5',
            )}
            onClick={() => !isSaved && onSave(resource)}
          >
            <Bookmark className={cn('h-3 w-3', isSaved && 'fill-primary')} />
            {isSaved ? 'Saved' : 'Save'}
          </Button>

          {/* "Use This" — routes to the matching tool with topic pre-filled */}
          <Button
            size="sm"
            className="h-7 px-2.5 text-[11px] font-bold rounded-lg gap-1 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-none"
            onClick={handleUseThis}
          >
            Use
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

// ── Empty state ──────────────────────────────────────────────────────────────

const EMPTY_COPY: Record<string, { title: string; desc: string }> = {
  trending: {
    title: 'The Community is Growing',
    desc: 'Be the first to share a lesson plan or quiz. Your contribution helps teachers across Bharat.',
  },
  following: {
    title: 'Grow Your Network',
    desc: 'Follow fellow teachers to see their latest resources here. Connect with educators from your region.',
  },
  'my-content': {
    title: 'Share Your First Resource',
    desc: "You haven't shared anything yet. Share your best work and inspire teachers across India.",
  },
  teachers: {
    title: 'No Teachers Found',
    desc: 'Try adjusting your filters to find teachers from your region or subject area.',
  },
};

const EmptyState = ({ tab, onCreatePost }: { tab: string; onCreatePost?: () => void }) => {
  const copy = EMPTY_COPY[tab] ?? EMPTY_COPY.trending;
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 mt-4">
      <div className="bg-orange-100 p-5 rounded-full">
        <Library className="h-8 w-8 text-orange-500" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <h3 className="text-base font-bold text-slate-900 font-headline">{copy.title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{copy.desc}</p>
      </div>
      <CreatePostDialog onPostCreated={onCreatePost ?? (() => {})} />
    </div>
  );
};

// ── Resource list with skeleton + load-more ───────────────────────────────────

const INITIAL_VISIBLE = 20;
const PAGE_SIZE = 20;

const ResourceList = ({
  resources,
  loading,
  tab,
  likedIds,
  savedIds,
  onLike,
  onSave,
  onCreatePost,
}: {
  resources: Resource[];
  loading: boolean;
  tab: string;
  likedIds: Set<string>;
  savedIds: Set<string>;
  onLike: (r: Resource) => void;
  onSave: (r: Resource) => void;
  onCreatePost?: () => void;
}) => {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Reset visible count when tab or filter changes
  useEffect(() => { setVisibleCount(INITIAL_VISIBLE); }, [tab, resources.length]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
        {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  if (resources.length === 0) {
    return <EmptyState tab={tab} onCreatePost={onCreatePost} />;
  }

  const visible = resources.slice(0, visibleCount);
  const hasMore = visibleCount < resources.length;
  const remaining = resources.length - visibleCount;

  return (
    <div className="space-y-4 mt-4">
      {/* Result count — helps teachers know scope of what they're browsing */}
      <p className="text-xs text-slate-400 font-semibold">
        {resources.length} resource{resources.length !== 1 ? 's' : ''} found
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {visible.map((resource) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            isLiked={likedIds.has(resource.id)}
            isSaved={savedIds.has(resource.id)}
            onLike={onLike}
            onSave={onSave}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-slate-600 border-slate-200 hover:border-primary hover:text-primary font-semibold rounded-xl px-5"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            <Loader2 className="h-3.5 w-3.5" />
            Load {Math.min(PAGE_SIZE, remaining)} more
          </Button>
        </div>
      )}
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [languageFilter, setLanguageFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchInput, setSearchInput]   = useState('');
  const [searchTerm, setSearchTerm]     = useState('');
  const [activeTab, setActiveTab] = useState<'trending' | 'following' | 'teachers' | 'my-content' | 'chat'>('trending');

  const [resources, setResources]             = useState<Resource[]>([]);
  const [filteredResources, setFiltered]      = useState<Resource[]>([]);
  const [followingIds, setFollowingIds]       = useState<string[]>([]);
  const [loading, setLoading]                 = useState(true);

  // Optimistic sets — local only, no extra DB reads on page load
  const [likedIds, setLikedIds]   = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds]   = useState<Set<string>>(new Set());

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [trendingData, followIds] = await Promise.all([
          getLibraryResources({
            language: languageFilter === 'all' ? undefined : languageFilter,
            excludeTypes: ['document'],
          }),
          user ? getFollowingIdsAction(user.uid) : Promise.resolve([]),
        ]);

        let followingResources: any[] = [];
        if (user && followIds.length > 0) {
          followingResources = await getLibraryResources({
            authorIds: followIds,
            language: languageFilter === 'all' ? undefined : languageFilter,
          });
        }

        let myResources: any[] = [];
        if (user) {
          myResources = await getLibraryResources({
            authorId: user.uid,
            language: languageFilter === 'all' ? undefined : languageFilter,
          });
        }

        const all = [...(trendingData as any[]), ...followingResources, ...myResources];

        const transformed: Resource[] = all.map((r: any) => ({
          id:         r.id,
          title:      r.title,
          type:       r.type,
          author:     r.authorName || 'Teacher',
          authorId:   r.authorId || r.userId || '',
          likes:      r.stats?.likes || 0,
          language:   r.language,
          imageUrl:   r.imageUrl,
          gradeLevel: r.gradeLevel,
          subject:    r.subject,
        }));

        // Deduplicate across fetches
        const unique = Array.from(new Map(transformed.map((r) => [r.id, r])).values());
        setResources(unique);
        setFollowingIds(followIds);
      } catch (error) {
        console.error('Error loading community resources:', error);
        toast({
          title: "Couldn't load resources",
          description: 'Please check your connection and try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [languageFilter, user]);

  // ── Client-side filtering ─────────────────────────────────────────────────
  useEffect(() => {
    const lowerSearch = searchTerm.toLowerCase();

    const filtered = resources.filter((r) => {
      const matchesSearch = !searchTerm || r.title.toLowerCase().includes(lowerSearch);
      const matchesType   = typeFilter === 'all' || r.type === typeFilter;

      if (activeTab === 'following')   return matchesSearch && matchesType && followingIds.includes(r.authorId);
      if (activeTab === 'my-content')  return matchesSearch && matchesType && !!user && r.authorId === user.uid;

      return matchesSearch && matchesType; // trending
    });

    setFiltered(filtered);
  }, [resources, searchTerm, typeFilter, activeTab, followingIds, user]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLike = async (resource: Resource) => {
    if (!user) {
      toast({ title: 'Sign in to like resources', variant: 'destructive' });
      return;
    }
    // Optimistic toggle
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(resource.id)) next.delete(resource.id);
      else next.add(resource.id);
      return next;
    });
    // Also update the like count in the local resource list
    setResources((prev) =>
      prev.map((r) =>
        r.id === resource.id
          ? { ...r, likes: r.likes + (likedIds.has(resource.id) ? -1 : 1) }
          : r,
      ),
    );
    try {
      await likeResourceAction(resource.id, user.uid);
    } catch {
      // Revert on failure
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (next.has(resource.id)) next.delete(resource.id);
        else next.add(resource.id);
        return next;
      });
      toast({ title: 'Could not update like', variant: 'destructive' });
    }
  };

  const handleSave = async (resource: Resource) => {
    if (!user) {
      toast({ title: 'Sign in to save resources', variant: 'destructive' });
      return;
    }
    // Optimistic mark
    setSavedIds((prev) => new Set(prev).add(resource.id));
    try {
      const { alreadySaved } = await saveResourceToLibraryAction(
        {
          id:         resource.id,
          title:      resource.title,
          type:       resource.type,
          authorId:   resource.authorId,
          language:   resource.language,
          gradeLevel: resource.gradeLevel,
          subject:    resource.subject,
        },
        user.uid,
      );
      toast({
        title: alreadySaved ? 'Already in your library' : 'Saved to your library',
        description: alreadySaved
          ? 'You already have this resource.'
          : `"${resource.title.slice(0, 45)}${resource.title.length > 45 ? '…' : ''}" added.`,
      });
    } catch {
      setSavedIds((prev) => { const next = new Set(prev); next.delete(resource.id); return next; });
      toast({ title: 'Could not save resource', variant: 'destructive' });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-7xl mx-auto space-y-5">

      {/* ── Header strip — warm saffron gradient, compact ────────────────── */}
      <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50/70 to-white border border-orange-100/70 shadow-sm">
        <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-orange-100 shrink-0">
              <Library className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-headline text-2xl font-bold text-slate-900 leading-tight">
                Community Library
              </h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">
                Discover and share resources with teachers across Bharat
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <CreatePostDialog onPostCreated={() => {}} />
          </div>
        </div>
      </div>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* Left: content area */}
        <div className="flex-grow min-w-0 space-y-3">

          {/* Search + language row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search lessons, quizzes, worksheets…"
                className="pl-11 h-12 bg-white border-slate-200 rounded-2xl text-sm font-medium text-slate-700 placeholder:text-slate-400 focus-visible:ring-primary/30 shadow-sm"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48 h-12">
              <LanguageSelector onValueChange={setLanguageFilter} defaultValue={languageFilter} />
            </div>
          </div>

          {/* Type filter chips — horizontal scroll on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {TYPE_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setTypeFilter(chip.value)}
                className={cn(
                  'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 whitespace-nowrap',
                  typeFilter === chip.value
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:text-primary',
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Tabs */}
          <Tabs
            defaultValue="trending"
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            className="w-full"
          >
            <TabsList className="flex w-full bg-slate-100/60 p-1 rounded-2xl h-auto border border-slate-200/60 gap-0.5">
              <TabsTrigger
                value="trending"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200 text-slate-500"
              >
                <Flame className="h-3.5 w-3.5 shrink-0" />
                <span>Trending</span>
              </TabsTrigger>

              <TabsTrigger
                value="following"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200 text-slate-500"
              >
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                <span>Following</span>
              </TabsTrigger>

              <TabsTrigger
                value="teachers"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200 text-slate-500"
              >
                <School className="h-3.5 w-3.5 shrink-0" />
                <span>Teachers</span>
              </TabsTrigger>

              <TabsTrigger
                value="my-content"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200 text-slate-500"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span>My Work</span>
              </TabsTrigger>

              <TabsTrigger
                value="chat"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200 text-slate-500"
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Chat</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trending" className="outline-none">
              <ResourceList
                resources={filteredResources}
                loading={loading}
                tab="trending"
                likedIds={likedIds}
                savedIds={savedIds}
                onLike={handleLike}
                onSave={handleSave}
              />
            </TabsContent>

            <TabsContent value="following" className="outline-none">
              <ResourceList
                resources={filteredResources}
                loading={loading}
                tab="following"
                likedIds={likedIds}
                savedIds={savedIds}
                onLike={handleLike}
                onSave={handleSave}
              />
            </TabsContent>

            <TabsContent value="teachers" className="outline-none">
              <div className="mt-4">
                <TeacherDirectory />
              </div>
            </TabsContent>

            <TabsContent value="my-content" className="outline-none">
              <ResourceList
                resources={filteredResources}
                loading={loading}
                tab="my-content"
                likedIds={likedIds}
                savedIds={savedIds}
                onLike={handleLike}
                onSave={handleSave}
              />
            </TabsContent>

            <TabsContent value="chat" className="outline-none">
              <CommunityChat />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: sticky suggestions sidebar */}
        <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-4">
          <TeacherSuggestions />
        </div>
      </div>
    </div>
  );
}
