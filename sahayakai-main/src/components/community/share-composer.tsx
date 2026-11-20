'use client';

import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { useClickOutside } from '@/hooks/use-click-outside';
import { cn } from '@/lib/utils';
import { createGroupPostAction } from '@/lib/api/groups';
import { SHARE_TEMPLATES, type PostType } from '@/types/community';
import {
  Lightbulb,
  FileUp,
  HelpCircle,
  Trophy,
  Send,
  Loader2,
  ChevronDown,
  Sparkles,
  X,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Lightbulb,
  FileUp,
  HelpCircle,
  Trophy,
};

// Same tints as the post-type pill on FeedPost, so a chip previews the post.
const COLOR_MAP: Record<PostType, { idle: string; active: string }> = {
  share: { idle: 'bg-tint-accent text-primary border-primary/20', active: 'bg-primary text-primary-foreground border-transparent' },
  resource: { idle: 'bg-chart-5/10 text-chart-5 border-chart-5/20', active: 'bg-chart-5 text-white border-transparent' },
  ask_help: { idle: 'bg-tint-info text-info border-tint-info-border', active: 'bg-info text-info-foreground border-transparent' },
  celebrate: { idle: 'bg-tint-success text-success border-tint-success-border', active: 'bg-success text-success-foreground border-transparent' },
};

const MAX_CHARS = 2000;

/** Ask the composer to open, optionally with a post type and a prompt to answer. */
export interface ComposerOpenRequest {
  /** Change this to re-trigger (e.g. Date.now()). */
  nonce: number;
  postType?: PostType;
  /** Already-translated prompt text, shown above the text box as guidance. */
  prompt?: string;
}

interface ShareComposerProps {
  groupId?: string;
  groups?: Array<{ id: string; name: string }>;
  /**
   * Called after the post is created. Receives the new post id and the
   * group it landed in so the parent can do optimistic insertion before
   * the next feed refresh.
   */
  onPostCreated?: (info?: { postId: string; groupId: string; postType: PostType; content: string }) => void;
  openRequest?: ComposerOpenRequest | null;
}

