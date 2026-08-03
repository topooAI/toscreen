import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  createEditingHistory,
  createInitialEditingDocument,
  createMainTrackTimeMap,
  executeEditingCommand,
  redoEditingCommand,
  undoEditingCommand,
  type EditingCommand,
} from '../editing';

export function useEditingSession(sourceDurationMs: number) {
  const [history, dispatchHistory] = useReducer(
    (state: ReturnType<typeof createEditingHistory>, action: { type: 'execute'; command: EditingCommand } | { type: 'undo' } | { type: 'redo' } | { type: 'initialize'; sourceDurationMs: number }) => {
      if (action.type === 'initialize') {
        if (state.present.clips.length > 0 || state.past.length > 0 || action.sourceDurationMs <= 0) return state;
        return createEditingHistory(createInitialEditingDocument(action.sourceDurationMs));
      }
      if (action.type === 'undo') return undoEditingCommand(state);
      if (action.type === 'redo') return redoEditingCommand(state);
      return executeEditingCommand(state, action.command, sourceDurationMs);
    },
    sourceDurationMs,
    (duration) => createEditingHistory(createInitialEditingDocument(duration)),
  );
  useEffect(() => {
    dispatchHistory({ type: 'initialize', sourceDurationMs });
  }, [sourceDurationMs]);
  const timeMap = useMemo(() => createMainTrackTimeMap(history.present, sourceDurationMs), [history.present, sourceDurationMs]);
  const execute = useCallback((command: EditingCommand) => dispatchHistory({ type: 'execute', command }), []);
  return {
    document: history.present,
    timeMap,
    execute,
    undo: useCallback(() => dispatchHistory({ type: 'undo' }), []),
    redo: useCallback(() => dispatchHistory({ type: 'redo' }), []),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
