import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@craft/ui";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("The application could not render.", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-login">
        <section className="app-login__card" role="alert">
          <h1>Something went wrong</h1>
          <p>We could not display this page. Unsaved changes may have been lost. Try opening it again.</p>
          <Button onClick={() => this.setState({ failed: false })}>Try again</Button>
          <Button onClick={() => window.location.reload()} variant="secondary">Reload app</Button>
        </section>
      </main>
    );
  }
}
