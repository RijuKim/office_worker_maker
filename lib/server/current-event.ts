type ActiveEvent = { id: string; createdAt: Date };

export function resolveCurrentEvent<T extends ActiveEvent>(
  events: T[],
  currentEventId: string | null,
): T | null {
  return events.find((event) => event.id === currentEventId)
    ?? [...events].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0]
    ?? null;
}
