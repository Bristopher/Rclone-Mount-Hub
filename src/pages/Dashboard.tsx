import { Plus } from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage your rclone mounts
          </p>
        </div>
        <Button variant="primary" className="gap-2">
          <Plus size={18} weight="bold" />
          Add Connection
        </Button>
      </div>

      {/* Empty State */}
      <Card className="p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 flex items-center justify-center mb-4">
          <Plus size={32} className="text-accent-blue" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          No connections yet
        </h2>
        <p className="text-text-secondary max-w-md mb-6">
          Get started by adding your first rclone mount. Connect to your Unraid
          server, NAS, or cloud storage with just a few clicks.
        </p>
        <Button variant="primary" className="gap-2">
          <Plus size={18} weight="bold" />
          Add Your First Connection
        </Button>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-text-primary">0</div>
          <div className="text-sm text-text-secondary">Total Mounts</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-accent-green">0</div>
          <div className="text-sm text-text-secondary">Active</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-text-tertiary">—</div>
          <div className="text-sm text-text-secondary">Avg Speed</div>
        </Card>
      </div>
    </div>
  );
}
