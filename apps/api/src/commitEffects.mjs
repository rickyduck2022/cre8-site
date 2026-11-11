import { AsyncLocalStorage } from "node:async_hooks";

export const commitContext = new AsyncLocalStorage();

export function afterCommit(effect) {
  const context = commitContext.getStore();
  if (!context || context.finished) return effect();
  context.effects.push(effect);
}

export function respondAfterCommit(status, effect) {
  const context = commitContext.getStore();
  if (!context || context.finished) return effect();
  context.status = status;
  context.response = effect;
}

export function afterRollback(effect) {
  const context = commitContext.getStore();
  if (context && !context.finished) context.rollbackEffects.push(effect);
}
