/** Protected alerts page for managing user alert rules. */

import AlertManager from "../components/alerts/AlertManager";

/**
 * Alerts route component.
 * @returns {JSX.Element}
 */
export default function Alerts() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Alerts</h2>
      <AlertManager />
    </div>
  );
}
