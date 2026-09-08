import { useCallback } from "react";
import { useThetaContext } from "./context.js";

/**
 * Returns command dispatcher helper functions for mutating Theta intake state.
 *
 * @returns {{
 *   dispatch: (cmd: import("../../engine.js").Command) => { ok: boolean, error?: any },
 *   commitAnswer: (questionId: string, value: any, path?: string) => { ok: boolean, error?: any },
 *   deleteAnswer: (questionId: string, path?: string) => { ok: boolean, error?: any },
 *   jumpToQuestion: (questionId: string, scopeIndex?: number) => { ok: boolean, error?: any },
 *   addRepeaterItem: (collectionPath: string, defaultItem?: any) => { ok: boolean, error?: any },
 *   removeRepeaterItem: (collectionPath: string, index: number) => { ok: boolean, error?: any },
 *   setFact: (path: string, value: any) => { ok: boolean, error?: any }
 * }}
 */
export function useThetaDispatch() {
  const { engine } = useThetaContext();

  const dispatch = useCallback((cmd) => {
    return engine.dispatch(cmd);
  }, [engine]);

  const commitAnswer = useCallback((questionId, value, path) => {
    return engine.dispatch({ type: "COMMIT_ANSWER", questionId, value, path });
  }, [engine]);

  const deleteAnswer = useCallback((questionId, path) => {
    return engine.dispatch({ type: "DELETE_ANSWER", questionId, path });
  }, [engine]);

  const jumpToQuestion = useCallback((questionId, scopeIndex) => {
    return engine.dispatch({ type: "JUMP_TO_QUESTION", questionId, scopeIndex });
  }, [engine]);

  const addRepeaterItem = useCallback((collectionPath, defaultItem) => {
    return engine.dispatch({ type: "ADD_REPEATER_ITEM", collectionPath, defaultItem });
  }, [engine]);

  const removeRepeaterItem = useCallback((collectionPath, index) => {
    return engine.dispatch({ type: "REMOVE_REPEATER_ITEM", collectionPath, index });
  }, [engine]);

  const setFact = useCallback((path, value) => {
    return engine.dispatch({ type: "SET_FACT", path, value });
  }, [engine]);

  return {
    dispatch,
    commitAnswer,
    deleteAnswer,
    jumpToQuestion,
    addRepeaterItem,
    removeRepeaterItem,
    setFact,
  };
}
