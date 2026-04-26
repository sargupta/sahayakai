"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Card, CardContent, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FileTypeIcon, type FileType } from '@/components/file-type-icon';
import { LanguageSelector } from '@/components/language-selector';
import { useLanguage } from '@/context/language-context';
import {
  getLibraryResources,
  likeResourceAction,
  saveResourceToLibraryAction,
} from '@/app/actions/community';
import {
  Loader2, Search, Library, Bookmark, ArrowRight, Heart,
  Mic, MicOff, LayoutGrid,
} from 'lucide-react';
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

const TYPE_CONFIG: Record<string, {
  border: string; bg: string; text: string; label: string; route: string;
}> = {
  'lesson-plan':        { border: 'border-t-primary/60',  bg: 'bg-primary/8',  text: 'text-primary',    label: 'Lesson Plan',  route: 'lesson-planner' },
  'quiz':               { border: 'border-t-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-600',    label: 'Quiz',         route: 'quiz-generator' },
  'worksheet':          { border: 'border-t-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Worksheet',    route: 'worksheet-wizard' },
  'rubric':             { border: 'border-t-violet-400',  bg: 'bg-violet-50',  text: 'text-violet-600',  label: 'Rubric',       route: 'rubric-generator' },
  'image':              { border: 'border-t-pink-400',    bg: 'bg-pink-50',    text: 'text-pink-600',    label: 'Visual Aid',   route: 'visual-aid-designer' },
  'visual-aid':         { border: 'border-t-pink-400',    bg: 'bg-pink-50',    text: 'text-pink-600',    label: 'Visual Aid',   route: 'visual-aid-designer' },
  'virtual-field-trip': { border: 'border-t-teal-400',   bg: 'bg-teal-50',    text: 'text-teal-600',    label: 'Field Trip',   route: 'virtual-field-trip' },
  'teacher-training':   { border: 'border-t-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-600',   label: 'Training',     route: 'teacher-training' },
};

const cfg = (type: string) =>
  TYPE_CONFIG[type] ?? { border: 'border-t-border', bg: 'bg-muted/50', text: 'text-muted-foreground', label: 'Resource', route: 'instant-answer' };

const LANG_SHORT: Record<string, string> = {
  en: 'EN', hi: 'HI', bn: 'BN', te: 'TE', mr: 'MR',
  ta: 'TA', gu: 'GU', kn: 'KN', pa: 'PA', ml: 'ML', or: 'OR',
};

const TYPE_CHIPS: { value: string; label: string; fileType?: FileType }[] = [
  { value: 'all',                label: 'All' },
  { value: 'lesson-plan',        label: 'Lessons',    fileType: 'lesson-plan' },
  { value: 'quiz',               label: 'Quizzes',    fileType: 'quiz' },
  { value: 'worksheet',          label: 'Worksheets', fileType: 'worksheet' },
  { value: 'rubric',             label: 'Rubrics',    fileType: 'rubric' },
  { value: 'visual-aid',         label: 'Visual Aids', fileType: 'visual-aid' },
  { value: 'virtual-field-trip', label: 'Field Trips', fileType: 'virtual-field-trip' },
];

// ── Voice search hook ─────────────────────────────────────────────────────────

function useVoiceSearch(onResult: (text: string) => void, lang: string) {
  const [isListening, setIsListening] = useState(false);
  const recRef = useRef<any>(null);

  const toggle = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (isListening) {
      recRef.current?.stop();
      setIsListening(false);
      return;
    }

    const rec = new SR();
    rec.lang = lang !== 'all' ? lang : navigator.language;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      if (transcript) onResult(transcript);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);

    recRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [isListening, lang, onResult]);

  return { isListening, toggle };
}

// ── Skeleton card ────────────────────────────────────────────────────────────

