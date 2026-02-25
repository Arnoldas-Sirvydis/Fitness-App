export type Tab = 'exercises' | 'templates' | 'log' | 'history' | 'settings';

export type WeightUnit = 'kg' | 'lb';

export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  secondaryMuscles: string[];
  instructions: string[];
}

export interface TemplateExercise {
  exerciseId: string;
  order: number;
}

export interface WorkoutTemplate {
  id?: number;
  name: string;
  exercises: TemplateExercise[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkoutSet {
  id: string;
  weight: string;
  reps: string;
  completed: boolean;
}

export interface LoggedExercise {
  instanceId: string;
  exerciseId: string;
  name: string;
  sets: WorkoutSet[];
}

export interface ActiveWorkout {
  id: string;
  templateId?: number;
  templateName: string;
  startedAt: number;
  exercises: LoggedExercise[];
}

export interface WorkoutEntry {
  id?: number;
  templateId?: number;
  templateName: string;
  startedAt: number;
  endedAt: number;
  exercises: LoggedExercise[];
}
