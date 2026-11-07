export function DemoModeNotice() {
  return (
    <div className="demo-notice" role="note">
      <span className="demo-notice__pulse" aria-hidden="true" />
      <span>
        <strong>Local backend</strong> — community changes are saved on this
        development server. Meladee's seeded tracks and both local artist accounts are available.
      </span>
    </div>
  );
}
