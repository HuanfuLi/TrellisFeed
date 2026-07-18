export class AskInFlightGate {
  private active = false;

  tryStart(): boolean {
    if (this.active) return false;
    this.active = true;
    return true;
  }

  finish(): void {
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }
}
