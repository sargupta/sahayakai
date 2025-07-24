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

type RubricDisplayProps = {
  rubric: RubricGeneratorOutput;
};

export const RubricDisplay: FC<RubricDisplayProps> = ({ rubric }) => {
  if (!rubric || !rubric.criteria || rubric.criteria.length === 0) {
    return null;
  }

  const performanceLevels = rubric.criteria[0]?.levels.map(level => ({
      name: level.name,
      points: level.points
  })) || [];

  return (
    <Card className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">{rubric.title}</CardTitle>
        {rubric.description && <CardDescription>{rubric.description}</CardDescription>}
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
