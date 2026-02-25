import Dexie, { type Table } from 'dexie';
import type { Exercise, WorkoutEntry, WorkoutTemplate } from './types';
import exerciseSeed from '@/data/exercises.json';

class PulseLogDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<WorkoutTemplate, number>;
  workouts!: Table<WorkoutEntry, number>;
  meta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super('pulselog-db');
    this.version(1).stores({
      exercises: 'id, name, bodyPart, equipment, target',
      templates: '++id, name, updatedAt',
      meta: 'key'
    });

    this.version(2).stores({
      exercises: 'id, name, bodyPart, equipment, target',
      templates: '++id, name, updatedAt',
      workouts: '++id, startedAt, endedAt',
      meta: 'key'
    });
  }
}

export const db = new PulseLogDB();

export async function seedExercises() {
  const seeded = await db.meta.get('seeded_v1');
  if (seeded) return;

  await db.transaction('rw', db.exercises, db.meta, async () => {
    await db.exercises.bulkPut(exerciseSeed as Exercise[]);
    await db.meta.put({ key: 'seeded_v1', value: new Date().toISOString() });
  });
}
