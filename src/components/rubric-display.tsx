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
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type RubricDisplayProps = {
  rubric: RubricGeneratorOutput;
};

export const RubricDisplay: FC<RubricDisplayProps> = ({ rubric }) => {
  if (!rubric || !rubric.criteria || rubric.criteria.length === 0) {
    return null;
  }

  const handleDownload = () => {
    const input = document.getElementById('rubric-pdf');
    if (input) {
        html2canvas(input, { scale: 2 }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / canvasHeight;
            let width = pdfWidth;
            let height = width / ratio;
            if (height > pdfHeight) {
                height = pdfHeight;
                width = height * ratio;
            }

            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            pdf.save('rubric.pdf');
        });
    }
  };


  const performanceLevels = rubric.criteria[0]?.levels.map(level => ({
      name: level.name,
      points: level.points
  })) || [];

  return (
    <Card id="rubric-pdf" className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="font-headline text-2xl">{rubric.title}</CardTitle>
                {rubric.description && <CardDescription>{rubric.description}</CardDescription>}
            </div>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
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
