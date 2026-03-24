'use client';

import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createGroupPostAction } from '@/app/actions/groups';
import { SHARE_TEMPLATES, type PostType } from '@/types/community';
import {
  Lightbulb,
  FileUp,
  HelpCircle,
  Trophy,
  Send,
  Loader2,
  ChevronDown,
  ImagePlus,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Lightbulb,
  FileUp,
  HelpCircle,
  Trophy,
};

const COLOR_MAP: Record<PostType, { bg: string; border: string; activeBg: string }> = {
  share: { bg: 'bg-amber-50', border: 'border-amber-200', activeBg: 'bg-amber-500' },
  resource: { bg: 'bg-blue-50', border: 'border-blue-200', activeBg: 'bg-blue-500' },
  ask_help: { bg: 'bg-purple-50', border: 'border-purple-200', activeBg: 'bg-purple-500' },
  celebrate: { bg: 'bg-emerald-50', border: 'border-emerald-200', activeBg: 'bg-emerald-500' },
};

interface ShareComposerProps {
  groupId?: string;
  groups?: Array<{ id: string; name: string }>;
  onPostCreated?: () => void;
}

export function ShareComposer({ groupId, groups, onPostCreated }: ShareComposerProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<PostType>('share');
  const [selectedGroupId, setSelectedGroupId] = useState(groupId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeTemplate = SHARE_TEMPLATES.find((t) => t.id === postType) ?? SHARE_TEMPLATES[0];

  if (!user) {
    return (
      <Card className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 text-center text-slate-500 text-sm">
        Sign in to share
      </Card>
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
      toast({ title: 'Select a group', description: 'Choose which group to post in.', variant: 'destructive' });
      return;
    }
    if (!content.trim()) {
      toast({ title: 'Write something', description: 'Your post cannot be empty.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      await createGroupPostAction(targetGroup, content.trim(), postType, []);
      setContent('');
      setPostType('share');
      setExpanded(false);
      if (!groupId) setSelectedGroupId('');
      onPostCreated?.();
      toast({ title: 'Posted!' });
    } catch (err) {
      toast({
        title: 'Failed to post',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Collapsed state
  if (!expanded) {
    return (
      <Card
        className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => {
          setExpanded(true);
          setTimeout(() => textareaRef.current?.focus(), 50);
        }}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.photoURL ?? undefined} />
            <AvatarFallback className="text-xs bg-orange-100 text-orange-700">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-slate-400 text-sm">What did you try today?</span>
        </div>
      </Card>
    );
  }

  // Expanded state
  const selectedGroupName = groups?.find((g) => g.id === (groupId ?? selectedGroupId))?.name;

  return (
    <Card className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Orange accent top border */}
      <div className="h-0.5 bg-gradient-to-r from-orange-100 to-orange-50" />

      <div className="p-4 space-y-3">
        {/* Header row: avatar + group selector */}
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={user.photoURL ?? undefined} />
            <AvatarFallback className="text-xs bg-orange-100 text-orange-700">{initials}</AvatarFallback>
          </Avatar>

          {groupId ? (
            <span className="text-sm font-medium text-slate-700">{selectedGroupName ?? 'Group'}</span>
          ) : (
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
                onClick={() => setGroupOpen((o) => !o)}
              >
                {selectedGroupName ?? 'Select group'}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {groupOpen && groups && groups.length > 0 && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                      onClick={() => {
                        setSelectedGroupId(g.id);
                        setGroupOpen(false);
                      }}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Template chips — horizontally scrollable */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {SHARE_TEMPLATES.map((tpl) => {
            const Icon = ICON_MAP[tpl.icon];
            const isActive = postType === tpl.id;
            const colors = COLOR_MAP[tpl.id];
            return (
              <button
                key={tpl.id}
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 border ${
                  isActive
                    ? `${colors.activeBg} text-white border-transparent`
                    : `${colors.bg} ${colors.border} ${tpl.color}`
                }`}
                onClick={() => setPostType(tpl.id)}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {tpl.label}
              </button>
            );
          })}
        </div>

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={activeTemplate.placeholder}
          className="min-h-[80px] max-h-[200px] resize-y border-slate-200 rounded-xl text-sm focus-visible:ring-orange-300"
        />

        {/* Footer: add image + post */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600 gap-1.5">
            <ImagePlus className="h-4 w-4" />
            <span className="text-xs">Add Image</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 text-xs"
              onClick={() => {
                setExpanded(false);
                setContent('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-4 gap-1.5"
              disabled={submitting || !content.trim()}
              onClick={handleSubmit}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Post
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
