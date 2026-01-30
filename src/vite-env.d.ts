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

// AudioWorklet globals
declare function registerProcessor(name: string, processorConstructor: typeof AudioWorkletProcessor): void;

interface AudioWorkletProcessor {
  port: MessagePort;
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}

declare class AudioWorkletProcessor {
  port: MessagePort;
  constructor();
}
