export class AskInFlightGate {
  private activeToken: symbol | null = null;

  tryStart(): symbol | null {
    if (this.activeToken) return null;
    const token = Symbol('ask-in-flight');
    this.activeToken = token;
    return token;
  }

  finish(token: symbol): boolean {
    if (this.activeToken !== token) return false;
    this.activeToken = null;
    return true;
  }

  reset(): void {
    this.activeToken = null;
  }

  isActive(): boolean {
    return this.activeToken !== null;
  }
}
