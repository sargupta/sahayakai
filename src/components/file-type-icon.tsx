"use client";

import {
  FileText,
  Folder,
  ImageIcon,
  ClipboardCheck,
  FileSignature,
  PencilRuler,
  type LucideProps,
} from 'lucide-react';
import type { FC } from 'react';

export type FileType = 'folder' | 'lesson-plan' | 'quiz' | 'rubric' | 'worksheet' | 'image' | 'other';

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
    case 'image':
      return <ImageIcon {...props} />;
    default:
      return <FileText {...props} />;
  }
};
