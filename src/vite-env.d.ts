/// <reference types="vite/client" />

declare module "*?url" {
  const content: string;
  export default content;
}

// Worker factory type - returns a new Worker instance
export type WorkerWrapper = () => Worker

// AudioWorklet globals - these are provided by the browser at runtime
// Do NOT define interface here as it can contaminate bundled code
declare function registerProcessor(name: string, processorConstructor: any): void;
