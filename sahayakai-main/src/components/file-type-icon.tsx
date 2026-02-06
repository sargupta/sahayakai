"use client";

import {
  FileText,
  Folder,
  ImageIcon,
  ClipboardCheck,
  FileSignature,
  PencilRuler,
  Lightbulb,
  Map as MapIcon,
  Video,
  GraduationCap,
  type LucideProps,
} from 'lucide-react';
import type { FC } from 'react';
import { type ContentType } from '@/types';

export type FileType = ContentType | 'folder' | 'image' | 'other';

type FileTypeIconProps = {
  type: FileType;
  className?: string;
} & LucideProps;

export const FileTypeIcon: FC<FileTypeIconProps> = ({ type, ...props }) => {
  switch (type) {
    case 'folder':
      return <Folder {...props} />;
    case 'lesson-plan':
      return <FileText {...props} />;
    case 'quiz':
      return <FileSignature {...props} />;
    case 'rubric':
      return <ClipboardCheck {...props} />;
    case 'worksheet':
      return <PencilRuler {...props} />;
    case 'visual-aid':
    case 'image':
      return <ImageIcon {...props} />;
    case 'instant-answer':
      return <Lightbulb {...props} />;
    case 'virtual-field-trip':
      return <MapIcon {...props} />;
    case 'micro-lesson':
      return <Video {...props} />;
    case 'teacher-training':
      return <GraduationCap {...props} />;
    default:
      return <FileText {...props} />;
  }
};
