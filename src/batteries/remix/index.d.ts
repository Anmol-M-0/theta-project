import type { IntakeEngine } from "../../engine.js";
import type { Schema, QuestionInstance } from "../../schema.js";
import type { ReviewTree } from "../../projections.js";
import type { StorageAdapter } from "../../storage.js";
import type { StoreAdapter } from "../../adapter.js";

export interface SerializedThetaState {
  schemaId: string;
  version: number;
  revision: number;
  facts: Record<string, any>;
  history?: any[];
}

export function serializeThetaState(engine: IntakeEngine): SerializedThetaState;

export function hydrateThetaState(options: {
  schema: Schema;
  serializedState: Partial<SerializedThetaState>;
  storage?: StorageAdapter;
}): IntakeEngine;

export interface ThetaCookieSessionStorage {
  cookieName: string;
  getFacts: (requestOrCookieHeader: Request | string | null) => Record<string, any>;
  commitFacts: (facts: Record<string, any>) => string;
  destroySession: () => string;
}

export function createThetaCookieSessionStorage(options?: {
  cookieName?: string;
  secret?: string;
  maxAge?: number;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
  httpOnly?: boolean;
  secure?: boolean;
}): ThetaCookieSessionStorage;

export interface ThetaRequestContext {
  engine: IntakeEngine;
  request: Request;
  getFacts: () => Record<string, any>;
  serialize: () => SerializedThetaState;
  saveToSession: () => string;
}

export function createThetaRequestContext(options: {
  request: Request;
  schema: Schema;
  sessionStorage?: ThetaCookieSessionStorage;
  initialFacts?: Record<string, any>;
  storage?: StorageAdapter;
}): ThetaRequestContext;

export interface ThetaLoaderResult {
  schema: Schema;
  state: SerializedThetaState;
  activeQuestion: QuestionInstance | null;
  stats: {
    totalEligible: number;
    completed: number;
    remaining: number;
    percentComplete: number;
  };
  reviewTree: ReviewTree;
}

export function thetaLoader(options: {
  request: Request;
  schema: Schema;
  sessionStorage?: ThetaCookieSessionStorage;
  initialFacts?: Record<string, any>;
}): Promise<ThetaLoaderResult>;

export function thetaLoaderResponse(
  options: {
    request: Request;
    schema: Schema;
    sessionStorage?: ThetaCookieSessionStorage;
    initialFacts?: Record<string, any>;
  },
  responseInit?: ResponseInit
): Promise<Response>;

export function thetaAction(options: {
  request: Request;
  schema: Schema;
  sessionStorage: ThetaCookieSessionStorage;
  redirectTo?: string;
  onComplete?: (facts: Record<string, any>, engine: IntakeEngine) => any;
}): Promise<Response>;

export function useRemixTheta(options: {
  loaderData: ThetaLoaderResult;
  actionData?: any;
}): {
  engine: IntakeEngine;
  adapter: StoreAdapter;
  activeQuestion: QuestionInstance | null;
  stats: {
    totalEligible: number;
    completed: number;
    remaining: number;
    percentComplete: number;
  };
  reviewTree: ReviewTree;
  actionError: string | null;
};
