import React from 'react';

console.log('Mock lucide-react loaded');

const IconMock = (name: string) => (props: any) =>
    React.createElement('div', { ...props, 'data-testid': `icon-${name.toLowerCase().replace(' ', '-')}` });

export const Loader2 = IconMock('loader2');
export const Mic = IconMock('mic');
export const Search = IconMock('search');
export const Sparkles = IconMock('sparkles');
export const BookOpen = IconMock('book-open');
export const BrainCircuit = IconMock('brain-circuit');
export const PenTool = IconMock('pen-tool');
export const GraduationCap = IconMock('graduation-cap');
export const ArrowRight = IconMock('arrow-right');
export const X = IconMock('x');
export const StopCircle = IconMock('stop-circle');

// Default export for deep imports (e.g. lucide-react/dist/esm/icons/loader-2)
export default (props: any) => React.createElement('div', { ...props, 'data-testid': 'icon-mock-default' });
