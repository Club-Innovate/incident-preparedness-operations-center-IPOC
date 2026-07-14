import type { ExecutionDirective } from './ExecutionLaneBoard';

type ExecutionDirectivePatch = {
  id: string;
  patch: Partial<ExecutionDirective>;
};

export function applyDirectivePatch(directives: ExecutionDirective[], id: string, patch: Partial<ExecutionDirective>): ExecutionDirective[] {
  const existing = directives.find((item) => item.id === id);
  if (!existing) {
    return [...directives, {
      id,
      status: patch.status ?? 'planned',
      owner: patch.owner ?? '',
      dueDate: patch.dueDate ?? '',
      blockedByDirectiveId: patch.blockedByDirectiveId ?? '',
    }];
  }

  return directives.map((item) => (item.id === id
    ? {
        ...item,
        ...patch,
      }
    : item));
}

export function applyDirectivePatchBatch(directives: ExecutionDirective[], patches: ExecutionDirectivePatch[]): ExecutionDirective[] {
  return patches.reduce((current, item) => applyDirectivePatch(current, item.id, item.patch), directives);
}

export function countUnresolvedDependencies(directives: ExecutionDirective[]): number {
  const directivesById = new Map(directives.map((directive) => [directive.id, directive]));

  return directives.reduce((count, directive) => {
    if (!directive.blockedByDirectiveId) {
      return count;
    }

    const blocker = directivesById.get(directive.blockedByDirectiveId);
    if (!blocker) {
      return count;
    }

    return blocker.status === 'completed' ? count : count + 1;
  }, 0);
}

export function resolveDependencyBlockers(directives: ExecutionDirective[]): ExecutionDirective[] {
  const nextById = new Map(directives.map((directive) => [directive.id, { ...directive }]));

  nextById.forEach((directive) => {
    if (!directive.blockedByDirectiveId) {
      return;
    }

    const blocker = nextById.get(directive.blockedByDirectiveId);
    if (!blocker || blocker.status === 'completed') {
      return;
    }

    nextById.set(blocker.id, {
      ...blocker,
      status: 'completed',
    });
  });

  nextById.forEach((directive) => {
    if (!directive.blockedByDirectiveId) {
      return;
    }

    const blocker = nextById.get(directive.blockedByDirectiveId);
    if (!blocker || blocker.status !== 'completed') {
      return;
    }

    nextById.set(directive.id, {
      ...directive,
      blockedByDirectiveId: '',
      status: directive.owner.trim().length > 0 ? 'in-progress' : 'planned',
    });
  });

  return Array.from(nextById.values());
}
