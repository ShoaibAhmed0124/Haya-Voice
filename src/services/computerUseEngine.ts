/**
 * HAYA Computer Use Engine - Services
 * Manages computer interaction loops, simulated/virtual OS command dispatching,
 * visual state feedback (observe, understand, plan, execute, verify, report),
 * and mouse coordinate overlays.
 */

export interface ComputerAction {
  id: string;
  type: "move_mouse" | "click" | "double_click" | "right_click" | "type_text" | "keyboard_shortcut" | "scroll_up" | "scroll_down" | "open_app" | "drag";
  target: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  text?: string;
  shortcut?: string;
  timestamp: string;
  status: "observe" | "understand" | "plan" | "executing" | "completed" | "failed";
}

export type ActionStep = "idle" | "observing" | "understanding" | "planning" | "explaining" | "executing" | "verifying" | "completed";

export class ComputerUseEngine {
  private static instance: ComputerUseEngine | null = null;
  
  private actionsList: ComputerAction[] = [];
  private currentStep: ActionStep = "idle";
  private activeAction: ComputerAction | null = null;
  private cursorFollowEnabled: boolean = false;
  private lastKnownUserCursor: { x: number; y: number } = { x: 50, y: 50 };

  // Listeners
  private onStateChanged: (() => void) | null = null;
  private onTriggerMouseSim: ((action: ComputerAction) => void) | null = null;

  private constructor() {}

  public static getInstance(): ComputerUseEngine {
    if (!ComputerUseEngine.instance) {
      ComputerUseEngine.instance = new ComputerUseEngine();
    }
    return ComputerUseEngine.instance;
  }

  public registerStateListener(cb: () => void): void {
    this.onStateChanged = cb;
  }

  public registerMouseTrigger(cb: (action: ComputerAction) => void): void {
    this.onTriggerMouseSim = cb;
  }

  /**
   * Returns list of historic computer use actions
   */
  public getHistory(): ComputerAction[] {
    return this.actionsList;
  }

  public getCurrentStep(): ActionStep {
    return this.currentStep;
  }

  public getActiveAction(): ComputerAction | null {
    return this.activeAction;
  }

  public isCursorFollowActive(): boolean {
    return this.cursorFollowEnabled;
  }

  public setCursorFollow(enabled: boolean): void {
    this.cursorFollowEnabled = enabled;
    this.notify();
  }

  public updateUserCursor(coords: { x: number; y: number }): void {
    this.lastKnownUserCursor = coords;
    this.notify();
  }

  public getLastKnownUserCursor(): { x: number; y: number } {
    return this.lastKnownUserCursor;
  }

  /**
   * Executes Haya's Think-Before-Acting cycle for computer interaction
   */
  public async executeAction(actionInput: Omit<ComputerAction, "id" | "timestamp" | "status">): Promise<boolean> {
    const actionId = `act_${Date.now()}`;
    const newAction: ComputerAction = {
      ...actionInput,
      id: actionId,
      timestamp: new Date().toLocaleTimeString(),
      status: "observe",
    };

    this.activeAction = newAction;
    this.actionsList = [newAction, ...this.actionsList].slice(0, 30); // limit to last 30 actions
    
    // Step 1: Observe
    this.currentStep = "observing";
    this.notify();
    await this.delay(900);

    // Step 2: Understand
    this.currentStep = "understanding";
    newAction.status = "understand";
    this.notify();
    await this.delay(1000);

    // Step 3: Plan
    this.currentStep = "planning";
    newAction.status = "plan";
    this.notify();
    await this.delay(800);

    // Step 4: Explain
    this.currentStep = "explaining";
    this.notify();
    await this.delay(700);

    // Step 5: Execute (Trigger UI animation)
    this.currentStep = "executing";
    newAction.status = "executing";
    this.notify();
    if (this.onTriggerMouseSim) {
      this.onTriggerMouseSim(newAction);
    }
    // Simulate execution time
    await this.delay(1500);

    // Step 6: Verify
    this.currentStep = "verifying";
    this.notify();
    await this.delay(1000);

    // Step 7: Completed
    this.currentStep = "completed";
    newAction.status = "completed";
    this.notify();
    await this.delay(800);

    // Done
    this.currentStep = "idle";
    this.activeAction = null;
    this.notify();

    return true;
  }

  public clearHistory(): void {
    this.actionsList = [];
    this.notify();
  }

  private notify(): void {
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
