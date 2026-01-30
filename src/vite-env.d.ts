/// <reference types="vite/client" />

declare module "*?url" {
  const content: string;
  export default content;
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
