import { extractGradeFromTopic } from '@/lib/grade-utils';

describe('extractGradeFromTopic', () => {
  it('should return null if no grade is found', () => {
    expect(extractGradeFromTopic('A lesson about photosynthesis')).toBeNull();
  });

  it('should extract grade from "class X" pattern', () => {
    expect(extractGradeFromTopic('A history lesson for class 5')).toBe('Class 5');
  });

  it('should extract grade from "classX" pattern without space', () => {
    expect(extractGradeFromTopic('A history lesson for class4')).toBe('Class 4');
  });

  it('should extract grade from "grade X" pattern', () => {
    expect(extractGradeFromTopic('A science lesson for grade 8')).toBe('Class 8');
  });

  it('should be case-insensitive', () => {
    expect(extractGradeFromTopic('A lesson for GRADE 3 students')).toBe('Class 3');
    expect(extractGradeFromTopic('A lesson for ClaSs 7 students')).toBe('Class 7');
  });

  it('should extract grade from "Xth grade" pattern', () => {
    expect(extractGradeFromTopic('A lesson for 1st grade')).toBe('Class 1');
    expect(extractGradeFromTopic('A lesson for 2nd grade')).toBe('Class 2');
    expect(extractGradeFromTopic('A lesson for 3rd grade')).toBe('Class 3');
    expect(extractGradeFromTopic('A lesson for 4th grade')).toBe('Class 4');
  });

  it('should extract grade from "for class X students" pattern', () => {
    expect(extractGradeFromTopic('This is designed for class 6 students')).toBe('Class 6');
  });

  it('should extract grade from "to class X" pattern', () => {
    expect(extractGradeFromTopic('Please explain this to class 2')).toBe('Class 2');
  });

  it('should return the first match if multiple patterns exist', () => {
    expect(extractGradeFromTopic('A lesson for class 5 about 3rd grade topics')).toBe('Class 5');
  });

  it('should return null for strings with numbers but no grade patterns', () => {
    expect(extractGradeFromTopic('A lesson about the 3 branches of government')).toBeNull();
    expect(extractGradeFromTopic('Chapter 4, section 2')).toBeNull();
  });
});