const CardSkeleton = () => (
  <div className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
    <div className="h-1.5 bg-muted w-full" />
    <div className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-muted shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-muted rounded w-4/5" />
          <div className="h-3 bg-muted rounded w-2/5" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-muted rounded-full" />
        <div className="h-5 w-12 bg-muted rounded-full" />
      </div>
    </div>
    <div className="px-4 py-3 border-t border-border flex justify-between">
      <div className="h-6 w-10 bg-muted rounded" />
      <div className="flex gap-2">
        <div className="h-7 w-14 bg-muted rounded-lg" />
        <div className="h-7 w-16 bg-primary/10 rounded-lg" />
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
        'hover:shadow-elevated',
        'border border-border border-t-4 rounded-2xl bg-card overflow-hidden',
        c.border,
      )}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-xl shrink-0', c.bg)}>
            <FileTypeIcon type={resource.type} className={cn('h-5 w-5', c.text)} />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <CardTitle className="text-sm font-bold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 font-headline">
              {resource.title}
            </CardTitle>

            <div className="flex items-center gap-1.5">
              <Avatar className={cn('h-5 w-5 ring-1 ring-white shadow-sm shrink-0')}>
                <AvatarFallback className={cn('text-[9px] font-bold', c.bg, c.text)}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold text-muted-foreground truncate">
                {resource.author}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 py-2 flex-grow">
        {resource.imageUrl ? (
          <div className="relative h-28 w-full overflow-hidden rounded-xl border border-border transition-all group-hover:border-border/80">
            <Image
              src={resource.imageUrl}
              alt={resource.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {resource.gradeLevel && (
              <Badge className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground font-semibold border-0 rounded-full">
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

      <CardFooter className="px-4 py-2.5 border-t border-border bg-muted/20 flex justify-between items-center gap-2 mt-auto">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-card border-border text-muted-foreground text-[10px] font-bold px-1.5 py-0 rounded-md shrink-0"
          >
            {LANG_SHORT[resource.language] ?? resource.language?.toUpperCase() ?? 'EN'}
          </Badge>

          <button
            onClick={() => onLike(resource)}
            className={cn(
              'flex items-center gap-1 text-xs font-bold transition-all duration-200 rounded-lg px-1.5 py-0.5',
              isLiked
                ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-muted-foreground/70 hover:text-red-400 hover:bg-red-50',
            )}
            aria-label={isLiked ? 'Unlike this resource' : 'Like this resource'}
          >
            <Heart className={cn('h-3 w-3 transition-all', isLiked && 'fill-red-500')} />
            <span>{resource.likes}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            disabled={isSaved}
            className={cn(
              'h-7 px-2 text-[11px] font-semibold rounded-lg gap-1 transition-all',
              isSaved
                ? 'text-primary bg-primary/10 cursor-default'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/5',
            )}
            onClick={() => !isSaved && onSave(resource)}
          >
            <Bookmark className={cn('h-3 w-3', isSaved && 'fill-primary')} />
            {isSaved ? 'Saved' : 'Save'}
          </Button>

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

// ── Resource list with skeleton + load-more ───────────────────────────────────

const INITIAL_VISIBLE = 20;
const PAGE_SIZE = 20;

const ResourceList = ({
  resources,
  loading,
  likedIds,
  savedIds,
  onLike,
  onSave,
}: {
  resources: Resource[];
  loading: boolean;
  likedIds: Set<string>;
  savedIds: Set<string>;
  onLike: (r: Resource) => void;
  onSave: (r: Resource) => void;
}) => {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  useEffect(() => { setVisibleCount(INITIAL_VISIBLE); }, [resources.length]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
        {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4 bg-muted/30 rounded-2xl border-2 border-dashed border-border mt-4">
        <div className="bg-primary/10 p-5 rounded-full">
          <Library className="h-8 w-8 text-primary" />
        </div>
        <div className="max-w-sm space-y-1.5">
          <h3 className="text-base font-bold text-foreground font-headline">No resources yet</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Be the first to share a lesson plan or quiz. Your contribution helps teachers across Bharat.
          </p>
        </div>
      </div>
    );
  }

  const visible = resources.slice(0, visibleCount);
  const hasMore = visibleCount < resources.length;
  const remaining = resources.length - visibleCount;

  return (
    <div className="space-y-4 mt-4">
      <p className="text-xs text-muted-foreground/60 font-semibold">
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
            className="gap-2 text-muted-foreground border-border hover:border-primary hover:text-primary font-semibold rounded-xl px-5"
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

// ── Main ResourceFeed component ──────────────────────────────────────────────

export function ResourceFeed() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [languageFilter, setLanguageFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [resources, setResources] = useState<Resource[]>([]);
  const [filteredResources, setFiltered] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── Voice search ──────────────────────────────────────────────────────────
  const handleVoiceResult = useCallback((text: string) => {
    setSearchInput(text);
  }, []);
  const { isListening, toggle: toggleVoice } = useVoiceSearch(handleVoiceResult, languageFilter);

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
        const trendingData = await getLibraryResources({
          language: languageFilter === 'all' ? undefined : languageFilter,
          excludeTypes: ['document'],
        });

        const transformed: Resource[] = (trendingData as any[]).map((r: any) => ({
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

        const unique = Array.from(new Map(transformed.map((r) => [r.id, r])).values());
        setResources(unique);
      } catch {
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
  }, [languageFilter, user, toast]);

  // ── Client-side filtering ─────────────────────────────────────────────────
  useEffect(() => {
    const lowerSearch = searchTerm.toLowerCase();
    const filtered = resources.filter((r) => {
      const matchesSearch = !searchTerm || r.title.toLowerCase().includes(lowerSearch);
      const matchesType = typeFilter === 'all' || r.type === typeFilter;
      return matchesSearch && matchesType;
    });
    setFiltered(filtered);
  }, [resources, searchTerm, typeFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLike = async (resource: Resource) => {
    if (!user) {
      toast({ title: 'Sign in to like resources', variant: 'destructive' });
      return;
    }
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(resource.id)) next.delete(resource.id);
      else next.add(resource.id);
      return next;
    });
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
    <div className="space-y-3">
      {/* Search + language row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
          <Input
            placeholder={t("Search lessons, quizzes, worksheets…")}
            className="pl-11 pr-12 h-12 bg-card border-border rounded-2xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30 shadow-soft"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button
            onClick={toggleVoice}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all",
              isListening
                ? "bg-red-100 text-red-500 animate-pulse"
                : "text-muted-foreground/60 hover:text-primary hover:bg-primary/8"
            )}
            title={isListening ? "Stop listening" : "Search by voice"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        </div>
        <div className="w-full sm:w-48 h-12">
          <LanguageSelector onValueChange={setLanguageFilter} defaultValue={languageFilter} />
        </div>
      </div>

      {/* Type filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {TYPE_CHIPS.map((chip) => {
          const isActive = typeFilter === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => setTypeFilter(chip.value)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 whitespace-nowrap',
                isActive
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary',
              )}
            >
              {chip.fileType ? (
                <FileTypeIcon
                  type={chip.fileType}
                  className={cn("h-3 w-3", isActive ? "text-white" : "text-muted-foreground/60")}
                />
              ) : (
                <LayoutGrid className={cn("h-3 w-3", isActive ? "text-white" : "text-muted-foreground/60")} />
              )}
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Resource grid */}
      <ResourceList
        resources={filteredResources}
        loading={loading}
        likedIds={likedIds}
        savedIds={savedIds}
        onLike={handleLike}
        onSave={handleSave}
      />
    </div>
  );
}
