/// <reference types="vite/client" />

declare module "*?url" {
  const content: string;
  export default content;
}

declare module "*?worker" {
  const workerConstructor: WorkerWrapper;
  export default workerConstructor;
}

// Worker constructor type from ?worker imports
export type WorkerWrapper = {
  new(): Worker;
}

// AudioWorklet globals - these are provided by the browser at runtime
// Do NOT define interface here as it can contaminate bundled code
declare function registerProcessor(name: string, processorConstructor: any): void;
