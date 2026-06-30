export type AssistantState = "disconnected" | "connecting" | "listening" | "speaking" | "error";

export interface ToolCallPayload {
  name: string;
  args: any;
  callId: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: "female" | "male";
  description: string;
}

export const PREBUILT_VOICES: VoiceOption[] = [
  { id: "Aoede", name: "Aoede", gender: "female", description: "Soft, shy, and cute voice with a gentle, slow pace and deeply caring, Hinata-like nature." },
  { id: "Kore", name: "Kore", gender: "female", description: "Bright, cute, empathetic, and expressive." },
  { id: "Puck", name: "Puck", gender: "male", description: "Warm, friendly, and spirited." },
  { id: "Zephyr", name: "Zephyr", gender: "female", description: "Steady, efficient, and unhurried female voice. Emits a deeply empathetic and reassuring tone." },
  { id: "Charon", name: "Charon", gender: "male", description: "Deep, calm, and professional." },
  { id: "Fenrir", name: "Fenrir", gender: "male", description: "Bold, modern, and direct." },
];
