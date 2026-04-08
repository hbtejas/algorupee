/** Reusable loading spinner component for async states. */

/**
 * Loading spinner.
 * @returns {JSX.Element}
 */
export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
