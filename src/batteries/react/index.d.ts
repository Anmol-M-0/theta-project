import type { ReactNode } from "react";
import type { IntakeEngine, Command, DispatchResult } from "../../engine.js";
import type { StoreAdapter } from "../../adapter.js";
import type { QuestionInstance, ReviewTree } from "../../projections.js";

export interface ThetaProviderProps {
  engine: IntakeEngine;
  adapter?: StoreAdapter;
  children: ReactNode;
}

export function ThetaProvider(props: ThetaProviderProps): React.JSX.Element;

export function useThetaContext(): {
  engine: IntakeEngine;
  adapter: StoreAdapter;
};

export function useThetaStore<T = any>(selector?: (state: any) => T): T;

export function useActiveQuestion(): QuestionInstance | null;

export function useIsIntakeComplete(): boolean;

export function useQuestionState(questionId: string): any;

export function useQuestionValue<T = any>(questionId: string): T | undefined;

export function useFactPath<T = any>(path: string): T | undefined;

export function useReviewTree(): ReviewTree;

export function useIntakeProgress(): {
  totalEligible: number;
  completed: number;
  remaining: number;
  percentComplete: number;
};

export function useThetaDispatch(): {
  dispatch: (cmd: Command) => DispatchResult;
  commitAnswer: (questionId: string, value: any, path?: string) => DispatchResult;
  deleteAnswer: (questionId: string, path?: string) => DispatchResult;
  jumpToQuestion: (questionId: string, scopeIndex?: number) => DispatchResult;
  addRepeaterItem: (collectionPath: string, defaultItem?: any) => DispatchResult;
  removeRepeaterItem: (collectionPath: string, index: number) => DispatchResult;
  setFact: (path: string, value: any) => DispatchResult;
};