export function ShareComposer({ groupId, groups, onPostCreated, openRequest }: ShareComposerProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<PostType>('share');
  const [selectedGroupId, setSelectedGroupId] = useState(groupId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [guidePrompt, setGuidePrompt] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const groupDropdownRef = useRef<HTMLDivElement>(null);
  // Close the group dropdown when the user clicks outside or hits Escape.
  // Previously the dropdown only toggled via its own button — clicking elsewhere
  // left it open and overlapping content.
  useClickOutside(groupDropdownRef, () => setGroupOpen(false), groupOpen);

  const open = (type?: PostType) => {
    if (type) setPostType(type);
    setExpanded(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (!openRequest) return;
    if (openRequest.postType) setPostType(openRequest.postType);
    setGuidePrompt(openRequest.prompt ?? null);
    setExpanded(true);
    setTimeout(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      textareaRef.current?.focus({ preventScroll: true });
    }, 50);
  }, [openRequest]);

  const activeTemplate = SHARE_TEMPLATES.find((tpl) => tpl.id === postType) ?? SHARE_TEMPLATES[0];

  if (!user) {
    return (
      <div className="rounded-surface-md border border-dashed border-border bg-card/70 p-4 text-center text-sm text-muted-foreground">
        {t("Sign in to share")}
      </div>
    );
  }

  const initials =
    user.displayName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '?';

  async function handleSubmit() {
    const targetGroup = groupId ?? selectedGroupId;
    if (!targetGroup) {
      toast({ title: t('Select a group'), description: t('Choose which group to post in.'), variant: 'destructive' });
      return;
    }
    if (!content.trim()) {
      toast({ title: t('Write something'), description: t('Your post cannot be empty.'), variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const postId = await createGroupPostAction(targetGroup, content.trim(), postType, []);
      const submittedContent = content.trim();
      setContent('');
      setPostType('share');
      setExpanded(false);
      setGuidePrompt(null);
      if (!groupId) setSelectedGroupId('');
      onPostCreated?.({ postId, groupId: targetGroup, postType, content: submittedContent });
      toast({ title: t('Posted!') });
    } catch (err) {
      toast({
        title: t('Failed to post'),
        description: err instanceof Error ? err.message : t('Something went wrong'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const typeChips = (onPick: (type: PostType) => void, size: 'sm' | 'md') =>
    SHARE_TEMPLATES.map((tpl) => {
      const Icon = ICON_MAP[tpl.icon];
      const isActive = expanded && postType === tpl.id;
      const colors = COLOR_MAP[tpl.id];
      return (
        <button
          key={tpl.id}
          type="button"
          aria-pressed={expanded ? isActive : undefined}
          className={cn(
            'focus-ring flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border font-medium transition-colors duration-micro',
            size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm',
            isActive ? colors.active : colors.idle,
          )}
          onClick={() => onPick(tpl.id)}
        >
          {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
          {t(tpl.label)}
        </button>
      );
    });

  // Collapsed state — an inviting prompt plus one-tap post types.
  if (!expanded) {
    return (
      <div ref={rootRef} className="rounded-surface-md border border-border bg-card p-4 shadow-soft sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={user.photoURL ?? undefined} alt="" />
            <AvatarFallback className="bg-tint-accent text-xs font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => open()}
            className="focus-ring flex h-11 min-w-0 flex-1 items-center rounded-pill border border-border bg-background px-4 text-left text-sm text-muted-foreground transition-colors duration-micro hover:border-primary/40 hover:text-foreground"
          >
            <span className="truncate">{t("What did you try today?")}</span>
          </button>
        </div>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide sm:pl-14">
          {typeChips((type) => open(type), 'sm')}
        </div>
      </div>
    );
  }

  // Expanded state
  const selectedGroupName = groups?.find((g) => g.id === (groupId ?? selectedGroupId))?.name;
  const hasGroups = (groups?.length ?? 0) > 0;

  return (
    <div ref={rootRef} className="rounded-surface-md border border-primary/25 bg-card shadow-elevated">
      <div className="space-y-3 p-4 sm:p-6">
        {/* Header row: avatar + group selector */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={user.photoURL ?? undefined} alt="" />
            <AvatarFallback className="bg-tint-accent text-xs font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{t("Posting to")}</p>
            {groupId ? (
              <span className="block truncate text-sm font-semibold text-foreground">{selectedGroupName ?? t('Group')}</span>
            ) : (
              <div ref={groupDropdownRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={groupOpen}
                  className={cn(
                    'focus-ring -ml-1 flex max-w-full items-center gap-1 rounded-surface-sm px-1 text-sm font-semibold transition-colors hover:text-primary',
                    selectedGroupName ? 'text-foreground' : 'text-primary',
                  )}
                  onClick={() => setGroupOpen((o) => !o)}
                >
                  <span className="truncate">{selectedGroupName ?? t('Select group')}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
                {groupOpen && (
                  <div role="listbox" className="absolute left-0 top-full z-20 mt-1 max-h-64 min-w-[220px] max-w-xs overflow-y-auto rounded-surface-md border border-border bg-popover py-1 shadow-floating">
                    {hasGroups ? groups!.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        role="option"
                        aria-selected={g.id === selectedGroupId}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                          g.id === selectedGroupId && 'font-semibold text-primary',
                        )}
                        onClick={() => {
                          setSelectedGroupId(g.id);
                          setGroupOpen(false);
                        }}
                      >
                        {g.name}
                      </button>
                    )) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">{t("Join a group to post")}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* The prompt this post answers, when opened from a SahayakAI prompt */}
        {guidePrompt && (
          <div className="flex items-start gap-2 rounded-surface-sm bg-tint-accent-soft px-3 py-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <p className="flex-1 text-sm leading-relaxed text-foreground indic-text">
              <span className="block text-xs font-medium text-muted-foreground">{t("SahayakAI prompt")}</span>
              {guidePrompt}
            </p>
            <button
              type="button"
              onClick={() => setGuidePrompt(null)}
              aria-label={t("Remove prompt")}
              className="focus-ring shrink-0 rounded-pill p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Post type */}
        <div role="group" aria-label={t("Post type")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide">
          {typeChips(setPostType, 'md')}
        </div>

        <div>
          <label htmlFor="community-composer" className="mb-1.5 block text-sm font-medium text-foreground indic-text">
            {t(activeTemplate.prompt)}
          </label>
          <Textarea
            id="community-composer"
            ref={textareaRef}
            value={content}
            maxLength={MAX_CHARS}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !submitting && content.trim()) handleSubmit();
            }}
            placeholder={t(activeTemplate.placeholder)}
            className="min-h-[96px] max-h-[240px] resize-y rounded-surface-md border-border text-base leading-relaxed focus-visible:ring-primary/30"
          />
        </div>

        {/* Footer: post action. The "Add Image" button was removed in Phase 4 —
            it had no onClick and was pure dead UI. Image attachments will ship
            via a follow-up ticket using the existing image-uploader.tsx pattern. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn('text-xs tabular-nums', content.length > MAX_CHARS * 0.9 ? 'text-warning' : 'text-muted-foreground')}>
            {content.length > 0 ? `${content.length}/${MAX_CHARS}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setExpanded(false);
                setContent('');
                setGuidePrompt(null);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 rounded-pill bg-primary px-5 text-primary-foreground hover:bg-primary/90"
              disabled={submitting || !content.trim()}
              onClick={handleSubmit}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {submitting ? t("Posting…") : t("Post")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
