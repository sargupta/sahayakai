
"use client";
import type { FC } from 'react';
import type { RubricGeneratorOutput } from "@/ai/flows/rubric-generator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from './ui/button';
import { Download, Save, Copy, ClipboardCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type RubricDisplayProps = {
  rubric: RubricGeneratorOutput;
};

export const RubricDisplay: FC<RubricDisplayProps> = ({ rubric }) => {
  const { toast } = useToast();

  if (!rubric || !rubric.criteria || rubric.criteria.length === 0) {
    return null;
  }

  const handleDownload = () => {
    // Better Naming for PDF
    const originalTitle = document.title;
    const cleanTitle = (rubric.title || 'Rubric').replace(/[^a-z0-9]/gi, '_');
    const filename = `Sahayak_Rubric_${cleanTitle}`;

    document.title = filename; // Sets the default filename in Print Dialog
    window.print();

    // Restore title after a small delay
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);

    toast({
      title: "Print to PDF",
      description: "Select 'Save as PDF' to save in high quality.",
    });
  };

  const handleSave = () => {
    toast({
      title: "Saved to Library",
      description: "Your rubric has been saved to your personal library.",
    });
  };

  const handleCopy = () => {
    // Format rubric as text
    const rubricText = `
${rubric.title}
${rubric.description}

${rubric.criteria.map((criterion, idx) => `
${idx + 1}. ${criterion.name}
   ${criterion.description}
   
   Performance Levels:
${criterion.levels.map(level => `   • ${level.name} (${level.points} pts): ${level.description}`).join('\n')}
`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(rubricText);
    toast({
      title: "Copied to Clipboard",
      description: "Rubric has been copied to your clipboard.",
    });
  };


  const performanceLevels = rubric.criteria[0]?.levels.map(level => ({
    name: level.name,
    points: level.points
  })) || [];

  return (
    <Card id="rubric-pdf" className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
      <CardHeader className="space-y-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 space-y-2">
            <CardTitle className="font-headline text-2xl md:text-3xl flex items-center gap-2">
              <ClipboardCheck className="h-7 w-7 text-primary" />
              {rubric.title}
            </CardTitle>
            {rubric.description && (
              <CardDescription className="text-base">
                {rubric.description}
              </CardDescription>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-start gap-2 no-print">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="min-w-full border-collapse border border-primary/20">
            <TableHeader className="bg-primary/10">
              <TableRow>
                <TableHead className="w-[25%] border border-primary/20 p-2 font-headline text-primary-foreground bg-primary">Criteria</TableHead>
                {performanceLevels.map(level => (
                  <TableHead key={level.name} className="w-[18.75%] border border-primary/20 p-2 text-center font-headline text-primary-foreground bg-primary">
                    {level.name} ({level.points} pts)
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rubric.criteria.map((criterion, criterionIndex) => (
                <TableRow key={criterionIndex} className="bg-white/50">
                  <TableCell className="border border-primary/20 p-2 align-top">
                    <p className="font-bold">{criterion.name}</p>
                    <p className="text-xs text-muted-foreground">{criterion.description}</p>
                  </TableCell>
                  {criterion.levels.map((level, levelIndex) => (
                    <TableCell key={levelIndex} className="border border-primary/20 p-2 text-sm align-top">
                      {level.description}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
