// lib/fsm-types.ts

// Server race states
export type RaceState =
  | "RACE_OFFLINE"
  | "RACE_WAITING_START"
  | "RACE_BOARDING"
  | "RACE_IN_TRANSIT"
  | "RACE_ARRIVED_STOP"
  | "RACE_FINISHED";

// Map old trip status to race state (for compatibility)
export const TRIP_STATUS_TO_RACE_STATE: Record<string, RaceState> = {
  "PREP_IDLE": "RACE_OFFLINE",
  "PREP_TIMER": "RACE_WAITING_START",
  "BOARDING": "RACE_BOARDING",
  "ROUTE_READY": "RACE_ARRIVED_STOP",
  "IN_ROUTE": "RACE_IN_TRANSIT",
  "FINISHED": "RACE_FINISHED", // Добавлено
};

// UI FSM states for button
export type UIFSMState = "idle" | "processing" | "success" | "error" | "disabled";

// Transition actions
export type TransitionAction =
  | "start_shift"
  | "start_trip"
  | "depart_stop"
  | "arrive_stop"
  | "start_boarding"
  | "finish_trip" // Изменено с "none"
  | "none";

// Button configuration based on race state
export interface ButtonConfig {
  label: string;
  action: TransitionAction;
  enabled: boolean;
  stopName?: string; // Добавлено для отображения названия остановки
}

// Panel visibility states
export interface PanelVisibility {
  mainButton: boolean;
  queue: boolean;
  reservation: boolean;
  cash: boolean;
}

// Map race state to button config
export const RACE_STATE_TO_BUTTON: Record<RaceState, ButtonConfig> = {
  RACE_OFFLINE: {
    label: "Выйти на линию",
    action: "start_shift",
    enabled: true,
  },
  RACE_WAITING_START: {
    label: "Начать рейс",
    action: "start_trip",
    enabled: true,
  },
  RACE_BOARDING: {
    label: "Отправиться",
    action: "depart_stop",
    enabled: true,
  },
  RACE_IN_TRANSIT: {
    label: "Прибыл", // Будет дополнено названием остановки
    action: "arrive_stop",
    enabled: true,
  },
  RACE_ARRIVED_STOP: {
    label: "Начать посадку",
    action: "start_boarding",
    enabled: true,
  },
  RACE_FINISHED: {
    label: "Завершить рейс",
    action: "finish_trip", // Изменено
    enabled: true, // Изменено на true
  },
};

// Map race state to panel visibility
export const RACE_STATE_TO_PANELS: Record<RaceState, PanelVisibility> = {
  RACE_OFFLINE: {
    mainButton: true,
    queue: false,
    reservation: false,
    cash: false, // Исправлено
  },
  RACE_WAITING_START: {
    mainButton: true,
    queue: false,
    reservation: false,
    cash: false, // Исправлено
  },
  RACE_BOARDING: {
    mainButton: true,
    queue: true,
    reservation: true,
    cash: true,
  },
  RACE_IN_TRANSIT: {
    mainButton: true,
    queue: false,
    reservation: false,
    cash: true,
  },
  RACE_ARRIVED_STOP: {
    mainButton: true,
    queue: true,
    reservation: true,
    cash: true,
  },
  RACE_FINISHED: {
    mainButton: true, // Изменено на true
    queue: false,
    reservation: false,
    cash: false,
  },
};

// Logging helper
export const logFSMEvent = (
  event: string,
  details: Record<string, any>
) => {
  console.log(`[v0] ${event}`, {
    ...details,
    timestamp: new Date().toISOString(),
  });
};
