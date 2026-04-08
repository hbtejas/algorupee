/** React error boundary to catch render failures and show fallback UI. */

import React from "react";

/** Error boundary component. */
export default class ErrorBoundary extends React.Component {
  /**
   * @param {any} props
   */
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * Update state for fallback rendering.
   * @returns {{hasError:boolean}}
   */
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  /**
   * Lifecycle error hook.
   * @param {Error} error
   */
  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error("UI Error:", error);
  }

  /**
   * Render children or fallback.
   * @returns {JSX.Element}
   */
  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto mt-12 max-w-xl rounded-xl border border-sell/30 bg-sell/10 p-6 text-center">
          <h2 className="text-lg font-bold text-sell">Something went wrong</h2>
          <p className="mt-2 text-sm text-white/70">Please refresh the page and try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
